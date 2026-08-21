import * as Google from 'expo-auth-session/providers/google';
import { Platform } from 'react-native';

/**
 * The OAuth clients Google issues tokens against.
 *
 * Three, because Google verifies each kind of app differently: the web client
 * by its secret, Android by package name and signing fingerprint, iOS by bundle
 * identifier. Neither mobile client has a usable secret, which is why only ids
 * are here. The server refuses a token minted for anything it does not know.
 */
const CLIENTS = {
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
};

/** Whether this build was given the client id its platform needs. */
export function googleIsConfigured(): boolean {
    const platform = Platform.select({
        android: CLIENTS.androidClientId,
        ios: CLIENTS.iosClientId,
        default: CLIENTS.webClientId,
    });

    return Boolean(platform);
}

/**
 * Ask Google for an access token, which the API trades for a session.
 *
 * Returns null when the person backs out of the sheet -- that is a decision,
 * not a failure, and the screen should say nothing.
 */
export function useGoogleSignIn(): { ready: boolean; requestToken: () => Promise<string | null> } {
    const [request, , promptAsync] = Google.useAuthRequest(CLIENTS);

    return {
        ready: request !== null && googleIsConfigured(),
        requestToken: async () => {
            const result = await promptAsync();

            if (result.type !== 'success') {
                return null;
            }

            return result.authentication?.accessToken ?? null;
        },
    };
}
