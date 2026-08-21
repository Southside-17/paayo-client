import { Platform } from 'react-native';
import { create, get, isSupported } from 'react-native-passkeys';

import { DisplayableError, request } from './api';

/**
 * The options the server hands over, already in the shape WebAuthn speaks.
 *
 * They are passed to the platform untouched: `WebAuthn::toBrowserArray()` emits
 * exactly the JSON form both `create` and `get` take, so restating the shape
 * here would only be somewhere for it to drift.
 */
type Ceremony = { challenge_token: string; options: Record<string, unknown> };

/** What the server needs back to close a ceremony it opened. */
export type PasskeyAnswer = { challenge_token: string; credential: unknown };

/**
 * Whether this build can hold a passkey at all.
 *
 * Three things have to be true, and only the first is about the phone. There
 * must be a domain to bind one to, or every ceremony is refused. And on iOS the
 * app must carry the Associated Domains entitlement, which is a paid Apple
 * Developer Program capability -- a build signed by a free Personal Team cannot
 * have it, so the buttons stay hidden rather than opening a sheet that fails.
 */
export function passkeysAreSupported(): boolean {
    if (!process.env.EXPO_PUBLIC_PASSKEY_RP_ID) {
        return false;
    }

    if (Platform.OS === 'ios' && !process.env.EXPO_PUBLIC_PASSKEY_IOS) {
        return false;
    }

    return isSupported();
}

/**
 * Ask the platform to answer a ceremony the server opened.
 *
 * A null answer is the person dismissing the sheet, which is a decision and not
 * a failure -- the same contract Google sign-in follows. A refusal arrives as a
 * thrown error whose message was written to be read, so it is passed through
 * rather than replaced with the generic connection wording.
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
 *
 * It takes the caller's request function because opening this one needs the
 * token, and the module deliberately holds no session of its own.
 */
export async function passkeyAttestation(
    authenticatedRequest: <T>(path: string) => Promise<T>,
): Promise<PasskeyAnswer | null> {
    return answer(await authenticatedRequest<Ceremony>('/auth/passkeys/options'), create);
}
