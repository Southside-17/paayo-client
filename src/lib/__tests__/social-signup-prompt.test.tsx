import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import Login from '@/app/(auth)/login';
import { useGoogleSignIn } from '@/lib/google';
import { passkeysAreSupported } from '@/lib/passkey';
import { useSession } from '@/lib/session';

jest.mock('expo-router', () => ({
    Link: ({ children }: { children: React.ReactNode }) => children,
    router: { push: jest.fn() },
}));
jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));
jest.mock('@/lib/google', () => ({ useGoogleSignIn: jest.fn() }));
jest.mock('@/lib/apple', () => ({
    useAppleSignIn: jest.fn(() => ({ ready: false, requestToken: jest.fn() })),
    requestAppleAuthorization: jest.fn(),
}));
jest.mock('@/lib/microsoft', () => ({
    useMicrosoftSignIn: jest.fn(() => ({ ready: false, requestToken: jest.fn() })),
}));
jest.mock('@/lib/passkey', () => ({ passkeysAreSupported: jest.fn(() => false) }));

const offer = {
    signup: { provider: 'google', label: 'Google', email: 'stranger@gmail.test' },
};

function arrange(signInWithGoogle: jest.Mock) {
    (useSession as jest.Mock).mockReturnValue({
        login: jest.fn(),
        register: jest.fn(),
        signInWithGoogle,
        signInWithApple: jest.fn(),
        signInWithMicrosoft: jest.fn(),
        redeemAppleCode: jest.fn(),
        signInWithPasskey: jest.fn(),
    });
    (useGoogleSignIn as jest.Mock).mockReturnValue({
        ready: true,
        requestToken: jest.fn(async () => 'an-access-token'),
    });
    (passkeysAreSupported as jest.Mock).mockReturnValue(false);

    render(<Login />);
    fireEvent.press(screen.getByText('Sign in with Google'));
}

it('asks before opening an account, naming the address it would open one for', async () => {
    const signInWithGoogle = jest.fn(async () => offer);

    arrange(signInWithGoogle);

    await waitFor(() => expect(screen.getByTestId('confirm-dialog')).toBeTruthy());

    expect(screen.getByText(/stranger@gmail.test/)).toBeTruthy();
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
    expect(signInWithGoogle).toHaveBeenCalledWith('an-access-token');
});

it('opens the account only once the offer is accepted', async () => {
    const signInWithGoogle = jest.fn(async (_token: string, intent?: string) =>
        intent === 'register' ? { data: {}, token: 't', expires_at: null } : offer,
    );

    arrange(signInWithGoogle);

    await waitFor(() => expect(screen.getByTestId('confirm-dialog')).toBeTruthy());

    fireEvent.press(screen.getByText('Create account'));

    await waitFor(() =>
        expect(signInWithGoogle).toHaveBeenLastCalledWith('an-access-token', 'register'),
    );
});

it('opens nothing when the offer is turned down', async () => {
    const signInWithGoogle = jest.fn(async () => offer);

    arrange(signInWithGoogle);

    await waitFor(() => expect(screen.getByTestId('confirm-dialog')).toBeTruthy());

    fireEvent.press(screen.getByText('Sign in another way'));

    await waitFor(() => expect(screen.queryByTestId('confirm-dialog')).toBeNull());

    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
});
