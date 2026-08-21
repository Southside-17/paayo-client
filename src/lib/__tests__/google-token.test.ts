import { renderHook } from '@testing-library/react-native';

import { DisplayableError } from '../api';
import { useGoogleSignIn } from '../google';

const mockPromptAsync = jest.fn();
const mockExchangeCodeAsync = jest.fn();

const mockRequest = {
    clientId: 'an-ios-client-id',
    redirectUri: 'com.paayo.ph:/oauthredirect',
    codeVerifier: 'a-verifier',
};

jest.mock('expo-auth-session', () => ({
    exchangeCodeAsync: (...args: unknown[]) => mockExchangeCodeAsync(...args),
}));

jest.mock('expo-auth-session/providers/google', () => ({
    discovery: { tokenEndpoint: 'https://oauth2.googleapis.com/token' },
    useAuthRequest: () => [mockRequest, null, mockPromptAsync],
}));

beforeEach(() => {
    mockPromptAsync.mockReset();
    mockExchangeCodeAsync.mockReset();
});

it('trades the authorization code for an access token', async () => {
    mockPromptAsync.mockResolvedValue({
        type: 'success',
        params: { code: 'a-code' },
        authentication: null,
    });
    mockExchangeCodeAsync.mockResolvedValue({ accessToken: 'a-google-token' });

    const { result } = renderHook(() => useGoogleSignIn());

    await expect(result.current.requestToken()).resolves.toBe('a-google-token');

    expect(mockExchangeCodeAsync).toHaveBeenCalledWith(
        {
            clientId: 'an-ios-client-id',
            redirectUri: 'com.paayo.ph:/oauthredirect',
            code: 'a-code',
            extraParams: { code_verifier: 'a-verifier' },
        },
        { tokenEndpoint: 'https://oauth2.googleapis.com/token' },
    );
});

it('says nothing when the sheet is backed out of', async () => {
    mockPromptAsync.mockResolvedValue({ type: 'dismiss' });

    const { result } = renderHook(() => useGoogleSignIn());

    await expect(result.current.requestToken()).resolves.toBeNull();
    expect(mockExchangeCodeAsync).not.toHaveBeenCalled();
});

it('surfaces what Google said instead of stopping silently', async () => {
    mockPromptAsync.mockResolvedValue({
        type: 'error',
        error: { message: 'redirect_uri_mismatch' },
        params: {},
        authentication: null,
    });

    const { result } = renderHook(() => useGoogleSignIn());

    await expect(result.current.requestToken()).rejects.toThrow(DisplayableError);
    await expect(result.current.requestToken()).rejects.toThrow('redirect_uri_mismatch');
});

it('explains a refused exchange rather than returning nothing', async () => {
    mockPromptAsync.mockResolvedValue({
        type: 'success',
        params: { code: 'a-code' },
        authentication: null,
    });
    mockExchangeCodeAsync.mockRejectedValue(new Error('invalid_grant'));

    const { result } = renderHook(() => useGoogleSignIn());

    await expect(result.current.requestToken()).rejects.toThrow('invalid_grant');
});
