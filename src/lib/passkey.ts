import { Platform } from 'react-native';
import { create, get, isSupported } from 'react-native-passkeys';

import { DisplayableError, request } from './api';

/**
 * The options the server hands over, already in the shape WebAuthn speaks.
 */
type Ceremony = { challenge_token: string; options: Record<string, unknown> };

/** What the server needs back to close a ceremony it opened. */
export type PasskeyAnswer = { challenge_token: string; credential: unknown };

/**
 * Whether this build can hold a passkey at all.
 *
 * Two gates. A domain to bind to, which both platforms need -- the server
 * decides the relying party, so this only says whether to offer the sheet. And
 * on iOS a paid Apple Developer Program membership, without which the build
 * carries no Associated Domains entitlement and the sheet could only fail.
 * Android needs no membership.
 */
export function passkeysAreSupported(): boolean {
    if (!process.env.EXPO_PUBLIC_PASSKEY_DOMAIN) {
        return false;
    }

    if (Platform.OS === 'ios' && !process.env.EXPO_PUBLIC_APPLE_DEVELOPER_PROGRAM) {
        return false;
    }

    return isSupported();
}

/**
 * Ask the platform to answer a ceremony the server opened.
 */
async function answer(
    ceremony: Ceremony,
    ask: (options: never) => Promise<unknown | null>,
): Promise<PasskeyAnswer | null> {
    let credential: unknown;

    try {
        credential = await ask(ceremony.options as never);
    } catch (error) {
        throw new DisplayableError(
            error instanceof Error ? error.message : 'That passkey could not be used.',
        );
    }

    return credential === null || credential === undefined
        ? null
        : { challenge_token: ceremony.challenge_token, credential };
}

/** Answer a sign-in ceremony. Null means the sheet was dismissed. */
export async function passkeyAssertion(): Promise<PasskeyAnswer | null> {
    return answer(await request<Ceremony>('/auth/passkeys/login/options'), get);
}

/**
 * Answer a ceremony that adds a passkey to the signed in account.
 */
export async function passkeyAttestation(
    authenticatedRequest: <T>(path: string) => Promise<T>,
): Promise<PasskeyAnswer | null> {
    return answer(await authenticatedRequest<Ceremony>('/auth/passkeys/options'), create);
}
