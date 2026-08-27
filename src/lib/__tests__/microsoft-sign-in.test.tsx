import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { SessionProvider, useSession } from '../session';

const user = {
    id: 'u1',
    nickname: 'Mara',
    fullname: null,
    phone: null,
    avatar: false,
    email: 'mara@example.com',
    // Entra emits no email_verified, on any endpoint, so a Microsoft signup
    // arrives unverified where a Google one does not.
    email_verified: false,
    identification_verified: false,
    two_factor_enabled: false,
    has_password: false,
    administrator: false,
    created_at: '2026-01-01T00:00:00.000000Z',
};

function json(status: number, body: unknown) {
    return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const wrapper = ({ children }: { children: ReactNode }) => (
    <SessionProvider>{children}</SessionProvider>
);

// The secure-store stand-in is one Map for the whole file, so a token adopted
// by one test would sign the next one in before it started.
beforeEach(() => {
    (jest.requireMock('expo-secure-store').__store as Map<string, string>).clear();
});

it('posts the identity token to the microsoft door', async () => {
    const fetched: string[] = [];

    // @ts-expect-error -- the test replaces the global fetch
    global.fetch = jest.fn(async (url: string) => {
        fetched.push(url);

        return url.endsWith('/auth/user')
            ? json(401, {})
            : json(201, { data: user, token: 'a-token', expires_at: null });
    });

    const { result } = renderHook(() => useSession(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    await act(async () => {
        await result.current.signInWithMicrosoft('a-microsoft-id-token');
    });

    expect(result.current.status).toBe('authenticated');
    expect(fetched.some((url) => url.endsWith('/auth/socials/microsoft'))).toBe(true);
});

it('stops on the second factor instead of adopting a session', async () => {
    // @ts-expect-error -- the test replaces the global fetch
    global.fetch = jest.fn(async (url: string) =>
        url.endsWith('/auth/user')
            ? json(401, {})
            : json(200, { two_factor: true, challenge_token: 'a-challenge' }),
    );

    const { result } = renderHook(() => useSession(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    let outcome: unknown;

    await act(async () => {
        outcome = await result.current.signInWithMicrosoft('a-microsoft-id-token');
    });

    expect(outcome).toMatchObject({ two_factor: true, challenge_token: 'a-challenge' });
    expect(result.current.status).toBe('unauthenticated');
});
