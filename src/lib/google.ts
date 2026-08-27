import {
    GoogleSignin,
    isErrorWithCode,
    isSuccessResponse,
    statusCodes,
} from '@react-native-google-signin/google-signin';
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

/**
 * Whether this platform signs in through Play Services rather than a browser.
 *
 * Google has a native account picker on Android and none on iOS -- its iOS SDK
 * opens a browser sheet of its own -- so Android is the one platform where
 * leaving the app buys nothing. The picker also reads the accounts already on
 * the phone, so there is nothing to type.
 *
 * Asked rather than captured at module load, so it answers for the platform the
 * code is running on rather than the one it was imported on.
 */
function signsInNatively(): boolean {
    return Platform.OS === 'android';
}

/**
 * Play Services' DEVELOPER_ERROR, which is not in the package's statusCodes.
 *
 * Android forwards Google's status code as its number in a string, and this one
 * means the app's signing certificate is not registered against the Android
 * OAuth client. Worth naming: the browser flow never checked the signature, so
 * this is the failure a build that used to sign in fine hits first.
 */
const DEVELOPER_ERROR = '10';

/** Whether this build was given the client id its platform needs. */
export function googleIsConfigured(): boolean {
    // Android asks Play Services, which knows the app by its package and
    // signing certificate rather than by a client id in the bundle -- but it
    // still needs the web client id to mint a token our API can check.
    const platform = Platform.select({
        android: CLIENTS.webClientId,
        ios: CLIENTS.iosClientId,
        default: CLIENTS.webClientId,
    });

    return Boolean(platform);
}

/**
 * Ask Play Services for a token, through the picker Android already has.
 *
 * An access token rather than the identity token beside it, because that is what
 * the API already accepts from the browser flow: it reads the audience off
 * Google's tokeninfo and refuses anything minted for another client. So this
 * changes where the person taps and nothing about what is proven.
 */
async function requestNativeToken(): Promise<string | null> {
    GoogleSignin.configure({
        webClientId: CLIENTS.webClientId,
        iosClientId: CLIENTS.iosClientId,
        scopes: ['email', 'profile'],
    });

    try {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

        // Play Services remembers the account it last handed over and returns it
        // without asking, which on a phone with several Google accounts means
        // there is no way to reach the other one -- or to sign in as someone
        // else after signing out of the app. Dropping that local memory is what
        // makes the picker appear; the consent already given is untouched, so
        // choosing the same account again asks for nothing.
        await GoogleSignin.signOut().catch(() => null);

        const response = await GoogleSignin.signIn();

        // Backing out of the picker is a decision, not a failure, and reads the
        // same as dismissing the browser did.
        if (!isSuccessResponse(response)) {
            return null;
        }

        const { accessToken } = await GoogleSignin.getTokens();

        return accessToken;
    } catch (error) {
        if (! isErrorWithCode(error)) {
            throw new DisplayableError('Google could not sign you in.');
        }

        switch (error.code) {
            case statusCodes.SIGN_IN_CANCELLED:
                return null;
            case statusCodes.IN_PROGRESS:
                return null;
            case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
                throw new DisplayableError('This phone needs Google Play services to sign in with Google.');
            case DEVELOPER_ERROR:
                throw new DisplayableError('This build is not registered with Google. Sign in another way.');
            default:
                throw new DisplayableError('Google could not sign you in.');
        }
    }
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
    //
    // Prepared on Android too, and unused there: a hook cannot be called
    // conditionally, and preparing a request nobody prompts costs nothing.
    const [request, , promptAsync] = Google.useAuthRequest({
        ...CLIENTS,
        shouldAutoExchangeCode: false,
    });

    if (signsInNatively()) {
        return {
            // No request to wait for: the picker is part of the phone.
            ready: googleIsConfigured(),
            requestToken: requestNativeToken,
        };
    }

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
