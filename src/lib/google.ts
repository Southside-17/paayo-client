import { exchangeCodeAsync, type AuthRequest, type AuthSessionResult } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { Platform } from 'react-native';

import { DisplayableError } from './api';

/**
 * The OAuth clients Google issues tokens against.
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

/** The result shape that carries a reason, which spans both error and success. */
type AnsweredResult = Extract<AuthSessionResult, { params: Record<string, string> }>;

/** Whatever Google gave as the reason, in the order it tends to carry one. */
function refusal(result: AnsweredResult): string {
    return (
        result.error?.message ??
        result.params.error_description ??
        result.params.error ??
        'Google could not sign you in.'
    );
}

/**
 * Trade the one-use authorization code for the access token the API wants.
 */
async function redeem(request: AuthRequest, code: string | undefined): Promise<string> {
    if (code === undefined) {
        throw new DisplayableError('Google did not return an authorization code.');
    }

    try {
        const { accessToken } = await exchangeCodeAsync(
            {
                clientId: request.clientId,
                redirectUri: request.redirectUri,
                code,
                extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : {},
            },
            Google.discovery,
        );

        return accessToken;
    } catch (error) {
        throw new DisplayableError(
            error instanceof Error ? error.message : 'Google refused to issue a token.',
        );
    }
}

/**
 * Ask Google for an access token, which the API trades for a session.
 */
export function useGoogleSignIn(): { ready: boolean; requestToken: () => Promise<string | null> } {
    // shouldAutoExchangeCode is off because the hook's own exchange resolves
    // into its response state long after promptAsync() has returned, and a code
    // can only be redeemed once -- both running is one invalid_grant.
    const [request, , promptAsync] = Google.useAuthRequest({
        ...CLIENTS,
        shouldAutoExchangeCode: false,
    });

    return {
        ready: request !== null && googleIsConfigured(),
        requestToken: async () => {
            if (request === null) {
                throw new DisplayableError('Google sign-in is still loading. Try again.');
            }

            const result = await promptAsync();

            switch (result.type) {
                case 'cancel':
                case 'dismiss':
                    return null;
                case 'error':
                    throw new DisplayableError(refusal(result));
                // Web asks for a token outright and holds one already; a
                // native client is only ever given a code to trade.
                case 'success':
                    return result.authentication?.accessToken ?? redeem(request, result.params.code);
                default:
                    throw new DisplayableError('Google could not be opened. Try again.');
            }
        },
    };
}
