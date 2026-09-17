import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { stopWatching } from '../geofence';
import { SessionProvider, useSession } from '../session';

jest.mock('../geofence', () => ({ stopWatching: jest.fn(async () => undefined) }));

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
    has_password: true,
    administrator: false,
    created_at: '2026-01-01T00:00:00.000000Z',
};

/** The in-memory stand-in jest.setup.js gives expo-secure-store. */
function store(): Map<string, string> {
    return (jest.requireMock('expo-secure-store') as { __store: Map<string, string> }).__store;
}

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
    store().clear();
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

    it('shares one refresh between concurrent calls that met a 401', async () => {
        const { result } = await signedOutSession();

        globalThis.fetch = jest
            .fn()
            .mockResolvedValue(json(200, { data: user, token: 't1', expires_at: null })) as never;

        await act(async () => {
            await result.current.login('mara@example.com', 'password');
        });

        const fetchMock = jest.fn(async (url: string, init: RequestInit) => {
            const bearer = (init.headers as Record<string, string>).Authorization;

            if (url.endsWith('/auth/tokens/refresh')) {
                return json(200, { data: user, token: 't2', expires_at: null });
            }

            return bearer === 'Bearer t2'
                ? json(200, { data: { path: url.slice(url.lastIndexOf('/')) } })
                : json(401, { message: 'Unauthenticated.' });
        });

        globalThis.fetch = fetchMock as never;

        let bodies: unknown[] = [];

        await act(async () => {
            bodies = await Promise.all([
                result.current.authenticatedRequest('/bookings'),
                result.current.authenticatedRequest('/enquiries'),
            ]);
        });

        expect(bodies).toEqual([{ data: { path: '/bookings' } }, { data: { path: '/enquiries' } }]);

        const refreshes = fetchMock.mock.calls.filter(([url]) => url.endsWith('/auth/tokens/refresh'));

        expect(refreshes).toHaveLength(1);
        expect(fetchMock).toHaveBeenCalledTimes(5);
        expect(result.current.status).toBe('authenticated');
        expect(result.current.token).toBe('t2');
    });

    it('keeps the token when the refresh fails for want of a network', async () => {
        const { result } = await signedOutSession();

        globalThis.fetch = jest
            .fn()
            .mockResolvedValue(json(200, { data: user, token: 't1', expires_at: null })) as never;

        await act(async () => {
            await result.current.login('mara@example.com', 'password');
        });

        globalThis.fetch = jest
            .fn()
            .mockResolvedValueOnce(json(401, { message: 'Unauthenticated.' }))
            .mockRejectedValueOnce(new TypeError('Network request failed')) as never;

        let failure: unknown;

        await act(async () => {
            failure = await result.current.authenticatedRequest('/auth/user').catch((error) => error);
        });

        expect(failure).toBeInstanceOf(TypeError);
        expect(result.current.status).toBe('authenticated');
        expect(result.current.token).toBe('t1');
        expect(store().get('paayo.token')).toBe('t1');
    });

    it('starts offline rather than signed out when the stored token cannot be checked', async () => {
        store().set('paayo.token', 't0');
        globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as never;

        const { result } = renderHook(() => useSession(), { wrapper });

        await waitFor(() => expect(result.current.status).toBe('offline'));

        expect(store().get('paayo.token')).toBe('t0');

        globalThis.fetch = jest.fn().mockResolvedValue(json(200, { data: user })) as never;

        await act(async () => {
            await result.current.retry();
        });

        expect(result.current.status).toBe('authenticated');
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

    // A fence is the crew's, not the phone's: nobody else signing in on this
    // device should have their arrival reported for a job they are not on.
    it('drops any arrival fence on sign out', async () => {
        const { result } = await signedOutSession();

        globalThis.fetch = jest
            .fn()
            .mockResolvedValue(json(200, { data: user, token: 't1', expires_at: null })) as never;

        await act(async () => {
            await result.current.login('mara@example.com', 'password');
        });

        jest.mocked(stopWatching).mockClear();

        await act(async () => {
            await result.current.logout();
        });

        expect(stopWatching).toHaveBeenCalledTimes(1);
        expect(result.current.status).toBe('unauthenticated');
    });
});
