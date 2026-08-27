import { renderHook } from '@testing-library/react-native';

import { DisplayableError } from '../api';
import { useMicrosoftSignIn } from '../microsoft';

const mockPromptAsync = jest.fn();
const mockExchangeCodeAsync = jest.fn();

const mockRequest = { codeVerifier: 'a-verifier' };

jest.mock('expo-auth-session', () => ({
    exchangeCodeAsync: (...args: unknown[]) => mockExchangeCodeAsync(...args),
    useAuthRequest: () => [mockRequest, null, mockPromptAsync],
}));

const DISCOVERY = {
    authorizationEndpoint: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize',
    tokenEndpoint: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
};

beforeEach(() => {
    mockPromptAsync.mockReset();
    mockExchangeCodeAsync.mockReset();
});

it('trades the authorization code for an identity token', async () => {
    mockPromptAsync.mockResolvedValue({ type: 'success', params: { code: 'a-code' } });
    mockExchangeCodeAsync.mockResolvedValue({
        accessToken: 'a-graph-token',
        idToken: 'a-microsoft-id-token',
    });

    const { result } = renderHook(() => useMicrosoftSignIn());

    // The identity token, not the access token beside it: Microsoft publishes
    // nothing that says which client an access token was minted for, so the API
    // cannot show one to be ours.
    await expect(result.current.requestToken()).resolves.toBe('a-microsoft-id-token');

    expect(mockExchangeCodeAsync).toHaveBeenCalledWith(
        {
            clientId: 'paayo-entra-client-id.test',
            redirectUri: 'com.paayo.ph://msauth',
            code: 'a-code',
            extraParams: { code_verifier: 'a-verifier' },
        },
        DISCOVERY,
    );
});

it('says nothing when the browser is closed', async () => {
    mockPromptAsync.mockResolvedValue({ type: 'dismiss' });

    const { result } = renderHook(() => useMicrosoftSignIn());

    await expect(result.current.requestToken()).resolves.toBeNull();
    expect(mockExchangeCodeAsync).not.toHaveBeenCalled();
});

it('surfaces what Microsoft said instead of stopping silently', async () => {
    mockPromptAsync.mockResolvedValue({
        type: 'error',
        error: { message: 'redirect_uri_mismatch' },
        params: {},
    });

    const { result } = renderHook(() => useMicrosoftSignIn());

    await expect(result.current.requestToken()).rejects.toThrow(DisplayableError);
    await expect(result.current.requestToken()).rejects.toThrow('redirect_uri_mismatch');
});

it('explains a refused exchange rather than returning nothing', async () => {
    mockPromptAsync.mockResolvedValue({ type: 'success', params: { code: 'a-code' } });
    mockExchangeCodeAsync.mockRejectedValue(new Error('invalid_grant'));

    const { result } = renderHook(() => useMicrosoftSignIn());

    await expect(result.current.requestToken()).rejects.toThrow('invalid_grant');
});

it('refuses an exchange that returned no identity token', async () => {
    mockPromptAsync.mockResolvedValue({ type: 'success', params: { code: 'a-code' } });
    mockExchangeCodeAsync.mockResolvedValue({ accessToken: 'a-graph-token' });

    // A scope that was never granted. Posting the empty token instead would be
    // refused by the API in words nobody here can act on.
    const { result } = renderHook(() => useMicrosoftSignIn());

    await expect(result.current.requestToken()).rejects.toThrow('identity token');
});
