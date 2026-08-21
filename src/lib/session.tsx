import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { ApiError, DEVICE_NAME, request, type RequestMethod } from './api';
import { clearToken, readToken, writeToken } from './tokens';
import { isTwoFactorChallenge, type LoginResult, type TokenResponse, type User } from './types';

type SessionState =
    | { status: 'loading' }
    | { status: 'unauthenticated' }
    | { status: 'authenticated'; user: User };

type SessionValue = SessionState & {
    login: (email: string, password: string) => Promise<LoginResult>;
    signInWithGoogle: (accessToken: string) => Promise<LoginResult>;
    completeTwoFactor: (challengeToken: string, code: string, recoveryCode?: string) => Promise<void>;
    register: (fields: RegisterFields) => Promise<void>;
    logout: () => Promise<void>;
    reload: () => Promise<void>;
    authenticatedRequest: <T>(path: string, options?: AuthenticatedOptions) => Promise<T>;
};

type RegisterFields = {
    nickname: string;
    email: string;
    password: string;
    password_confirmation: string;
};

type AuthenticatedOptions = {
    method?: RequestMethod;
    body?: unknown;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<SessionState>({ status: 'loading' });
    const [token, setToken] = useState<string | null>(null);

    const adopt = useCallback(async (response: TokenResponse) => {
        await writeToken(response.token);
        setToken(response.token);
        setState({ status: 'authenticated', user: response.data });
    }, []);

    const forget = useCallback(async () => {
        await clearToken();
        setToken(null);
        setState({ status: 'unauthenticated' });
    }, []);

    /**
     * Trade the stored token for a fresh one. The server deletes the old one,
     * so a failure here means the device is signed out for good.
     */
    const refresh = useCallback(
        async (stored: string): Promise<string | null> => {
            try {
                const response = await request<TokenResponse>('/auth/tokens/refresh', {
                    method: 'POST',
                    token: stored,
                });

                await adopt(response);

                return response.token;
            } catch {
                await forget();

                return null;
            }
        },
        [adopt, forget],
    );

    /**
     * Work out what the stored token is still worth, without touching state.
     *
     * The caller applies the result, so nothing is set until the awaits have
     * settled and the provider is known to still be mounted.
     */
    const resolve = useCallback(async (): Promise<SessionState | 'refresh'> => {
        const stored = await readToken();

        if (!stored) {
            return { status: 'unauthenticated' };
        }

        try {
            const { data } = await request<{ data: User }>('/auth/user', { token: stored });

            setToken(stored);

            return { status: 'authenticated', user: data };
        } catch (error) {
            if (error instanceof ApiError && error.isUnauthenticated) {
                return 'refresh';
            }

            // A network failure is not a signed-out state, but there is nothing
            // to show until the app can reach the server, so ask for sign in.
            return { status: 'unauthenticated' };
        }
    }, []);

    useEffect(() => {
        let cancelled = false;

        void (async () => {
            const outcome = await resolve();

            if (cancelled) {
                return;
            }

            if (outcome === 'refresh') {
                const stored = await readToken();

                if (stored && !cancelled) {
                    await refresh(stored);
                }

                return;
            }

            setState(outcome);
        })();

        return () => {
            cancelled = true;
        };
    }, [refresh, resolve]);

    /** Call the API as the signed-in user, refreshing once if the token expired. */
    const authenticatedRequest = useCallback(
        async <T,>(path: string, options: AuthenticatedOptions = {}): Promise<T> => {
            if (!token) {
                throw new ApiError(401, 'Not signed in.');
            }

            try {
                return await request<T>(path, { ...options, token });
            } catch (error) {
                if (!(error instanceof ApiError) || !error.isUnauthenticated) {
                    throw error;
                }

                const fresh = await refresh(token);

                if (!fresh) {
                    throw error;
                }

                return await request<T>(path, { ...options, token: fresh });
            }
        },
        [refresh, token],
    );

    const login = useCallback(
        async (email: string, password: string): Promise<LoginResult> => {
            const result = await request<LoginResult>('/auth/login', {
                method: 'POST',
                body: { email, password, device_name: DEVICE_NAME },
            });

            if (!isTwoFactorChallenge(result)) {
                await adopt(result);
            }

            return result;
        },
        [adopt],
    );

    /**
     * Trade a provider access token for a session, opening an account if the
     * address is new. The server answers exactly as password login does, second
     * factor included, so the caller branches the same way.
     */
    const signInWithGoogle = useCallback(
        async (accessToken: string): Promise<LoginResult> => {
            const result = await request<LoginResult>('/auth/socials/google', {
                method: 'POST',
                body: { token: accessToken, device_name: DEVICE_NAME },
            });

            if (!isTwoFactorChallenge(result)) {
                await adopt(result);
            }

            return result;
        },
        [adopt],
    );

    const completeTwoFactor = useCallback(
        async (challengeToken: string, code: string, recoveryCode?: string) => {
            const response = await request<TokenResponse>('/auth/two-factor-challenge', {
                method: 'POST',
                body: {
                    challenge_token: challengeToken,
                    device_name: DEVICE_NAME,
                    ...(recoveryCode ? { recovery_code: recoveryCode } : { code }),
                },
            });

            await adopt(response);
        },
        [adopt],
    );

    const register = useCallback(
        async (fields: RegisterFields) => {
            const response = await request<TokenResponse>('/auth/register', {
                method: 'POST',
                body: { ...fields, device_name: DEVICE_NAME },
            });

            await adopt(response);
        },
        [adopt],
    );

    const logout = useCallback(async () => {
        try {
            if (token) {
                await request<void>('/auth/logout', { method: 'POST', token });
            }
        } catch {
            // The token may already be gone server-side; sign out regardless.
        } finally {
            await forget();
        }
    }, [forget, token]);

    const reload = useCallback(async () => {
        if (!token) {
            return;
        }

        const { data } = await authenticatedRequest<{ data: User }>('/auth/user');

        setState({ status: 'authenticated', user: data });
    }, [authenticatedRequest, token]);

    const value = useMemo<SessionValue>(
        () => ({ ...state, login, signInWithGoogle, completeTwoFactor, register, logout, reload, authenticatedRequest }),
        [authenticatedRequest, completeTwoFactor, login, logout, register, reload, signInWithGoogle, state],
    );

    return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
    const session = useContext(SessionContext);

    if (!session) {
        throw new Error('useSession must be used inside a SessionProvider.');
    }

    return session;
}
