import {
    exchangeCodeAsync,
    useAuthRequest,
    type AuthRequest,
    type AuthSessionResult,
    type DiscoveryDocument,
} from 'expo-auth-session';

import { DisplayableError } from './api';

/**
 * The Entra app registration this build signs in against.
 *
 * One registration serves the app and the console alike, and must stay one:
 * `sub` is pairwise per client id. No secret -- the app is the public client and
 * proves itself with PKCE.
 */
const CLIENT_ID = process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID ?? '';

/**
 * Where Microsoft returns from sign in, as registered on the Mobile platform.
 *
 * The scheme is the application id, which the manifest already claims for
 * Google's redirect, so this needs no prebuild.
 */
const REDIRECT_URL = 'com.paayo.ph://msauth';

/**
 * Where any Microsoft account authorises and exchanges.
 *
 * `common` rather than `consumers`, so work and school accounts reach the same
 * door personal ones do. Written out rather than discovered at runtime, which
 * would put a network round trip ahead of the browser opening.
 */
const DISCOVERY: DiscoveryDocument = {
    authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
};

/**
 * `email` earns its place: without it Entra returns a subject and no address,
 * and a first sign in has nothing to open an account with.
 */
const SCOPES = ['openid', 'profile', 'email'];

/** Whether this build was given the client id Microsoft needs. */
export function microsoftIsConfigured(): boolean {
    return Boolean(CLIENT_ID);
}

/** The result shape that carries a reason, which spans both error and success. */
type AnsweredResult = Extract<AuthSessionResult, { params: Record<string, string> }>;

/** Whatever Microsoft gave as the reason, in the order it tends to carry one. */
function refusal(result: AnsweredResult): string {
    return (
        result.error?.message ??
        result.params.error_description ??
        result.params.error ??
        'Microsoft could not sign you in.'
    );
}

/**
 * Trade the one-use authorization code for the identity token the API wants.
 *
 * The access token beside it is discarded: Microsoft publishes nothing saying
 * which client an access token was minted for, so the API cannot trust one.
 */
async function redeem(request: AuthRequest, code: string | undefined): Promise<string> {
    if (code === undefined) {
        throw new DisplayableError('Microsoft did not return an authorization code.');
    }

    let idToken: string | undefined;

    try {
        ({ idToken } = await exchangeCodeAsync(
            {
                clientId: CLIENT_ID,
                redirectUri: REDIRECT_URL,
                code,
                extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : {},
            },
            DISCOVERY,
        ));
    } catch (error) {
        throw new DisplayableError(
            error instanceof Error ? error.message : 'Microsoft refused to issue a token.',
        );
    }

    if (!idToken) {
        throw new DisplayableError('Microsoft did not return an identity token.');
    }

    return idToken;
}

/**
 * Ask Microsoft for an identity token, which the API trades for a session.
 */
export function useMicrosoftSignIn(): {
    ready: boolean;
    requestToken: () => Promise<string | null>;
} {
    const [request, , promptAsync] = useAuthRequest(
        {
            clientId: CLIENT_ID,
            scopes: SCOPES,
            redirectUri: REDIRECT_URL,
        },
        DISCOVERY,
    );

    return {
        ready: request !== null && microsoftIsConfigured(),
        requestToken: async () => {
            if (request === null) {
                throw new DisplayableError('Microsoft sign-in is still loading. Try again.');
            }

            const result = await promptAsync();

            switch (result.type) {
                // Closing the browser is a decision, not a failure, and reads the
                // same as backing out of Google's picker or Apple's sheet.
                case 'cancel':
                case 'dismiss':
                    return null;
                case 'error':
                    throw new DisplayableError(refusal(result));
                case 'success':
                    return redeem(request, result.params.code);
                default:
                    throw new DisplayableError('Microsoft could not be opened. Try again.');
            }
        },
    };
}
