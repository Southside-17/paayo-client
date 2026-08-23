import { isSupported } from 'react-native-passkeys';

/**
 * Read the gate with the environment a build would have been given.
 *
 * @param env What to set, or delete where the value is undefined.
 */
function supportedGiven(env: Record<string, string | undefined>): boolean {
    const held = { ...process.env };
    let answer = false;

    for (const [key, value] of Object.entries(env)) {
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }

    jest.isolateModules(() => {
        // Static import would bind once, before any of this was set.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        answer = require('../passkey').passkeysAreSupported();
    });

    process.env = held;

    return answer;
}

beforeEach(() => jest.mocked(isSupported).mockReturnValue(true));

// Jest reports iOS, which is the platform the entitlement gate applies to.
it('is offered when the build has a domain and the iOS entitlement', () => {
    expect(supportedGiven({})).toBe(true);
});

it('is refused with no domain to bind a passkey to', () => {
    expect(supportedGiven({ EXPO_PUBLIC_PASSKEY_RP_ID: undefined })).toBe(false);
});

// The free Personal Team case: Associated Domains is a paid capability, so the
// build carries no entitlement and every ceremony would fail at the sheet.
it('is refused on iOS when the build cannot claim the domain', () => {
    expect(supportedGiven({ EXPO_PUBLIC_PASSKEY_IOS: undefined })).toBe(false);
});

it('is refused on a device too old to hold one', () => {
    jest.mocked(isSupported).mockReturnValue(false);

    expect(supportedGiven({})).toBe(false);
});
