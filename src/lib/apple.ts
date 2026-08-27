import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { DisplayableError } from './api';

/**
 * Whether this build could offer Apple sign in at all.
 *
 * Two gates, both about the build rather than the account. iOS only, because
 * there is no native Apple API on Android and the web redirect flow it would
 * otherwise need has no Services ID or client secret behind it. And a paid
 * membership, without which the build carries no `com.apple.developer.applesignin`
 * entitlement and the sheet could only fail -- the same pairing passkeys and push
 * are gated on.
 *
 * Deliberately synchronous, so a screen can decide whether to render anything
 * before asking the platform whether the feature is available on this device.
 */
export function appleIsConfigured(): boolean {
    if (Platform.OS !== 'ios') {
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
        if (!appleIsConfigured()) {
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
        ready: available,
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
