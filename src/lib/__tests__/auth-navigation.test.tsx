import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { unstable_settings } from '@/app/(auth)/_layout';
import ForgotPassword from '@/app/(auth)/forgot-password';
import Login from '@/app/(auth)/login';
import Register from '@/app/(auth)/register';
import { useGoogleSignIn } from '@/lib/google';
import { passkeysAreSupported } from '@/lib/passkey';
import { useSession } from '@/lib/session';

const actions = new Map<string, string>();

/**
 * Stands in for the Link, recording the navigation action it was handed.
 */
function MockLink({
    href,
    push,
    dismissTo,
    children,
}: {
    href: string;
    push?: boolean;
    dismissTo?: boolean;
    children: ReactNode;
}) {
    actions.set(href, push ? 'push' : dismissTo ? 'dismissTo' : 'navigate');

    return <View testID={`link:${href}`}>{children}</View>;
}

jest.mock('expo-router', () => ({ Link: MockLink, router: { push: jest.fn() } }));
jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));
jest.mock('@/lib/google', () => ({ useGoogleSignIn: jest.fn() }));
// Mocked now that the gate answers on Android too: this screen is about
// navigation, and it should not depend on which platform Jest reports.
jest.mock('@/lib/apple', () => ({
    useAppleSignIn: jest.fn(() => ({ ready: false, requestToken: jest.fn() })),
    requestAppleAuthorization: jest.fn(),
}));
jest.mock('@/lib/passkey', () => ({ passkeysAreSupported: jest.fn() }));

beforeEach(() => {
    actions.clear();
    (useSession as jest.Mock).mockReturnValue({
        login: jest.fn(),
        register: jest.fn(),
        signInWithGoogle: jest.fn(),
        signInWithApple: jest.fn(),
        redeemAppleCode: jest.fn(),
        signInWithPasskey: jest.fn(),
    });
    (useGoogleSignIn as jest.Mock).mockReturnValue({ ready: false, requestToken: jest.fn() });
    (passkeysAreSupported as jest.Mock).mockReturnValue(false);
});

it('roots the signed-out stack at login', () => {
    expect(unstable_settings.initialRouteName).toBe('login');
});

it('sends login forward to the two screens it offers', () => {
    render(<Login />);

    expect(actions.get('/forgot-password')).toBe('push');
    expect(actions.get('/register')).toBe('push');
});

// Both of these read as a way back, and pushing another login is what stacked
// one behind the other until back had to be pressed four times to leave.
it('returns to the login already underneath, from forgot password', () => {
    render(<ForgotPassword />);

    expect(actions.get('/login')).toBe('dismissTo');
});

it('returns to the login already underneath, from register', () => {
    render(<Register />);

    expect(actions.get('/login')).toBe('dismissTo');
});
