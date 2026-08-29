import * as SecureStore from 'expo-secure-store';

const KEY = 'paayo.token';

/** Read the stored bearer token, or null when this device has none. */
export async function readToken(): Promise<string | null> {
    try {
        return await SecureStore.getItemAsync(KEY);
    } catch {
        return null;
    }
}

export async function writeToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(KEY, token);
}

/**
 * Forget the stored token.
 *
 * Swallows a keychain failure the way readToken() does, and for a stronger
 * reason: this runs inside logout()'s `finally`, so a throw here escapes logout
 * entirely. Every caller discards that promise, so the rejection is silent and
 * the person stays signed in with a button that looks dead. Being unable to
 * delete a key is not a reason to refuse to sign somebody out.
 */
export async function clearToken(): Promise<void> {
    try {
        await SecureStore.deleteItemAsync(KEY);
    } catch {
        // Nothing to do about it, and nothing that should stop the sign out.
    }
}
