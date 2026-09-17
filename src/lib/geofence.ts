import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import * as TaskManager from 'expo-task-manager';

import { ApiError, request } from './api';
import { readToken } from './tokens';

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
 * Where the watch is kept between launches.
 *
 * The OS relaunches a killed app to run the task, and a module variable does
 * not survive that. SecureStore does, and it is already here for the token.
 */
const KEY = 'paayo.job.watch';

/**
 * Metres from the pin that count as arrived.
 *
 * 150 rather than something tighter: iOS region monitoring is unreliable below
 * about 100m, and the pin is a marker somebody dropped rather than a surveyed
 * point. A fence that never fires is worse than one that fires at the gate.
 */
const RADIUS = 150;

/** Which job's arrival the task reports. The token is read from its own store. */
export type Watched = { provider: string; job: string };

/** A pin on the map. */
export type Pin = { latitude: number; longitude: number };

type Stored = Watched & Pin;

/** The one job being watched, if any. Regions carry no payload of their own. */
let watching: Stored | null = null;

async function remember(held: Stored): Promise<void> {
    watching = held;

    await SecureStore.setItemAsync(KEY, JSON.stringify(held));
}

/** The watch in hand, or the one a previous launch left behind. */
async function recall(): Promise<Stored | null> {
    if (watching !== null) {
        return watching;
    }

    try {
        const raw = await SecureStore.getItemAsync(KEY);
        const parsed = raw === null ? null : (JSON.parse(raw) as Partial<Stored>);

        if (
            parsed &&
            typeof parsed.provider === 'string' &&
            typeof parsed.job === 'string' &&
            typeof parsed.latitude === 'number' &&
            typeof parsed.longitude === 'number'
        ) {
            watching = parsed as Stored;
        }
    } catch {
        // An unreadable watch is no watch.
    }

    return watching;
}

async function forget(): Promise<void> {
    watching = null;

    try {
        await SecureStore.deleteItemAsync(KEY);
    } catch {
        // Nothing to do about it, and nothing a caller could do either.
    }
}

/**
 * Tell the server the crew arrived, and say it was the fence that noticed.
 *
 * `automatic` is recorded on the arrival so a tapped arrival and a geofenced one
 * stay tellable apart forever.
 */
async function report(held: Watched): Promise<void> {
    const token = await readToken();

    if (token === null) {
        return;
    }

    await request<void>(`/providers/${held.provider}/jobs/${held.job}/arrival`, {
        method: 'POST',
        body: { automatic: true },
        token,
    });
}

TaskManager.defineTask(TASK, async ({ data, error }) => {
    if (error) {
        return;
    }

    const { eventType } = (data ?? {}) as { eventType?: Location.GeofencingEventType };

    if (eventType !== Location.GeofencingEventType.Enter) {
        return;
    }

    const held = await recall();

    if (held === null) {
        return;
    }

    // Dropped first, so a fence that fires twice at the boundary does not post
    // twice, and a second post the server refuses anyway has no watch left to
    // retry from.
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
 * Idempotent for the job already watched: the screen asks every time it opens,
 * and re-registering would reset the fence under a crew halfway there.
 *
 * Nothing happens gracefully when permission is refused: no error, no nag. Auto
 * arrival removes a tap; it is never the only way to make one.
 */
export async function watchForArrival(held: Watched, pin: Pin): Promise<boolean> {
    const current = await recall();

    if (current?.job === held.job && (await hasFence())) {
        return true;
    }

    if (!(await mayWatch())) {
        return false;
    }

    try {
        await remember({ ...held, ...pin });

        // Already inside: ENTER never fires for a boundary nobody crossed, so a
        // crew setting out from next door would otherwise never arrive at all.
        // One fix at registration is what covers that.
        const here = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        });

        if (metresBetween(here.coords, pin) <= RADIUS) {
            await forget();
            await report(held);

            return true;
        }

        await Location.startGeofencingAsync(TASK, [
            { identifier: held.job, latitude: pin.latitude, longitude: pin.longitude, radius: RADIUS },
        ]);

        return true;
    } catch {
        await forget();

        return false;
    }
}

/**
 * Stop watching, whether the job ended or somebody arrived by hand.
 *
 * Given a job, only a watch on that job is dropped; a screen for a finished job
 * must not tear down the fence another job is on the road under.
 */
export async function stopWatching(job?: string): Promise<void> {
    if (job !== undefined) {
        const current = await recall();

        if (current !== null && current.job !== job) {
            return;
        }
    }

    await forget();

    try {
        if (await hasFence()) {
            await Location.stopGeofencingAsync(TASK);
        }
    } catch {
        // Nothing was registered, which is the state this was asking for.
    }
}

/**
 * On launch: drop a watch left behind for a job that is no longer on the road.
 *
 * The job is read from the server rather than trusted from the store, because
 * the store only knows what the phone last saw. A job the server no longer
 * shows this account is finished as far as the fence is concerned; a request
 * that never reached the server proves nothing and leaves the watch alone.
 */
export async function dropStaleWatch(token: string): Promise<void> {
    const held = await recall();

    if (held === null) {
        return;
    }

    try {
        const { data } = await request<{ data: { job?: { status: { value: string } } | null } }>(
            `/providers/${held.provider}/jobs/${held.job}`,
            { token },
        );

        if (data.job?.status.value !== 'enroute') {
            await stopWatching(held.job);
        }
    } catch (error) {
        if (error instanceof ApiError && !error.isUnauthenticated) {
            await stopWatching(held.job);
        }
    }
}

async function hasFence(): Promise<boolean> {
    try {
        return await Location.hasStartedGeofencingAsync(TASK);
    } catch {
        return false;
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
