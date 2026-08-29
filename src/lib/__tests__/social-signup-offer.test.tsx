import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { SessionProvider, useSession } from '@/lib/session';
import { isSignupOffer, type LoginResult } from '@/lib/types';

jest.mock('@/lib/tokens', () => ({
    readToken: jest.fn(async () => null),
    writeToken: jest.fn(async () => undefined),
    clearToken: jest.fn(async () => undefined),
}));

jest.mock('@/lib/push', () => ({
    syncPushRegistration: jest.fn(async () => undefined),
    dropPushRegistration: jest.fn(async () => undefined),
}));

const account = {
    id: 'u1',
    nickname: 'Juan',
    fullname: null,
    phone: null,
    avatar: false,
    email: 'juan@gmail.test',
    email_verified: true,
    identification_verified: false,
    two_factor_enabled: false,
    has_password: false,
    administrator: false,
    created_at: '2026-01-01T00:00:00.000000Z',
};

/**
 * Answer the social door with the offer first, then a session once the intent
 * says register -- which is what the server does with the very same token.
 */
function serveOfferThenAccount(bodies: string[]) {
    // @ts-expect-error -- the test replaces the global fetch
    global.fetch = jest.fn(async (url: string, init?: { body?: string }) => {
        if (url.endsWith('/auth/user')) {
            return { ok: false, status: 401, json: async () => ({}) };
        }

        const body = init?.body ?? '{}';

        bodies.push(body);

        if (JSON.parse(body).intent === 'register') {
            return {
                ok: true,
                status: 201,
                json: async () => ({ data: account, token: 'a-token', expires_at: null }),
            };
        }

        return {
            ok: false,
            status: 404,
            json: async () => ({
                message: 'No account here uses this Google account.',
                signup: { provider: 'google', label: 'Google', email: 'juan@gmail.test' },
            }),
        };
    });
}

function session() {
    return renderHook(() => useSession(), {
        wrapper: ({ children }: { children: ReactNode }) => (
            <SessionProvider>{children}</SessionProvider>
        ),
    });
}

it('turns the refusal into an offer instead of throwing', async () => {
    const bodies: string[] = [];

    serveOfferThenAccount(bodies);

    const { result } = session();

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    let answer: LoginResult | undefined;

    await act(async () => {
        answer = await result.current.signInWithGoogle('an-access-token');
    });

    expect(isSignupOffer(answer!)).toBe(true);
    expect(result.current.status).toBe('unauthenticated');
});

it('accepts the offer with the same token and no second trip to the provider', async () => {
    const bodies: string[] = [];

    serveOfferThenAccount(bodies);

    const { result } = session();

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    await act(async () => {
        await result.current.signInWithGoogle('an-access-token');
    });

    await act(async () => {
        await result.current.signInWithGoogle('an-access-token', 'register');
    });

    expect(result.current.status).toBe('authenticated');

    const posted = bodies.map((body) => JSON.parse(body));

    expect(posted).toHaveLength(2);
    expect(posted[0].token).toBe('an-access-token');
    expect(posted[0].intent).toBeUndefined();
    expect(posted[1].token).toBe('an-access-token');
    expect(posted[1].intent).toBe('register');
});

it('leaves a genuine failure a failure', async () => {
    // @ts-expect-error -- the test replaces the global fetch
    global.fetch = jest.fn(async (url: string) =>
        url.endsWith('/auth/user')
            ? { ok: false, status: 401, json: async () => ({}) }
            : {
                  ok: false,
                  status: 404,
                  json: async () => ({ message: 'Not found.' }),
              },
    );

    const { result } = session();

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    await expect(result.current.signInWithGoogle('an-access-token')).rejects.toThrow('Not found.');
});

it('spends the code the offer handed back, not the one it replaced', async () => {
    const bodies: string[] = [];

    // @ts-expect-error -- the test replaces the global fetch
    global.fetch = jest.fn(async (url: string, init?: { body?: string }) => {
        if (url.endsWith('/auth/user')) {
            return { ok: false, status: 401, json: async () => ({}) };
        }

        const body = init?.body ?? '{}';

        bodies.push(body);

        if (JSON.parse(body).intent === 'register') {
            return {
                ok: true,
                status: 201,
                json: async () => ({ data: account, token: 'a-token', expires_at: null }),
            };
        }

        return {
            ok: false,
            status: 404,
            json: async () => ({
                message: 'No account here uses this Apple account.',
                signup: {
                    provider: 'apple',
                    label: 'Apple',
                    email: 'juan@privaterelay.appleid.test',
                    code: 'a-fresh-code',
                },
            }),
        };
    });

    const { result } = session();

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    let offered: LoginResult | undefined;

    await act(async () => {
        offered = await result.current.redeemAppleCode('a-spent-code', 'a-verifier');
    });

    expect(isSignupOffer(offered!) && offered.signup.code).toBe('a-fresh-code');

    await act(async () => {
        await result.current.redeemAppleCode('a-fresh-code', 'a-verifier', 'register');
    });

    expect(result.current.status).toBe('authenticated');
    expect(JSON.parse(bodies[1]).code).toBe('a-fresh-code');
});
