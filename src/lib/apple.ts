import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { API_URL, DisplayableError } from './api';

/** Where the server hands the finished browser flow back to the app. */
const RETURN_URL = 'com.paayo.ph:/apple-oauth';

/**
 * Whether this build could offer Apple sign in at all.
 *
 * Both platforms can, by different roads: iOS has the native sheet, and Android
 * goes through the browser against the server's Services ID. The membership flag
 * gates both, because it is one fact about the build -- the entitlement iOS needs
 * and the Services ID the server needs both exist exactly when the paid team
 * does, and the same flag gates passkeys and push.
 *
 * Deliberately synchronous, so a screen can decide whether to render anything
 * before asking the platform whether the feature is available on this device.
 */
export function appleIsConfigured(): boolean {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
        return false;
    }

    return Boolean(process.env.EXPO_PUBLIC_APPLE_DEVELOPER_PROGRAM);
}

/**
 * How real Apple thinks the person is, in the words the API stores.
 *
 * Translated here rather than posted as Apple's 0/1/2, so the platform's
 * numbering never reaches the server and a stored value reads for itself.
 */
export type RealUser = 'likely' | 'unknown' | 'unsupported';

/** What one Apple sign in yields: a signed token, and an unsigned opinion. */
export type AppleCredential = { token: string; realUser: RealUser | null };

/**
 * Read the detection status, or null when Apple offered none.
 *
 * Apple reports this on the FIRST authorisation only, and it never travels in
 * the identity token -- so it is the app's word, and the server records it as
 * asserted rather than verified. Nothing here or there may treat `likely` as
 * permission for anything.
 */
function realUserFrom(status: AppleAuthentication.AppleAuthenticationUserDetectionStatus): RealUser | null {
    switch (status) {
        case AppleAuthentication.AppleAuthenticationUserDetectionStatus.LIKELY_REAL:
            return 'likely';
        case AppleAuthentication.AppleAuthenticationUserDetectionStatus.UNKNOWN:
            return 'unknown';
        case AppleAuthentication.AppleAuthenticationUserDetectionStatus.UNSUPPORTED:
            return 'unsupported';
        default:
            return null;
    }
}

/**
 * Whatever Apple gave as the reason, which is not always a message.
 */
function refusal(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    return 'Apple could not sign you in.';
}

/** Base64url, which is what PKCE and Apple both want and neither pads. */
function base64Url(value: string): string {
    return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** What one browser sign in yields: a spendable code, and the proof it is ours. */
export type AppleAuthorization = { code: string; verifier: string };

/**
 * Run Apple's browser sign in, and come back with a code the API will redeem.
 *
 * Android has no native Apple API, and Apple's browser flow cannot answer an app
 * directly: asking for the email scope forces `response_mode=form_post`, and a
 * form POST cannot target a custom scheme. So the server receives that POST,
 * parks the signed token, and redirects here with a one-time code.
 *
 * The verifier never leaves the app until the redemption call. Whoever intercepts
 * the redirect holds a code that hashes to nothing they can produce -- which is
 * the whole reason the token itself is not what comes back.
 */
export async function requestAppleAuthorization(): Promise<AppleAuthorization | null> {
    const bytes = await Crypto.getRandomBytesAsync(32);
    const verifier = base64Url(btoa(String.fromCharCode(...bytes)));
    const challenge = base64Url(
        await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
            encoding: Crypto.CryptoEncoding.BASE64,
        }),
    );

    const result = await WebBrowser.openAuthSessionAsync(
        `${API_URL}/auth/apple/app/redirect?code_challenge=${challenge}`,
        RETURN_URL,
    );

    // Closing the tab is a decision, not a failure, and reads the same as backing
    // out of the native sheet.
    if (result.type !== 'success') {
        return null;
    }

    const returned = new URL(result.url).searchParams;
    const code = returned.get('code');

    if (code === null) {
        if (returned.get('error') === 'cancelled') {
            return null;
        }

        throw new DisplayableError('Apple could not sign you in.');
    }

    return { code, verifier };
}

/**
 * Ask Apple for an identity token, which the API trades for a session.
 *
 * Unlike Google there is nothing to redeem: `signInAsync` returns a JWT Apple has
 * already signed, and the server verifies it against Apple's published keys. So
 * there is no authorization code, no exchange, and no client secret anywhere in
 * the app.
 */
export function useAppleSignIn(): {
    ready: boolean;
    requestToken: () => Promise<AppleCredential | null>;
} {
    const [available, setAvailable] = useState(false);

    useEffect(() => {
        // Only iOS has a device to ask. The module is iOS-only, so Android must
        // not reach it even to be told no.
        if (Platform.OS !== 'ios' || !appleIsConfigured()) {
            return;
        }

        let current = true;

        // Asked of the device rather than assumed: the entitlement says the build
        // may use Apple sign in, not that this device can. Guarded against a
        // screen that unmounts while the answer is still coming.
        AppleAuthentication.isAvailableAsync()
            .then((supported) => {
                if (current) {
                    setAvailable(supported);
                }
            })
            .catch(() => {
                if (current) {
                    setAvailable(false);
                }
            });

        return () => {
            current = false;
        };
    }, []);

    return {
        // Android has nothing to ask: the browser is always there, so the build
        // being configured is the whole answer.
        ready: Platform.OS === 'android' ? appleIsConfigured() : available,
        requestToken: async () => {
            let credential: AppleAuthentication.AppleAuthenticationCredential;

            try {
                credential = await AppleAuthentication.signInAsync({
                    // The name is asked for and then ignored: Apple sends it on
                    // the first authorisation only, never in the token, and an
                    // account keyed off something that arrives once is an account
                    // that breaks on reinstall. EnsureHasNickname asks instead.
                    requestedScopes: [
                        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                        AppleAuthentication.AppleAuthenticationScope.EMAIL,
                    ],
                });
            } catch (error) {
                // Backing out of the sheet is not a failure, and matches what
                // Google's cancel returns, so the caller shows nothing.
                if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
                    return null;
                }

                throw new DisplayableError(refusal(error));
            }

            if (!credential.identityToken) {
                throw new DisplayableError('Apple did not return an identity token.');
            }

            return {
                token: credential.identityToken,
                realUser: realUserFrom(credential.realUserStatus),
            };
        },
    };
}
