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

export async function clearToken(): Promise<void> {
    await SecureStore.deleteItemAsync(KEY);
}
