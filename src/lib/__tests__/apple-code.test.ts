import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { DisplayableError } from '../api';
import { requestAppleAuthorization } from '../apple';

jest.mock('expo-web-browser', () => ({
    openAuthSessionAsync: jest.fn(),
    WebBrowserResultType: { CANCEL: 'cancel', DISMISS: 'dismiss', OPENED: 'opened', LOCKED: 'locked' },
}));

jest.mock('expo-crypto', () => ({
    // Deterministic, so the challenge below is a fixed string rather than a
    // regex: what is being proved is that the app hashes the verifier it keeps.
    getRandomBytesAsync: jest.fn(async () => new Uint8Array(32).fill(7)),
    digestStringAsync: jest.fn(async () => 'PGr+Yc/dV1oo0Ss3Fw8bT7d1qFy8Rp9OaZ2mE5jK4nA='),
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    CryptoEncoding: { BASE64: 'base64' },
}));

let android: ReturnType<typeof jest.replaceProperty>;

beforeEach(() => {
    android = jest.replaceProperty(Platform, 'OS', 'android');
    jest.mocked(WebBrowser.openAuthSessionAsync).mockReset();
});

afterEach(() => {
    android.restore();
});

function returned(url: string) {
    jest.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({ type: 'success', url });
}

it('starts the flow on the server with a base64url challenge', async () => {
    returned('com.paayo.ph:/apple-oauth?code=a-one-time-code');

    await requestAppleAuthorization();

    const [startUrl, returnUrl] = jest.mocked(WebBrowser.openAuthSessionAsync).mock.calls[0];

    expect(startUrl).toContain('/auth/apple/app/redirect?code_challenge=');
    expect(returnUrl).toBe('com.paayo.ph:/apple-oauth');

    // PKCE and Apple both want base64url, and neither pads: a '+', '/' or '='
    // reaching the server is a challenge that can never match the verifier.
    const challenge = new URL(startUrl).searchParams.get('code_challenge') ?? '';

    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
});

it('hands back the code with the verifier it never sent', async () => {
    returned('com.paayo.ph:/apple-oauth?code=a-one-time-code');

    const granted = await requestAppleAuthorization();

    expect(granted?.code).toBe('a-one-time-code');

    // The verifier stayed in the app while the browser was away, which is what
    // makes an intercepted code unspendable.
    expect(granted?.verifier).toEqual(expect.stringMatching(/^[A-Za-z0-9\-_]{43,128}$/));
});

it.each([WebBrowser.WebBrowserResultType.CANCEL, WebBrowser.WebBrowserResultType.DISMISS])(
    'answers null when the tab is closed by %s',
    async (type) => {
        jest.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({ type });

        await expect(requestAppleAuthorization()).resolves.toBeNull();
    },
);

it('answers null when the person cancelled at Apple', async () => {
    returned('com.paayo.ph:/apple-oauth?error=cancelled');

    await expect(requestAppleAuthorization()).resolves.toBeNull();
});

it('refuses a return carrying a failure', async () => {
    returned('com.paayo.ph:/apple-oauth?error=failed');

    await expect(requestAppleAuthorization()).rejects.toBeInstanceOf(DisplayableError);
});

it('never reaches the native module, which Android does not have', async () => {
    returned('com.paayo.ph:/apple-oauth?code=a-one-time-code');

    await requestAppleAuthorization();

    expect(AppleAuthentication.isAvailableAsync).not.toHaveBeenCalled();
    expect(AppleAuthentication.signInAsync).not.toHaveBeenCalled();
});
