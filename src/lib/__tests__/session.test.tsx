import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { SessionProvider, useSession } from '../session';

const user = {
    id: 'u1',
    nickname: 'Mara',
    fullname: null,
    email: 'mara@example.com',
    email_verified: true,
    identification_verified: false,
    two_factor_enabled: false,
    administrator: false,
    created_at: '2026-01-01T00:00:00.000000Z',
};

function json(status: number, body: unknown) {
    return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const wrapper = ({ children }: { children: ReactNode }) => (
    <SessionProvider>{children}</SessionProvider>
);

/** Render the provider and wait for its bootstrap to settle. */
async function signedOutSession() {
    const view = renderHook(() => useSession(), { wrapper });

    await waitFor(() => expect(view.result.current.status).toBe('unauthenticated'));

    return view;
}

beforeEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = jest.fn().mockResolvedValue(json(401, { message: 'Unauthenticated.' })) as never;
});

describe('SessionProvider', () => {
    it('starts signed out when the device holds no token', async () => {
        const { result } = await signedOutSession();

        expect(result.current.status).toBe('unauthenticated');
    });

    it('signs in and keeps the user', async () => {
        const { result } = await signedOutSession();

        globalThis.fetch = jest
            .fn()
            .mockResolvedValue(json(200, { data: user, token: 't1', expires_at: null })) as never;

        await act(async () => {
            await result.current.login('mara@example.com', 'password');
        });

        expect(result.current.status).toBe('authenticated');
        expect(result.current.status === 'authenticated' && result.current.user.nickname).toBe('Mara');
    });

    it('stops at the challenge without signing in when a second factor is on', async () => {
        const { result } = await signedOutSession();

        globalThis.fetch = jest
            .fn()
            .mockResolvedValue(json(200, { two_factor: true, challenge_token: 'c1' })) as never;

        let outcome;

        await act(async () => {
            outcome = await result.current.login('mara@example.com', 'password');
        });

        expect(outcome).toEqual({ two_factor: true, challenge_token: 'c1' });
        expect(result.current.status).toBe('unauthenticated');
    });

    it('signs in once the challenge is cleared', async () => {
        const { result } = await signedOutSession();

        globalThis.fetch = jest
            .fn()
            .mockResolvedValue(json(200, { data: user, token: 't2', expires_at: null })) as never;

        await act(async () => {
            await result.current.completeTwoFactor('c1', '123456');
        });

        expect(result.current.status).toBe('authenticated');
    });

    it('refreshes an expired token and retries the call', async () => {
        const { result } = await signedOutSession();

        globalThis.fetch = jest
            .fn()
            .mockResolvedValue(json(200, { data: user, token: 't1', expires_at: null })) as never;

        await act(async () => {
            await result.current.login('mara@example.com', 'password');
        });

        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce(json(401, { message: 'Unauthenticated.' }))
            .mockResolvedValueOnce(json(200, { data: user, token: 't2', expires_at: null }))
            .mockResolvedValueOnce(json(200, { data: { ok: true } }));

        globalThis.fetch = fetchMock as never;

        let body;

        await act(async () => {
            body = await result.current.authenticatedRequest('/auth/user');
        });

        expect(body).toEqual({ data: { ok: true } });
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(result.current.status).toBe('authenticated');
    });

    it('signs out when the refresh is refused too', async () => {
        const { result } = await signedOutSession();

        globalThis.fetch = jest
            .fn()
            .mockResolvedValue(json(200, { data: user, token: 't1', expires_at: null })) as never;

        await act(async () => {
            await result.current.login('mara@example.com', 'password');
        });

        globalThis.fetch = jest.fn().mockResolvedValue(json(401, { message: 'Unauthenticated.' })) as never;

        await act(async () => {
            await result.current.authenticatedRequest('/auth/user').catch(() => undefined);
        });

        expect(result.current.status).toBe('unauthenticated');
    });

    it('signs out even when the server refuses the logout call', async () => {
        const { result } = await signedOutSession();

        globalThis.fetch = jest
            .fn()
            .mockResolvedValue(json(200, { data: user, token: 't1', expires_at: null })) as never;

        await act(async () => {
            await result.current.login('mara@example.com', 'password');
        });

        globalThis.fetch = jest.fn().mockRejectedValue(new Error('offline')) as never;

        await act(async () => {
            await result.current.logout();
        });

        expect(result.current.status).toBe('unauthenticated');
    });
});
