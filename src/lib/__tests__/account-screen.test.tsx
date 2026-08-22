import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import Account from '@/app/(app)/(tabs)/account';
import { useSession } from '@/lib/session';

jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));
jest.mock('expo-router', () => ({ Link: MockLink }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));

function MockLink({ href, children }: { href: string; children: ReactNode }) {
    return <View accessibilityLabel={`to ${href}`}>{children}</View>;
}

const user = {
    id: 'u1',
    nickname: 'Mara',
    fullname: 'Maria Reyes',
    phone: null,
    avatar: false,
    email: 'mara@example.com',
    email_verified: true,
    identification_verified: true,
    two_factor_enabled: false,
    has_password: true,
    administrator: false,
    created_at: '2026-01-01T00:00:00.000000Z',
};

function signedIn() {
    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        user,
        token: 'a-token',
        authenticatedRequest: jest.fn(),
        reload: jest.fn(),
        logout: jest.fn(),
    });
}

it('leads with the nickname and keeps the legal name as subtext', () => {
    signedIn();

    render(<Account />);

    expect(screen.getByText('Mara')).toBeOnTheScreen();
    expect(screen.getByText('Maria Reyes')).toBeOnTheScreen();
});

// One word each, so the list reads as a column rather than a paragraph.
it('names every section in one word', () => {
    signedIn();

    render(<Account />);

    for (const label of ['Profile', 'Address', 'Sign-in', 'Security']) {
        expect(screen.getByText(label)).toBeOnTheScreen();
    }
});

it('points each section at the screen that owns it', () => {
    signedIn();

    render(<Account />);

    expect(screen.getByLabelText('to /profile/edit')).toBeOnTheScreen();
    expect(screen.getByLabelText('to /profile/addresses')).toBeOnTheScreen();
    expect(screen.getByLabelText('to /profile/socials')).toBeOnTheScreen();
    expect(screen.getByLabelText('to /security')).toBeOnTheScreen();
});
