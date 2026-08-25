import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { DEVICE_NAME, request } from './api';

/** What the server calls each platform's token store. */
type PushPlatform = 'ios' | 'android';

/** A registered phone, as the API takes it. */
type Registration = { token: string; platform: PushPlatform; device_name: string };

/**
 * Determine whether this build can be notified at all.
 */
export function pushIsSupported(): boolean {
    if (Platform.OS === 'android') {
        return true;
    }

    return Platform.OS === 'ios' && Boolean(process.env.EXPO_PUBLIC_APPLE_DEVELOPER_PROGRAM);
}

/**
 * Ask the OS to notify this app, answering whether it agreed.
 */
export async function askToNotify(): Promise<boolean> {
    if (!pushIsSupported()) {
        return false;
    }

    const existing = await Notifications.getPermissionsAsync();

    if (existing.granted) {
        return true;
    }

    if (!existing.canAskAgain) {
        return false;
    }

    const asked = await Notifications.requestPermissionsAsync();

    return asked.granted;
}

/**
 * Read the token Apple or Google issued this install, or null if there is none.
 */
export async function readPushToken(): Promise<Registration | null> {
    if (!pushIsSupported() || (Platform.OS !== 'ios' && Platform.OS !== 'android')) {
        return null;
    }

    try {
        const { data } = await Notifications.getDevicePushTokenAsync();

        return typeof data === 'string' && data !== ''
            ? { token: data, platform: Platform.OS, device_name: DEVICE_NAME }
            : null;
    } catch {
        // A simulator has no push service behind it, and a build with no
        // credentials cannot register. Neither is worth telling anyone about.
        return null;
    }
}

/**
 * Register this phone, without asking for a permission it has not been given.
 */
export async function syncPushRegistration(token: string): Promise<void> {
    const permission = await currentPermission();

    if (!permission) {
        return;
    }

    await post(token);
}

/**
 * Ask for permission and register, answering whether the phone is now reachable.
 */
export async function enablePush(token: string): Promise<boolean> {
    if (!(await askToNotify())) {
        return false;
    }

    return post(token);
}

/**
 * Stop notifying this phone. Called before the bearer token is revoked.
 */
export async function dropPushRegistration(token: string): Promise<void> {
    const registration = await readPushToken();

    if (registration === null) {
        return;
    }

    try {
        await request<void>(`/devices/${encodeURIComponent(registration.token)}`, {
            method: 'DELETE',
            token,
        });
    } catch {
        // Signing out matters more than tidying up; a stale row is swept the
        // next time the service reports the token gone.
    }
}

/**
 * Read whether the OS has already agreed, without prompting.
 */
async function currentPermission(): Promise<boolean> {
    if (!pushIsSupported()) {
        return false;
    }

    const { granted } = await Notifications.getPermissionsAsync();

    return granted;
}

/**
 * Hand the token to the API, answering whether it landed.
 */
async function post(token: string): Promise<boolean> {
    const registration = await readPushToken();

    if (registration === null) {
        return false;
    }

    try {
        await request<void>('/devices', { method: 'POST', body: registration, token });

        return true;
    } catch {
        return false;
    }
}

/**
 * Read whether this phone can be notified, for a screen that has to say so.
 */
export async function pushIsReachable(): Promise<boolean> {
    return currentPermission();
}
