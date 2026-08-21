import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { get } from 'react-native-passkeys';

import { SessionProvider, useSession } from '../session';

const user = {
    id: 'u1',
    nickname: 'Mara',
    fullname: null,
    phone: null,
    avatar: false,
    email: 'mara@example.com',
    email_verified: true,
    identification_verified: false,
    two_factor_enabled: false,
    has_password: false,
    administrator: false,
    created_at: '2026-01-01T00:00:00.000000Z',
};

const ceremony = { challenge_token: 'a-challenge', options: { challenge: 'abc', rpId: 'paayo.test' } };
const credential = { id: 'cred', rawId: 'cred', type: 'public-key', response: {} };

function json(status: number, body: unknown) {
    return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const wrapper = ({ children }: { children: ReactNode }) => (
    <SessionProvider>{children}</SessionProvider>
);

beforeEach(() => {
    (jest.requireMock('expo-secure-store').__store as Map<string, string>).clear();
    jest.mocked(get).mockReset();
});

/**
 * @param answer What the platform's sheet resolves with.
 */
function serverAnswering(answer: unknown) {
    jest.mocked(get).mockResolvedValue(answer as never);

    const fetched: { url: string; body: unknown }[] = [];

    // @ts-expect-error -- the test replaces the global fetch
    global.fetch = jest.fn(async (url: string, init?: { body?: string }) => {
        fetched.push({ url, body: init?.body ? JSON.parse(init.body) : undefined });

        if (url.endsWith('/auth/user')) {
            return json(401, {});
        }

        return url.endsWith('/auth/passkeys/login/options')
            ? json(200, ceremony)
            : json(200, { data: user, token: 'a-token', expires_at: null });
    });

    return fetched;
}

it('answers the ceremony the server opened and signs in', async () => {
    const fetched = serverAnswering(credential);

    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    await act(async () => {
        await result.current.signInWithPasskey();
    });

    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    // The challenge token goes back with the credential: the server parked the
    // ceremony behind it and cannot find it again otherwise.
    const login = fetched.find((call) => call.url.endsWith('/auth/passkeys/login'));

    expect(login?.body).toMatchObject({
        challenge_token: 'a-challenge',
        credential,
    });
});

it('says nothing when the sheet is dismissed', async () => {
    serverAnswering(null);

    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    await act(async () => {
        expect(await result.current.signInWithPasskey()).toBeNull();
    });

    expect(result.current.status).toBe('unauthenticated');
});
