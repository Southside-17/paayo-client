import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import type { ReactNode } from 'react';

import { useAppleSignIn } from '../apple';
import { SessionProvider, useSession } from '../session';

/**
 * Read the gate with the environment a build would have been given.
 *
 * @param env What to set, or delete where the value is undefined.
 */
function configuredGiven(env: Record<string, string | undefined>): boolean {
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
        answer = require('../apple').appleIsConfigured();
    });

    process.env = held;

    return answer;
}

beforeEach(() => {
    jest.mocked(AppleAuthentication.isAvailableAsync).mockResolvedValue(true);
});

// Jest reports iOS, which is the only platform this is offered on.
it('is configured when the build was signed by a paid Apple membership', () => {
    expect(configuredGiven({})).toBe(true);
});

// The free Personal Team case, and the one that must not break a teammate's
// build: with no membership the entitlement is stripped at prebuild, so the sheet
// could only fail and the button must not be there to press.
it('is not configured without the Apple Developer Program', () => {
    expect(configuredGiven({ EXPO_PUBLIC_APPLE_DEVELOPER_PROGRAM: undefined })).toBe(false);
});

it('is ready once the device says it can offer the sheet', async () => {
    const { result } = renderHook(() => useAppleSignIn());

    await waitFor(() => expect(result.current.ready).toBe(true));
});

it('is not ready on a device that cannot offer the sheet', async () => {
    jest.mocked(AppleAuthentication.isAvailableAsync).mockResolvedValue(false);

    const { result } = renderHook(() => useAppleSignIn());

    await waitFor(() => expect(AppleAuthentication.isAvailableAsync).toHaveBeenCalled());

    expect(result.current.ready).toBe(false);
});

it.each([
    [AppleAuthentication.AppleAuthenticationUserDetectionStatus.LIKELY_REAL, 'likely'],
    [AppleAuthentication.AppleAuthenticationUserDetectionStatus.UNKNOWN, 'unknown'],
    [AppleAuthentication.AppleAuthenticationUserDetectionStatus.UNSUPPORTED, 'unsupported'],
])('hands back the token and translates status %i into %s', async (status, expected) => {
    jest.mocked(AppleAuthentication.signInAsync).mockResolvedValue({
        identityToken: 'an-identity-token',
        authorizationCode: 'a-code',
        user: 'apple-sub',
        email: null,
        fullName: null,
        realUserStatus: status,
        state: null,
    } as Awaited<ReturnType<typeof AppleAuthentication.signInAsync>>);

    const { result } = renderHook(() => useAppleSignIn());

    await waitFor(() => expect(result.current.ready).toBe(true));

    // Apple's 0/1/2 is translated here so the API never sees the numbering.
    await expect(result.current.requestToken()).resolves.toEqual({
        token: 'an-identity-token',
        realUser: expected,
    });
});

it('answers null when the sheet is dismissed', async () => {
    jest.mocked(AppleAuthentication.signInAsync).mockRejectedValue(
        Object.assign(new Error('The user canceled the authorization attempt.'), {
            code: 'ERR_REQUEST_CANCELED',
        }),
    );

    const { result } = renderHook(() => useAppleSignIn());

    await waitFor(() => expect(result.current.ready).toBe(true));

    await expect(result.current.requestToken()).resolves.toBeNull();
});

it('refuses a credential carrying no identity token', async () => {
    jest.mocked(AppleAuthentication.signInAsync).mockResolvedValue({
        identityToken: null,
        authorizationCode: 'a-code',
        user: 'apple-sub',
        email: null,
        fullName: null,
        realUserStatus: 1,
        state: null,
    } as Awaited<ReturnType<typeof AppleAuthentication.signInAsync>>);

    const { result } = renderHook(() => useAppleSignIn());

    await waitFor(() => expect(result.current.ready).toBe(true));

    await expect(result.current.requestToken()).rejects.toThrow('identity token');
});

it('reports what Apple refused with', async () => {
    jest.mocked(AppleAuthentication.signInAsync).mockRejectedValue(
        new Error('Apple sign in is not available.'),
    );

    const { result } = renderHook(() => useAppleSignIn());

    await waitFor(() => expect(result.current.ready).toBe(true));

    await expect(result.current.requestToken()).rejects.toThrow('Apple sign in is not available.');
});

it('trades the identity token at the apple endpoint rather than at Google\'s', async () => {
    const calls: string[] = [];
    const bodies: string[] = [];

    // @ts-expect-error -- the test replaces the global fetch
    global.fetch = jest.fn(async (url: string, init?: { body?: string }) => {
        calls.push(url);

        if (init?.body) {
            bodies.push(init.body);
        }

        return url.endsWith('/auth/user')
            ? { ok: false, status: 401, json: async () => ({}) }
            : {
                  ok: true,
                  status: 201,
                  json: async () => ({
                      data: {
                          id: 'u1',
                          nickname: '',
                          fullname: null,
                          phone: null,
                          avatar: false,
                          email: 'juan@privaterelay.appleid.com',
                          email_verified: true,
                          identification_verified: false,
                          two_factor_enabled: false,
                          has_password: false,
                          administrator: false,
                          created_at: '2026-01-01T00:00:00.000000Z',
                      },
                      token: 'a-token',
                      expires_at: null,
                  }),
              };
    });

    const { result } = renderHook(() => useSession(), {
        wrapper: ({ children }: { children: ReactNode }) => (
            <SessionProvider>{children}</SessionProvider>
        ),
    });

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    await act(async () => {
        await result.current.signInWithApple('an-identity-token', 'likely');
    });

    expect(result.current.status).toBe('authenticated');
    expect(calls.some((url) => url.endsWith('/auth/socials/apple'))).toBe(true);
    expect(bodies.some((body) => JSON.parse(body).real_user === 'likely')).toBe(true);
});
