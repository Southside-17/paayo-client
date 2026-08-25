// jest hoists every jest.mock() call above the imports whatever order they are
// written in, so the mocks read below the imports here and still take effect.
import { request } from '@/lib/api';
import { stopWatching, watchForArrival } from '@/lib/geofence';

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

jest.mock('@/lib/api', () => ({ request: jest.fn(async () => undefined) }));

const location = jest.requireMock('expo-location');
const held = { provider: 'p1', job: 'j1', token: 'bearer' };

/** The address in Davao, far from the fix the mock reports in Manila. */
const away = { latitude: 7.0731, longitude: 125.6128 };

beforeEach(() => jest.clearAllMocks());

it('watches the address when the crew are still far from it', async () => {
    await expect(watchForArrival(held, away)).resolves.toBe(true);

    expect(location.startGeofencingAsync).toHaveBeenCalledWith(
        'paayo.job.arrival',
        [{ identifier: 'j1', latitude: away.latitude, longitude: away.longitude, radius: 150 }],
    );
    expect(request).not.toHaveBeenCalled();
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
});

it('gives the fence up when the job is no longer on the road', async () => {
    await stopWatching();

    expect(location.stopGeofencingAsync).toHaveBeenCalledWith('paayo.job.arrival');
});

it('says nothing when there was no fence to give up', async () => {
    location.hasStartedGeofencingAsync.mockResolvedValueOnce(false);

    await expect(stopWatching()).resolves.toBeUndefined();

    expect(location.stopGeofencingAsync).not.toHaveBeenCalled();
});
