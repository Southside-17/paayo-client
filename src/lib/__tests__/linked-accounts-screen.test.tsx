import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

import LinkedAccounts from '@/app/(app)/profile/socials';
import { useSession } from '@/lib/session';
import type { Social } from '@/lib/types';

jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

// The three sign-in hooks, stood in for so the screen's list is about what is
// linked rather than about which platform Jest reports.
jest.mock('@/lib/google', () => ({
    useGoogleSignIn: jest.fn(() => ({ ready: true, requestToken: jest.fn() })),
    googleIsConfigured: jest.fn(() => true),
}));
jest.mock('@/lib/apple', () => ({
    useAppleSignIn: jest.fn(() => ({ ready: true, requestToken: jest.fn() })),
    appleIsConfigured: jest.fn(() => true),
}));
jest.mock('@/lib/microsoft', () => ({
    useMicrosoftSignIn: jest.fn(() => ({ ready: true, requestToken: jest.fn() })),
    microsoftIsConfigured: jest.fn(() => true),
}));

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

function signedIn(linked: Social[], overrides: { has_password?: boolean } = {}) {
    const authenticatedRequest = jest.fn(async (path: string) =>
        path === '/auth/socials' ? { data: linked } : undefined,
    );

    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        user: { ...user, ...overrides },
        token: 'a-token',
        authenticatedRequest,
        reload: jest.fn(),
    });

    return authenticatedRequest;
}

function social(provider: string, label: string): Social {
    return {
        provider,
        label,
        email: `mara@${provider}.test`,
        created_at: '2026-01-01T00:00:00.000000Z',
    };
}

afterEach(() => {
    Platform.OS = 'ios';
});

it('offers every provider the build carries, not just google', async () => {
    signedIn([]);

    render(<LinkedAccounts />);

    await waitFor(() => expect(screen.getByText('Link Google')).toBeOnTheScreen());

    for (const label of ['Google', 'Apple', 'Microsoft']) {
        expect(screen.getByText(label)).toBeOnTheScreen();
    }
});

it('unlinks through the provider it is drawn for', async () => {
    const request = signedIn([social('microsoft', 'Microsoft'), social('google', 'Google')]);

    render(<LinkedAccounts />);

    await waitFor(() => expect(screen.getAllByText('Unlink')).toHaveLength(2));

    fireEvent.press(screen.getAllByText('Unlink')[1]);

    await waitFor(() =>
        expect(request).toHaveBeenCalledWith('/auth/socials/microsoft', { method: 'DELETE' }),
    );
});

it('links through the provider it is drawn for', async () => {
    const { useMicrosoftSignIn } = jest.requireMock('@/lib/microsoft');

    (useMicrosoftSignIn as jest.Mock).mockReturnValue({
        ready: true,
        requestToken: jest.fn(async () => 'a-microsoft-id-token'),
    });

    const request = signedIn([]);

    render(<LinkedAccounts />);

    await waitFor(() => expect(screen.getByText('Link Microsoft')).toBeOnTheScreen());

    fireEvent.press(screen.getByText('Link Microsoft'));

    await waitFor(() =>
        expect(request).toHaveBeenCalledWith('/auth/socials/microsoft/link', {
            method: 'POST',
            body: { token: 'a-microsoft-id-token' },
        }),
    );
});

it('counts the last way in across providers rather than within one', async () => {
    signedIn([social('microsoft', 'Microsoft')], { has_password: false });

    render(<LinkedAccounts />);

    await waitFor(() => expect(screen.getByText(/only way into your account/)).toBeOnTheScreen());

    expect(screen.queryByText('Unlink')).toBeNull();
});

it('offers unlink once a second way in exists', async () => {
    signedIn([social('microsoft', 'Microsoft'), social('apple', 'Apple')], {
        has_password: false,
    });

    render(<LinkedAccounts />);

    await waitFor(() => expect(screen.getAllByText('Unlink')).toHaveLength(2));

    expect(screen.queryByText(/only way into your account/)).toBeNull();
});

it('does not offer apple linking on android', async () => {
    Platform.OS = 'android';

    signedIn([]);

    render(<LinkedAccounts />);

    await waitFor(() => expect(screen.getByText('Link Google')).toBeOnTheScreen());

    expect(screen.queryByText('Link Apple')).toBeNull();
    expect(screen.getByText('Apple can only be linked on iOS.')).toBeOnTheScreen();
});

it('keeps a linked provider this build cannot reach', async () => {
    const microsoft = jest.requireMock('@/lib/microsoft');

    (microsoft.microsoftIsConfigured as jest.Mock).mockReturnValue(false);
    (microsoft.useMicrosoftSignIn as jest.Mock).mockReturnValue({
        ready: false,
        requestToken: jest.fn(),
    });

    signedIn([social('microsoft', 'Microsoft'), social('google', 'Google')]);

    render(<LinkedAccounts />);

    await waitFor(() => expect(screen.getByText('Microsoft')).toBeOnTheScreen());

    expect(screen.getAllByText('Unlink')).toHaveLength(2);

    (microsoft.microsoftIsConfigured as jest.Mock).mockReturnValue(true);
});
