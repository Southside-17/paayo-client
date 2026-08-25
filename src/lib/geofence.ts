import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { request } from './api';

/**
 * Auto-arrival: the phone tells the server when the crew reach the address.
 *
 * **The crew's position never leaves the device.** What the server learns is
 * "entered the target area at 18:31" -- the same one bit a tap would have given
 * it -- and there is no coordinate in the request, no coordinate column, and no
 * socket. That is the whole privacy story for the feature.
 *
 * This is region monitoring, not tracking. The phone's own hardware watches the
 * boundary and wakes the app once, which is why this could ship while the moving
 * dot could not: a dot has to poll, and polling needs a broadcast driver, a
 * socket server and continuous background emission.
 */

/** The TaskManager task the OS wakes, named once and registered once. */
const TASK = 'paayo.job.arrival';

/**
 * Metres from the pin that count as arrived.
 *
 * 150 rather than something tighter: iOS region monitoring is unreliable below
 * about 100m, and the pin is a marker somebody dropped rather than a surveyed
 * point. A fence that never fires is worse than one that fires at the gate.
 */
const RADIUS = 150;

/** What the task needs to know to report, held on the region it watches. */
type Watched = { provider: string; job: string; token: string };

/** The one job being watched, if any. Regions carry no payload of their own. */
let watching: Watched | null = null;

/**
 * Tell the server the crew arrived, and say it was the fence that noticed.
 *
 * `automatic` is recorded on the arrival so a tapped arrival and a geofenced one
 * stay tellable apart forever.
 */
async function report(held: Watched): Promise<void> {
    await request<void>(`/providers/${held.provider}/jobs/${held.job}/arrival`, {
        method: 'POST',
        body: { automatic: true },
        token: held.token,
    });
}

TaskManager.defineTask(TASK, async ({ data, error }) => {
    if (error || watching === null) {
        return;
    }

    const { eventType } = (data ?? {}) as { eventType?: Location.GeofencingEventType };

    if (eventType !== Location.GeofencingEventType.Enter) {
        return;
    }

    const held = watching;

    // Unregistered first, so a fence that fires twice at the boundary does not
    // post twice. The server refuses the second arrival anyway, but a refusal
    // the crew never asked for is not something to rely on.
    watching = null;

    try {
        await stopWatching();
        await report(held);
    } catch {
        // No signal at the gate is the ordinary case for this. The crew still
        // have the manual button, which is why it is never taken away.
    }
});

/**
 * Whether this phone will let the app watch a boundary in the background.
 *
 * Both permissions, because a fence has to fire with the app closed -- the crew
 * are driving, not reading a screen.
 */
export async function mayWatch(): Promise<boolean> {
    const foreground = await Location.requestForegroundPermissionsAsync();

    if (!foreground.granted) {
        return false;
    }

    const background = await Location.requestBackgroundPermissionsAsync();

    return background.granted;
}

/**
 * Start watching a job's address, reporting the arrival when the crew reach it.
 *
 * Nothing happens gracefully when permission is refused: no error, no nag. Auto
 * arrival removes a tap; it is never the only way to make one.
 */
export async function watchForArrival(
    held: Watched,
    pin: { latitude: number; longitude: number },
): Promise<boolean> {
    if (!(await mayWatch())) {
        return false;
    }

    watching = held;

    try {
        // Already inside: ENTER never fires for a boundary nobody crossed, so a
        // crew setting out from next door would otherwise never arrive at all.
        // One fix at registration is what covers that.
        const here = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        });

        if (metresBetween(here.coords, pin) <= RADIUS) {
            watching = null;

            await report(held);

            return true;
        }

        await Location.startGeofencingAsync(TASK, [
            { identifier: held.job, latitude: pin.latitude, longitude: pin.longitude, radius: RADIUS },
        ]);

        return true;
    } catch {
        watching = null;

        return false;
    }
}

/**
 * Stop watching, whether the job ended or somebody arrived by hand.
 */
export async function stopWatching(): Promise<void> {
    watching = null;

    try {
        if (await Location.hasStartedGeofencingAsync(TASK)) {
            await Location.stopGeofencingAsync(TASK);
        }
    } catch {
        // Nothing was registered, which is the state this was asking for.
    }
}

/**
 * Metres between two points, near enough for a 150m question.
 *
 * The haversine formula rather than a PostGIS call: this runs on the phone with
 * no network, and over a few kilometres the error is centimetres.
 */
function metresBetween(
    from: { latitude: number; longitude: number },
    to: { latitude: number; longitude: number },
): number {
    const EARTH = 6_371_000;
    const radians = (degrees: number) => (degrees * Math.PI) / 180;

    const dLat = radians(to.latitude - from.latitude);
    const dLon = radians(to.longitude - from.longitude);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(dLon / 2) ** 2;

    return 2 * EARTH * Math.asin(Math.sqrt(a));
}
