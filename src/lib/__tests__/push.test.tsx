import * as Notifications from 'expo-notifications';

import { request } from '@/lib/api';

jest.mock('@/lib/api', () => ({ request: jest.fn(), DEVICE_NAME: 'Test Device (ios)' }));

const granted = { granted: true, canAskAgain: false };
const denied = { granted: false, canAskAgain: true };

/**
 * Load the module fresh, so the env pair it reads at import time is re-read.
 */
function push() {
    let module: typeof import('@/lib/push');

    jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        module = require('@/lib/push');
    });

    return module!;
}

beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_APPLE_DEVELOPER_PROGRAM = '1';
});

it('registers the phone the OS has already agreed to', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(granted as never);

    await push().syncPushRegistration('bearer');

    expect(request).toHaveBeenCalledWith('/devices', {
        method: 'POST',
        token: 'bearer',
        body: { token: 'device-token', platform: 'ios', device_name: 'Test Device (ios)' },
    });
});

// Registering on sign in must never raise the OS prompt. Asking is a decision
// the Jobs screen makes at a moment that means something.
it('asks for nothing when permission has not been given', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(denied as never);

    await push().syncPushRegistration('bearer');

    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
});

it('asks and registers when the screen offers to turn them on', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(denied as never);
    jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue(granted as never);

    await expect(push().enablePush('bearer')).resolves.toBe(true);

    expect(request).toHaveBeenCalledWith('/devices', expect.objectContaining({ method: 'POST' }));
});

it('reports a refusal rather than registering anyway', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(denied as never);
    jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue(denied as never);

    await expect(push().enablePush('bearer')).resolves.toBe(false);

    expect(request).not.toHaveBeenCalled();
});

it('drops the registration before the bearer token is revoked', async () => {
    await push().dropPushRegistration('bearer');

    expect(request).toHaveBeenCalledWith('/devices/device-token', {
        method: 'DELETE',
        token: 'bearer',
    });
});

// Signing out matters more than tidying up.
it('signs out even when dropping the registration fails', async () => {
    jest.mocked(request).mockRejectedValue(new Error('offline'));

    await expect(push().dropPushRegistration('bearer')).resolves.toBeUndefined();
});

// The suite runs as iOS. A build with no entitlement must not even ask, or
// Xcode refuses to mint a profile and nothing installs at all.
it('is unsupported on an iOS build with no entitlement', () => {
    process.env.EXPO_PUBLIC_APPLE_DEVELOPER_PROGRAM = '';

    expect(push().pushIsSupported()).toBe(false);
});

it('registers nothing on a build it is unsupported on', async () => {
    process.env.EXPO_PUBLIC_APPLE_DEVELOPER_PROGRAM = '';

    await push().syncPushRegistration('bearer');

    expect(request).not.toHaveBeenCalled();
});
