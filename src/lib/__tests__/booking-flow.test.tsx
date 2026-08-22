import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import Book from '@/app/(app)/book';
import Bookings from '@/app/(app)/(tabs)/bookings';
import { ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';

jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));
jest.mock('expo-router', () => ({
    Link: MockLink,
    useFocusEffect: MockUseFocusEffect,
    useLocalSearchParams: () => ({ listing: 'l1' }),
    router: { back: jest.fn(), replace: jest.fn() },
}));

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

const address = { id: 'a1', label: 'Home', is_default: true, latitude: 14.55, longitude: 121.02 };

const booking = {
    id: 'b1',
    status: { value: 'pending', label: 'Awaiting a provider', wording: 'awaiting a provider', tone: 'info', is_open: true },
    description: 'The unit drips.',
    scheduled_at: '2026-09-01T02:00:00.000000Z',
    cancelled_at: null,
    price_min: 150_000,
    price_max: null,
    address: { label: 'Home', line: '12 Kalayaan, Makati' },
    latitude: 14.55,
    longitude: 121.02,
    service: { id: 's1', name: 'Cleaning', pricing_unit: { value: 'fixed', label: 'Fixed price', suffix: '', is_quoted: false } },
    provider: { id: 'p1', name: 'FixRight Manila' },
    created_at: '2026-08-01T00:00:00.000000Z',
};

function signedIn(authenticatedRequest: jest.Mock) {
    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        user,
        token: 'a-token',
        authenticatedRequest,
        reload: jest.fn(),
    });
}

it('posts the listing, the address and a chosen time', async () => {
    const request = jest.fn((path: string, options?: { body: Record<string, string> }) => {
        void options;

        return path === '/addresses'
            ? Promise.resolve({ data: [address] })
            : Promise.resolve({ data: booking });
    });

    signedIn(request);

    render(<Book />);

    await waitFor(() => expect(screen.getByText('Home')).toBeOnTheScreen());

    fireEvent.changeText(screen.getByPlaceholderText(/drips/), 'The unit drips.');
    fireEvent.press(screen.getByText('Place booking'));

    await waitFor(() => expect(request).toHaveBeenCalledWith('/bookings', expect.anything()));

    const call = request.mock.calls.find(([path]) => path === '/bookings');
    const body = call?.[1]?.body ?? {};

    expect(body.listing_id).toBe('l1');
    expect(body.address_id).toBe('a1');
    expect(body.description).toBe('The unit drips.');
    expect(new Date(body.scheduled_at).getTime()).toBeGreaterThan(Date.now());
});

// Coverage is the refusal the whole zone machinery exists to produce, and the
// server keys it to listing_id, which owns no input on this form.
it('shows a provider who does not work there, rather than going quiet', async () => {
    const request = jest.fn((path: string) => {
        if (path === '/addresses') {
            return Promise.resolve({ data: [address] });
        }

        return Promise.reject(
            new ApiError(422, 'This provider does not work at that address.', {
                listing_id: ['This provider does not work at that address.'],
            }),
        );
    });

    signedIn(request);

    render(<Book />);

    await waitFor(() => expect(screen.getByText('Home')).toBeOnTheScreen());

    fireEvent.press(screen.getByText('Place booking'));

    await waitFor(() =>
        expect(screen.getByText('This provider does not work at that address.')).toBeOnTheScreen(),
    );
});

it('lists a booking with the tone the server gave it', async () => {
    signedIn(jest.fn(() => Promise.resolve({ data: [booking] })));

    render(<Bookings />);

    await waitFor(() => expect(screen.getByText('Cleaning')).toBeOnTheScreen());
    expect(screen.getByText('awaiting a provider')).toBeOnTheScreen();
    expect(screen.getByText('FixRight Manila')).toBeOnTheScreen();
});

it('says nothing is booked rather than showing an empty list', async () => {
    signedIn(jest.fn(() => Promise.resolve({ data: [] })));

    render(<Bookings />);

    await waitFor(() => expect(screen.getByText('Nothing booked yet')).toBeOnTheScreen());
});
