// jest hoists every jest.mock() call above the imports whatever order they are
// written in, so the mocks read below the imports here and still take effect.
import { ApiError, request } from '@/lib/api';
import { dropStaleWatch, stopWatching, watchForArrival } from '@/lib/geofence';

jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }));

jest.mock('expo-location', () => ({
    requestForegroundPermissionsAsync: jest.fn(async () => ({ granted: true })),
    requestBackgroundPermissionsAsync: jest.fn(async () => ({ granted: true })),
    getCurrentPositionAsync: jest.fn(async () => ({
        coords: { latitude: 14.5995, longitude: 120.9842 },
    })),
    startGeofencingAsync: jest.fn(async () => undefined),
    stopGeofencingAsync: jest.fn(async () => undefined),
    hasStartedGeofencingAsync: jest.fn(async () => true),
    GeofencingEventType: { Enter: 1, Exit: 2 },
    Accuracy: { Balanced: 3 },
}));

jest.mock('expo-secure-store', () => {
    const store = new Map<string, string>();

    return {
        store,
        getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
        setItemAsync: jest.fn(async (key: string, value: string) => void store.set(key, value)),
        deleteItemAsync: jest.fn(async (key: string) => void store.delete(key)),
    };
});

jest.mock('@/lib/api', () => {
    const actual = jest.requireActual('@/lib/api');

    return { ApiError: actual.ApiError, request: jest.fn(async () => undefined) };
});

jest.mock('@/lib/tokens', () => ({ readToken: jest.fn(async () => 'bearer') }));

const location = jest.requireMock('expo-location');
const { store } = jest.requireMock('expo-secure-store') as { store: Map<string, string> };
const taskManager = jest.requireMock('expo-task-manager');
const held = { provider: 'p1', job: 'j1' };

/** The address in Davao, far from the fix the mock reports in Manila. */
const away = { latitude: 7.0731, longitude: 125.6128 };

/** What a previous launch left in the store, as the OS relaunching the app finds it. */
const persisted = JSON.stringify({ ...held, ...away });

/** The task body the module handed TaskManager at import. */
function task(): (body: { data?: unknown; error?: unknown }) => Promise<void> {
    return taskManager.defineTask.mock.calls[0][1];
}

const arrival = { data: { eventType: 1 } };

// The task is registered once at import, so it is read before the mocks are
// cleared and kept for the whole file.
const fire = task();

beforeEach(async () => {
    // Every test starts with no watch in hand and no fence registered, and
    // whatever that took is not what the test is counting.
    await stopWatching();
    store.clear();
    jest.clearAllMocks();
    location.hasStartedGeofencingAsync.mockResolvedValue(false);
});

it('watches the address when the crew are still far from it', async () => {
    await expect(watchForArrival(held, away)).resolves.toBe(true);

    expect(location.startGeofencingAsync).toHaveBeenCalledWith(
        'paayo.job.arrival',
        [{ identifier: 'j1', latitude: away.latitude, longitude: away.longitude, radius: 150 }],
    );
    expect(request).not.toHaveBeenCalled();
    expect(JSON.parse(store.get('paayo.job.watch') ?? 'null')).toEqual({ ...held, ...away });
});

// The screen asks every time it opens; a crew halfway there must not have the
// fence reset under them.
it('leaves a fence already standing for the same job alone', async () => {
    store.set('paayo.job.watch', persisted);
    location.hasStartedGeofencingAsync.mockResolvedValue(true);

    await expect(watchForArrival(held, away)).resolves.toBe(true);

    expect(location.startGeofencingAsync).not.toHaveBeenCalled();
    expect(location.requestBackgroundPermissionsAsync).not.toHaveBeenCalled();
});

// ENTER never fires for a boundary nobody crossed, so a crew setting out from
// next door would otherwise never arrive at all.
it('reports straight away when the crew are already inside the fence', async () => {
    const here = { latitude: 14.5995, longitude: 120.9842 };

    await expect(watchForArrival(held, here)).resolves.toBe(true);

    expect(location.startGeofencingAsync).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledWith(
        '/providers/p1/jobs/j1/arrival',
        expect.objectContaining({ body: { automatic: true }, token: 'bearer' }),
    );
    expect(store.has('paayo.job.watch')).toBe(false);
});

// The whole privacy story: the server learns "entered the area", never where.
it('never sends a coordinate to the server', async () => {
    await watchForArrival(held, { latitude: 14.5995, longitude: 120.9842 });

    const [, options] = (request as jest.Mock).mock.calls[0];

    expect(Object.keys(options.body)).toEqual(['automatic']);
});

it('does nothing at all when the phone refuses the permission', async () => {
    location.requestBackgroundPermissionsAsync.mockResolvedValueOnce({ granted: false });

    await expect(watchForArrival(held, away)).resolves.toBe(false);

    expect(location.startGeofencingAsync).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
    expect(store.has('paayo.job.watch')).toBe(false);
});

it('gives the fence up when the job is no longer on the road', async () => {
    await watchForArrival(held, away);
    location.hasStartedGeofencingAsync.mockResolvedValue(true);

    await stopWatching();

    expect(location.stopGeofencingAsync).toHaveBeenCalledWith('paayo.job.arrival');
    expect(store.has('paayo.job.watch')).toBe(false);
});

it('says nothing when there was no fence to give up', async () => {
    await expect(stopWatching()).resolves.toBeUndefined();

    expect(location.stopGeofencingAsync).not.toHaveBeenCalled();
});

// A finished job's screen must not tear down the fence another job is under.
it('leaves another job\'s fence standing when asked to stop a different one', async () => {
    store.set('paayo.job.watch', persisted);
    location.hasStartedGeofencingAsync.mockResolvedValue(true);

    await stopWatching('j2');

    expect(location.stopGeofencingAsync).not.toHaveBeenCalled();
    expect(store.has('paayo.job.watch')).toBe(true);
});

describe('the task the OS wakes', () => {
    // The OS relaunches a killed app to run the task, and nothing in memory
    // survives that. The watch has to come back from the store.
    it('reports arrival from the stored watch when the app was relaunched cold', async () => {
        store.set('paayo.job.watch', persisted);
        location.hasStartedGeofencingAsync.mockResolvedValue(true);

        await fire(arrival);

        expect(request).toHaveBeenCalledWith(
            '/providers/p1/jobs/j1/arrival',
            expect.objectContaining({ method: 'POST', body: { automatic: true }, token: 'bearer' }),
        );
        expect(location.stopGeofencingAsync).toHaveBeenCalledWith('paayo.job.arrival');
        expect(store.has('paayo.job.watch')).toBe(false);
    });

    it('posts once when the fence fires twice at the boundary', async () => {
        store.set('paayo.job.watch', persisted);

        await fire(arrival);
        await fire(arrival);

        expect(request).toHaveBeenCalledTimes(1);
    });

    // The server refusing a second arrival is not a reason to keep a watch.
    it('drops the watch when the server refuses the arrival', async () => {
        store.set('paayo.job.watch', persisted);
        (request as jest.Mock).mockRejectedValueOnce(new ApiError(422, 'Already arrived.'));

        await expect(fire(arrival)).resolves.toBeUndefined();

        expect(store.has('paayo.job.watch')).toBe(false);
    });

    it('ignores leaving the area and errors from the OS', async () => {
        store.set('paayo.job.watch', persisted);

        await fire({ data: { eventType: 2 } });
        await fire({ error: new Error('lost') });

        expect(request).not.toHaveBeenCalled();
        expect(store.has('paayo.job.watch')).toBe(true);
    });

    it('does nothing when no watch was ever stored', async () => {
        await fire(arrival);

        expect(request).not.toHaveBeenCalled();
    });
});

describe('on launch', () => {
    it('clears a stored watch for a job that is no longer on the road', async () => {
        store.set('paayo.job.watch', persisted);
        location.hasStartedGeofencingAsync.mockResolvedValue(true);
        (request as jest.Mock).mockResolvedValueOnce({
            data: { job: { status: { value: 'completed' } } },
        });

        await dropStaleWatch('bearer');

        expect(request).toHaveBeenCalledWith('/providers/p1/jobs/j1', { token: 'bearer' });
        expect(location.stopGeofencingAsync).toHaveBeenCalledWith('paayo.job.arrival');
        expect(store.has('paayo.job.watch')).toBe(false);
    });

    it('clears a stored watch for a job the server no longer shows', async () => {
        store.set('paayo.job.watch', persisted);
        (request as jest.Mock).mockRejectedValueOnce(new ApiError(404, 'Not found.'));

        await dropStaleWatch('bearer');

        expect(store.has('paayo.job.watch')).toBe(false);
    });

    it('keeps the watch while the job is still on the road', async () => {
        store.set('paayo.job.watch', persisted);
        (request as jest.Mock).mockResolvedValueOnce({
            data: { job: { status: { value: 'enroute' } } },
        });

        await dropStaleWatch('bearer');

        expect(location.stopGeofencingAsync).not.toHaveBeenCalled();
        expect(store.has('paayo.job.watch')).toBe(true);
    });

    // No answer proves nothing; the crew may simply be out of signal.
    it('keeps the watch when the server cannot be reached', async () => {
        store.set('paayo.job.watch', persisted);
        (request as jest.Mock).mockRejectedValueOnce(new Error('offline'));

        await dropStaleWatch('bearer');

        expect(store.has('paayo.job.watch')).toBe(true);
    });
});
