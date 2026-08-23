import { render, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import Home from '@/app/(app)/(tabs)/index';
import { AddressesProvider } from '@/lib/addresses';
import { useSession } from '@/lib/session';

// A jest.mock factory cannot build JSX here, so both stand-ins are hoisted
// function declarations the factories hand back. See .ai/rules/general.md.
jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));
jest.mock('expo-router', () => ({ Link: MockLink, useFocusEffect: MockUseFocusEffect }));


function MockLink({ children }: { href: unknown; children: ReactNode }) {
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

const category = { id: 'c1', name: 'Air Condition', slug: 'air-condition', icon: 'air-conditioning' };

function signedIn(payloads: { categories?: unknown[]; addresses?: unknown[] }) {
    const authenticatedRequest = jest.fn((path: string) =>
        Promise.resolve({
            data: path.startsWith('/categories')
                ? (payloads.categories ?? [])
                : (payloads.addresses ?? []),
        }),
    );

    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        user,
        token: 'a-token',
        authenticatedRequest,
        reload: jest.fn(),
    });
}

/** Screens read the address from the provider, so the tree needs one. */
function inApp(ui: ReactNode) {
    return render(<AddressesProvider>{ui}</AddressesProvider>);
}

it('opens with a greeting and the nickname', async () => {
    signedIn({});

    inApp(<Home />);

    await waitFor(() => expect(screen.getByText('Mara')).toBeOnTheScreen());
    expect(screen.getByText(/^Good (morning|afternoon|evening)$/)).toBeOnTheScreen();
});

it('draws a tile for every trade on offer', async () => {
    signedIn({ categories: [category, { ...category, id: 'c2', name: 'Plumbing', icon: 'droplet' }] });

    inApp(<Home />);

    await waitFor(() => expect(screen.getByText('Air Condition')).toBeOnTheScreen());
    expect(screen.getByText('Plumbing')).toBeOnTheScreen();
});

it('names the address work would be sent to', async () => {
    signedIn({ addresses: [address] });

    inApp(<Home />);

    await waitFor(() => expect(screen.getByText('Home')).toBeOnTheScreen());
    expect(screen.getByText('Work happens at')).toBeOnTheScreen();
});

// Coverage is decided by the pin, so an address without one can be chosen and
// then refused at the last step. Say so before that.
it('marks an address that carries no pin', async () => {
    signedIn({ addresses: [{ ...address, latitude: null, longitude: null }] });

    inApp(<Home />);

    await waitFor(() => expect(screen.getByText('No pin')).toBeOnTheScreen());
});

it('asks for an address when none is saved', async () => {
    signedIn({});

    inApp(<Home />);

    await waitFor(() => expect(screen.getByText('Add an address')).toBeOnTheScreen());
});

it('says the catalog is empty rather than showing a blank grid', async () => {
    signedIn({});

    inApp(<Home />);

    await waitFor(() => expect(screen.getByText('Nothing on offer yet')).toBeOnTheScreen());
});
