import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { ApiError, DEVICE_NAME, request, type RequestMethod } from './api';
import { passkeyAssertion } from './passkey';
import { dropPushRegistration, syncPushRegistration } from './push';
import { clearToken, readToken, writeToken } from './tokens';
import {
    isSignupOffer,
    isTwoFactorChallenge,
    type LoginResult,
    type SignupOffer,
    type SocialIntent,
    type TokenResponse,
    type User,
} from './types';

type SessionState =
    | { status: 'loading' }
    | { status: 'unauthenticated' }
    | { status: 'authenticated'; user: User };

type SessionValue = SessionState & {
    /** The bearer token, for the one thing fetch cannot carry: an image URL. */
    token: string | null;
    login: (email: string, password: string) => Promise<LoginResult>;
    signInWithGoogle: (accessToken: string, intent?: SocialIntent) => Promise<LoginResult>;
    /** Apple hands over a signed identity token, not an access token. */
    signInWithApple: (
        identityToken: string,
        realUser?: string | null,
        name?: string | null,
        intent?: SocialIntent,
    ) => Promise<LoginResult>;
    /** Microsoft hands over one too; nothing will describe its access tokens. */
    signInWithMicrosoft: (identityToken: string, intent?: SocialIntent) => Promise<LoginResult>;
    redeemAppleCode: (code: string, verifier: string, intent?: SocialIntent) => Promise<LoginResult>;
    signInWithPasskey: () => Promise<LoginResult | null>;
    completeTwoFactor: (challengeToken: string, code: string, recoveryCode?: string) => Promise<void>;
    register: (fields: RegisterFields) => Promise<void>;
    logout: () => Promise<void>;
    reload: () => Promise<User | null>;
    authenticatedRequest: <T>(path: string, options?: AuthenticatedOptions) => Promise<T>;
};

type RegisterFields = {
    nickname: string;
    email: string;
    password: string;
    password_confirmation: string;
    accepted: boolean;
};

type AuthenticatedOptions = {
    method?: RequestMethod;
    body?: unknown;
};

const SessionContext = createContext<SessionValue | null>(null);

/**
 * Read a signup offer out of the 404 an unknown provider account is refused with.
 *
 * request() throws on every non-2xx, so the one answer on these doors that is
 * not a failure arrives as one and has to be turned back into a result.
 */
function offerFrom(error: unknown): SignupOffer | null {
    if (!(error instanceof ApiError) || error.status !== 404) {
        return null;
    }

    const signup = error.payload?.signup;

    return signup !== null && typeof signup === 'object'
        ? ({ signup } as SignupOffer)
        : null;
}

/** Rethrow in expression position, so a real failure stays a failure. */
function raise(error: unknown): never {
    throw error;
}

export function SessionProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<SessionState>({ status: 'loading' });
    const [token, setToken] = useState<string | null>(null);

    const adopt = useCallback(async (response: TokenResponse) => {
        await writeToken(response.token);
        setToken(response.token);
        setState({ status: 'authenticated', user: response.data });

        void syncPushRegistration(response.token);
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

    /**
     * Adopt what came back, unless it is one of the answers that is not a session.
     */
    const settle = useCallback(
        async (result: LoginResult): Promise<LoginResult> => {
            if (!isTwoFactorChallenge(result) && !isSignupOffer(result)) {
                await adopt(result);
            }

            return result;
        },
        [adopt],
    );

    const login = useCallback(
        async (email: string, password: string): Promise<LoginResult> =>
            settle(
                await request<LoginResult>('/auth/login', {
                    method: 'POST',
                    body: { email, password, device_name: DEVICE_NAME },
                }),
            ),
        [settle],
    );

    /**
     * Trade a provider access token for a session, opening an account if the
     * address is new. The server answers exactly as password login does, second
     * factor included, so the caller branches the same way.
     */
    const signInWithPasskey = useCallback(async (): Promise<LoginResult | null> => {
        const answered = await passkeyAssertion();

        if (answered === null) {
            return null;
        }

        return settle(
            await request<LoginResult>('/auth/passkeys/login', {
                method: 'POST',
                body: { ...answered, device_name: DEVICE_NAME },
            }),
        );
    }, [settle]);

    // One implementation for every provider, because what follows the exchange
    // -- the two factor branch and adopting the session -- must not drift between
    // them. What differs is only which kind of token the platform handed over,
    // and the server knows that from the provider in the path.
    const signInWithSocial = useCallback(
        async (
            provider: 'google' | 'apple' | 'microsoft',
            token: string,
            extra: Record<string, string> = {},
        ): Promise<LoginResult> => {
            try {
                return await settle(
                    await request<LoginResult>(`/auth/socials/${provider}`, {
                        method: 'POST',
                        body: { token, device_name: DEVICE_NAME, ...extra },
                    }),
                );
            } catch (error) {
                return offerFrom(error) ?? raise(error);
            }
        },
        [settle],
    );

    const signInWithGoogle = useCallback(
        (accessToken: string, intent?: SocialIntent): Promise<LoginResult> =>
            signInWithSocial('google', accessToken, intent ? { intent } : {}),
        [signInWithSocial],
    );

    const signInWithApple = useCallback(
        // Sent only when Apple offered them, which is the first sign in alone.
        (
            identityToken: string,
            realUser?: string | null,
            name?: string | null,
            intent?: SocialIntent,
        ): Promise<LoginResult> =>
            signInWithSocial('apple', identityToken, {
                ...(realUser ? { real_user: realUser } : {}),
                ...(name ? { name } : {}),
                ...(intent ? { intent } : {}),
            }),
        [signInWithSocial],
    );

    const signInWithMicrosoft = useCallback(
        (identityToken: string, intent?: SocialIntent): Promise<LoginResult> =>
            signInWithSocial('microsoft', identityToken, intent ? { intent } : {}),
        [signInWithSocial],
    );

    // The browser flow's ending. What it redeems is a code rather than a token,
    // but what comes back is the same union, so the two factor branch and
    // adopting the session are the ones above and not a second copy.
    const redeemAppleCode = useCallback(
        async (code: string, verifier: string, intent?: SocialIntent): Promise<LoginResult> => {
            try {
                return await settle(
                    await request<LoginResult>('/auth/socials/apple/redemption', {
                        method: 'POST',
                        body: {
                            code,
                            code_verifier: verifier,
                            device_name: DEVICE_NAME,
                            ...(intent ? { intent } : {}),
                        },
                    }),
                );
            } catch (error) {
                return offerFrom(error) ?? raise(error);
            }
        },
        [settle],
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
                await dropPushRegistration(token);
                await request<void>('/auth/logout', { method: 'POST', token });
            }
        } catch {
            // The token may already be gone server-side; sign out regardless.
        } finally {
            await forget();
        }
    }, [forget, token]);

    const reload = useCallback(async (): Promise<User | null> => {
        if (!token) {
            return null;
        }

        const { data } = await authenticatedRequest<{ data: User }>('/auth/user');

        setState({ status: 'authenticated', user: data });

        return data;
    }, [authenticatedRequest, token]);

    const value = useMemo<SessionValue>(
        () => ({ ...state, token, login, signInWithGoogle, signInWithApple, signInWithMicrosoft, redeemAppleCode, signInWithPasskey, completeTwoFactor, register, logout, reload, authenticatedRequest }),
        [authenticatedRequest, completeTwoFactor, login, logout, redeemAppleCode, register, reload, signInWithApple, signInWithGoogle, signInWithMicrosoft, signInWithPasskey, state, token],
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
