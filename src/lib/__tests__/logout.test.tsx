import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import type { ReactNode } from 'react';

import { dropPushRegistration } from '@/lib/push';
import { SessionProvider, useSession } from '@/lib/session';

jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(async () => 'a-stored-token'),
    setItemAsync: jest.fn(async () => undefined),
    deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock('@/lib/push', () => ({
    syncPushRegistration: jest.fn(async () => undefined),
    dropPushRegistration: jest.fn(async () => undefined),
    registerJobActions: jest.fn(async () => undefined),
    JOB_ACTIONS: {},
}));

const account = {
    id: 'u1',
    nickname: 'Juan',
    fullname: null,
    phone: null,
    avatar: false,
    email: 'juan@example.test',
    email_verified: true,
    identification_verified: false,
    two_factor_enabled: false,
    has_password: false,
    administrator: false,
    created_at: '2026-01-01T00:00:00.000000Z',
};

beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('a-stored-token');
    jest.mocked(SecureStore.deleteItemAsync).mockResolvedValue(undefined);
    jest.mocked(dropPushRegistration).mockResolvedValue(undefined);

    // @ts-expect-error -- the test replaces the global fetch
    global.fetch = jest.fn(async (url: string) =>
        url.endsWith('/auth/user')
            ? { ok: true, status: 200, json: async () => ({ data: account }) }
            : { ok: true, status: 204, json: async () => ({}) },
    );
});

function session() {
    return renderHook(() => useSession(), {
        wrapper: ({ children }: { children: ReactNode }) => (
            <SessionProvider>{children}</SessionProvider>
        ),
    });
}

it('signs out', async () => {
    const { result } = session();

    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await act(async () => {
        await result.current.logout();
    });

    expect(result.current.status).toBe('unauthenticated');
});

// A keychain that refuses to delete used to escape logout()'s `finally`, and
// every caller discards that promise -- so the rejection was silent and the
// person stayed signed in pressing a button that did nothing.
it('signs out even when the keychain refuses to forget the token', async () => {
    jest.mocked(SecureStore.deleteItemAsync).mockRejectedValue(
        new Error('The user name or passphrase you entered is not correct.'),
    );

    const { result } = session();

    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await act(async () => {
        await result.current.logout();
    });

    expect(result.current.status).toBe('unauthenticated');
});

// The failure no catch can see: a request, or a native promise, that never
// answers. Awaiting it kept somebody signed in with no error to show for it.
it('signs out without waiting for a network call that never answers', async () => {
    // @ts-expect-error -- the test replaces the global fetch
    global.fetch = jest.fn(async (url: string) =>
        url.endsWith('/auth/user')
            ? { ok: true, status: 200, json: async () => ({ data: account }) }
            : new Promise(() => undefined),
    );

    const { result } = session();

    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await act(async () => {
        await result.current.logout();
    });

    expect(result.current.status).toBe('unauthenticated');
});

it('signs out without waiting for the push registration to be dropped', async () => {
    jest.mocked(dropPushRegistration).mockReturnValue(new Promise(() => undefined));

    const { result } = session();

    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await act(async () => {
        await result.current.logout();
    });

    expect(result.current.status).toBe('unauthenticated');
});

it('signs out when the server refuses the logout call', async () => {
    // @ts-expect-error -- the test replaces the global fetch
    global.fetch = jest.fn(async (url: string) =>
        url.endsWith('/auth/user')
            ? { ok: true, status: 200, json: async () => ({ data: account }) }
            : { ok: false, status: 500, json: async () => ({ message: 'Server error.' }) },
    );

    const { result } = session();

    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await act(async () => {
        await result.current.logout();
    });

    expect(result.current.status).toBe('unauthenticated');
});
