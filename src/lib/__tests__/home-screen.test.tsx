import { render, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import Home from '@/app/(app)/(tabs)/index';
import { useSession } from '@/lib/session';

// A jest.mock factory cannot build JSX here, so both stand-ins are hoisted
// function declarations the factories hand back. See .ai/rules/general.md.
jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));
jest.mock('expo-router', () => ({ Link: MockLink, useFocusEffect: MockUseFocusEffect }));
jest.mock('@/lib/google', () => ({ googleIsConfigured: () => true, useGoogleSignIn: jest.fn() }));
jest.mock('@/lib/passkey', () => ({ passkeysAreSupported: () => true }));

function MockLink({ children }: { href: string; children: ReactNode }) {
    return <View>{children}</View>;
}

function MockUseFocusEffect(callback: () => void) {
    useEffect(callback, [callback]);
}

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

const address = {
    id: 'a1',
    label: 'Home',
    unit: null,
    street: '12 Kalayaan',
    subdivision: null,
    barangay: 'Poblacion',
    town: 'Makati',
    province: 'Metro Manila',
    postal_code: null,
    landmark: null,
    latitude: 14.55,
    longitude: 121.02,
    is_default: true,
    line: '12 Kalayaan, Poblacion, Makati',
};

/**
 * @param payloads What each of the screen's three reads should answer with.
 */
function signedIn(payloads: { addresses?: unknown[]; passkeys?: unknown[]; socials?: unknown[] }) {
    const authenticatedRequest = jest.fn((path: string) => {
        if (path === '/addresses') {
            return Promise.resolve({ data: payloads.addresses ?? [] });
        }

        if (path === '/auth/passkeys') {
            return Promise.resolve({ data: payloads.passkeys ?? [] });
        }

        return Promise.resolve({ data: payloads.socials ?? [] });
    });

    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        user,
        token: 'a-token',
        authenticatedRequest,
        reload: jest.fn(),
    });
}

it('says where each plane of the account stands', async () => {
    signedIn({});

    render(<Home />);

    await waitFor(() => expect(screen.getByText('confirmed')).toBeOnTheScreen());
    expect(screen.getByText('not verified')).toBeOnTheScreen();
    expect(screen.getByText('off')).toBeOnTheScreen();
});

it('counts the passkeys the account holds', async () => {
    signedIn({ passkeys: [{ id: 'p1' }, { id: 'p2' }] });

    render(<Home />);

    await waitFor(() => expect(screen.getByText('2 saved')).toBeOnTheScreen());
});

it('offers a card for every provider this build can reach', async () => {
    signedIn({});

    render(<Home />);

    await waitFor(() => expect(screen.getByText('Google')).toBeOnTheScreen());
    expect(screen.getByText('not linked')).toBeOnTheScreen();
});

it('names the address behind a linked provider once it is linked', async () => {
    signedIn({ socials: [{ provider: 'google', label: 'Google', email: 'mara@gmail.com' }] });

    render(<Home />);

    await waitFor(() => expect(screen.getByText('linked')).toBeOnTheScreen());
    expect(screen.getByText('mara@gmail.com')).toBeOnTheScreen();
});

it('shows the default address and how it is marked', async () => {
    signedIn({ addresses: [address] });

    render(<Home />);

    await waitFor(() => expect(screen.getByText('Home')).toBeOnTheScreen());
    expect(screen.getByText('Default')).toBeOnTheScreen();
    expect(screen.getByText('Pinned')).toBeOnTheScreen();
    expect(screen.getByText('12 Kalayaan, Poblacion, Makati')).toBeOnTheScreen();
});

it('says an address is missing rather than leaving the card blank', async () => {
    signedIn({});

    render(<Home />);

    await waitFor(() => expect(screen.getByText(/No address saved yet/)).toBeOnTheScreen());
});
