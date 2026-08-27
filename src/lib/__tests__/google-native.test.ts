import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { exchangeCodeAsync } from 'expo-auth-session';
import { renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { DisplayableError } from '../api';
import { useGoogleSignIn } from '../google';

const mockPromptAsync = jest.fn();

jest.mock('expo-auth-session', () => ({
    exchangeCodeAsync: jest.fn(),
}));

jest.mock('expo-auth-session/providers/google', () => ({
    discovery: { tokenEndpoint: 'https://oauth2.googleapis.com/token' },
    useAuthRequest: () => [{ clientId: 'a-client', redirectUri: 'com.paayo.ph:/oauthredirect' }, null, mockPromptAsync],
}));

let android: ReturnType<typeof jest.replaceProperty>;

beforeEach(() => {
    android = jest.replaceProperty(Platform, 'OS', 'android');
    jest.mocked(GoogleSignin.signIn).mockReset();
    jest.mocked(GoogleSignin.getTokens).mockReset();
    jest.mocked(GoogleSignin.hasPlayServices).mockReset().mockResolvedValue(true);
    jest.mocked(GoogleSignin.signOut).mockReset().mockResolvedValue(null);
    mockPromptAsync.mockReset();
});

afterEach(() => {
    android.restore();
});

function picked(accessToken: string | null) {
    jest.mocked(GoogleSignin.signIn).mockResolvedValue({
        type: 'success',
        data: { user: { id: 'g1', name: null, email: 'juan@example.com', photo: null, familyName: null, givenName: null }, scopes: [], idToken: 'an-id-token', serverAuthCode: null },
    });
    jest.mocked(GoogleSignin.getTokens).mockResolvedValue({ idToken: 'an-id-token', accessToken: accessToken as string });
}

it('is ready on Android without waiting for a browser request', () => {
    const { result } = renderHook(() => useGoogleSignIn());

    expect(result.current.ready).toBe(true);
});

it('hands back the access token the API already accepts, from the picker', async () => {
    picked('an-access-token');

    const { result } = renderHook(() => useGoogleSignIn());

    await expect(result.current.requestToken()).resolves.toBe('an-access-token');

    // The picker is Play Services, so no browser is opened and no code is traded.
    expect(mockPromptAsync).not.toHaveBeenCalled();
    expect(exchangeCodeAsync).not.toHaveBeenCalled();
});

it('always offers the account list, rather than reusing the last account', async () => {
    picked('an-access-token');

    const { result } = renderHook(() => useGoogleSignIn());

    await result.current.requestToken();

    // Play Services would otherwise hand back whoever signed in last without
    // asking, which leaves a second account on the phone unreachable.
    expect(GoogleSignin.signOut).toHaveBeenCalled();
    expect(jest.mocked(GoogleSignin.signOut).mock.invocationCallOrder[0])
        .toBeLessThan(jest.mocked(GoogleSignin.signIn).mock.invocationCallOrder[0]);
});

it('signs in even when there was nothing to sign out of', async () => {
    picked('an-access-token');
    jest.mocked(GoogleSignin.signOut).mockRejectedValue(new Error('no user'));

    const { result } = renderHook(() => useGoogleSignIn());

    // A first-ever sign in has no cached account, and that refusal must not read
    // as the sign in itself failing.
    await expect(result.current.requestToken()).resolves.toBe('an-access-token');
});

it('asks Play Services for the web client id, which mints the token', async () => {
    picked('an-access-token');

    const { result } = renderHook(() => useGoogleSignIn());

    await result.current.requestToken();

    expect(GoogleSignin.configure).toHaveBeenCalledWith(
        expect.objectContaining({ webClientId: expect.any(String) }),
    );
});

it('answers null when the picker is dismissed', async () => {
    jest.mocked(GoogleSignin.signIn).mockResolvedValue({ type: 'cancelled', data: null });

    const { result } = renderHook(() => useGoogleSignIn());

    await expect(result.current.requestToken()).resolves.toBeNull();
});

it.each([
    ['12501', null],
    ['12502', null],
])('answers null when Google reports %s', async (code, expected) => {
    jest.mocked(GoogleSignin.signIn).mockRejectedValue(Object.assign(new Error('nope'), { code }));

    const { result } = renderHook(() => useGoogleSignIn());

    await expect(result.current.requestToken()).resolves.toBe(expected);
});

it('says so when the phone has no Play services', async () => {
    jest.mocked(GoogleSignin.hasPlayServices).mockRejectedValue(
        Object.assign(new Error('missing'), { code: '12503' }),
    );

    const { result } = renderHook(() => useGoogleSignIn());

    await expect(result.current.requestToken()).rejects.toBeInstanceOf(DisplayableError);
});

it('reports an unregistered signing certificate as its own failure', async () => {
    // Play Services checks the app signature and the browser flow did not, so a
    // build whose SHA-1 is not on the Android OAuth client fails only here.
    jest.mocked(GoogleSignin.signIn).mockRejectedValue(
        Object.assign(new Error('10: DEVELOPER_ERROR'), { code: '10' }),
    );

    const { result } = renderHook(() => useGoogleSignIn());

    await expect(result.current.requestToken()).rejects.toThrow('not registered with Google');
});

it('leaves iOS on the browser, which is all Google offers there', async () => {
    android.restore();
    const ios = jest.replaceProperty(Platform, 'OS', 'ios');

    mockPromptAsync.mockResolvedValue({
        type: 'success',
        params: { code: 'a-code' },
        authentication: { accessToken: 'from-the-browser' },
    });

    const { result } = renderHook(() => useGoogleSignIn());

    await expect(result.current.requestToken()).resolves.toBe('from-the-browser');
    expect(GoogleSignin.signIn).not.toHaveBeenCalled();

    ios.restore();
    android = jest.replaceProperty(Platform, 'OS', 'android');
});
