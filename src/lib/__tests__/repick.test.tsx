import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';

import BookingDetail from '@/app/(app)/booking/[id]';
import ServiceOffers from '@/app/(app)/service/[id]';
import TabsLayout from '@/app/(app)/(tabs)/_layout';
import { useSession } from '@/lib/session';
import type { Booking, Listing } from '@/lib/types';

jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));
jest.mock('@/lib/offers', () => ({ recall: () => null, remember: jest.fn() }));
jest.mock('@/lib/use-selected-address', () => ({
    useSelectedAddress: () => ({
        address: { id: 'a1', label: 'Home', latitude: 7.07, longitude: 125.61 },
        ready: true,
    }),
}));
jest.mock('expo-router', () => ({
    Link: MockLink,
    Tabs: MockTabs,
    useFocusEffect: MockUseFocusEffect,
    useLocalSearchParams: () => mockParams,
    router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
}));

function MockLink({ children }: { href: unknown; children: ReactNode }) {
    return <View>{children}</View>;
}

function MockUseFocusEffect(callback: () => void) {
    useEffect(callback, [callback]);
}

function MockTabs({ children }: { children: ReactNode }) {
    return <View>{children}</View>;
}

MockTabs.Screen = function MockTabsScreen({
    name,
    options,
}: {
    name: string;
    options: { tabBarBadge?: number };
}) {
    return (
        <View accessibilityLabel={`tab ${name}`}>
            {options.tabBarBadge === undefined ? null : (
                <View accessibilityLabel={`badge ${options.tabBarBadge}`} />
            )}
        </View>
    );
};

let mockParams: Record<string, string> = { id: 'b1' };

const declined: Booking = {
    id: 'b1',
    status: {
        value: 'declined',
        label: 'Turned down',
        wording: 'turned down',
        tone: 'warning',
        is_open: true,
        needs_another_provider: true,
    },
    description: 'The unit drips.',
    scheduled_at: '2026-09-01T02:00:00.000000Z',
    accepted_at: null,
    cancelled_at: null,
    declines: [
        { listing_id: 'l1', provider_name: 'Tubero Davao Plumbing', declined_at: '2026-08-23T00:00:00.000000Z' },
    ],
    price_min: 150_000,
    price_max: null,
    address: { label: 'Home', line: '12 Mabini Street' },
    latitude: 7.07,
    longitude: 125.61,
    pin_radius: null,
    surcharge: null,
    service: {
        id: 's1',
        name: 'Leak Repair',
        pricing_unit: { value: 'unit', label: 'per unit', suffix: '/unit', is_quoted: false },
    },
    provider: { id: 'p1', name: 'Tubero Davao Plumbing' },
    attachments: [],
    created_at: '2026-08-01T00:00:00.000000Z',
};

function listing(id: string, provider: string): Listing {
    return {
        id,
        description: null,
        price_min: 200_000,
        price_max: null,
        provider: { id: `p-${id}`, name: provider, slug: provider.toLowerCase() },
    };
}

function signedIn(authenticatedRequest: jest.Mock) {
    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        user: { nickname: 'Ariel', staffs: [], bookings_needing_provider: 1 },
        authenticatedRequest,
        reload: jest.fn(),
        logout: jest.fn(),
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { id: 'b1' };
});

describe('being turned down', () => {
    // A direction, not a setback: the way forward leads and the setback is a
    // fact beneath it. Warning, never destructive -- nothing failed.
    it('leads with the way forward and names who could not come', async () => {
        signedIn(jest.fn().mockResolvedValue({ data: declined }));

        render(<BookingDetail />);

        expect(await screen.findByText("Tubero Davao Plumbing can't take this")).toBeOnTheScreen();
        expect(screen.getByText('Choose someone else')).toBeOnTheScreen();
    });

    // The single most reassuring fact available, and the whole reason a re-pick
    // exists instead of cancel-and-book-again.
    it('says the photos and details survive the change', async () => {
        signedIn(jest.fn().mockResolvedValue({ data: declined }));

        render(<BookingDetail />);

        expect(await screen.findByText(/Your photos\s+and details stay as they are/)).toBeOnTheScreen();
    });

    it('does not name a provider as coming when none is', async () => {
        signedIn(jest.fn().mockResolvedValue({ data: declined }));

        render(<BookingDetail />);

        await screen.findByText('Choose someone else');

        expect(screen.queryByText('Who is coming?')).not.toBeOnTheScreen();
    });
});

describe('choosing again', () => {
    beforeEach(() => {
        mockParams = { id: 's1', name: 'Leak Repair', repick: 'b1' };
    });

    function offering(...listings: Listing[]) {
        return jest.fn().mockImplementation((path: string) =>
            path.startsWith('/bookings/')
                ? Promise.resolve({ data: declined })
                : Promise.resolve({ data: { id: 's1', name: 'Leak Repair', pricing_unit: declined.service.pricing_unit }, alternatives: listings, market: { id: 'm1', name: 'Davao City' } }),
        );
    }

    it('asks for the whole market, covered or not', async () => {
        const authenticatedRequest = offering(listing('l2', 'Southpoint Waterworks'));
        signedIn(authenticatedRequest);

        render(<ServiceOffers />);

        await waitFor(() =>
            expect(authenticatedRequest).toHaveBeenCalledWith('/services/s1?choosing=1&address=a1'),
        );
    });

    // Removing them reads as a bug and sends the client hunting for a name they
    // remember seeing a moment ago.
    it('keeps the provider who turned it down on the list, unselectable', async () => {
        signedIn(offering(listing('l1', 'Tubero Davao Plumbing'), listing('l2', 'Southpoint Waterworks')));

        render(<ServiceOffers />);

        expect(await screen.findByText('Tubero Davao Plumbing')).toBeOnTheScreen();
        expect(screen.getByText('turned this down')).toBeOnTheScreen();

        fireEvent.press(screen.getByText('Tubero Davao Plumbing'));

        expect(router.back).not.toHaveBeenCalled();
    });

    it('moves the booking to whoever was picked, without opening a new one', async () => {
        const authenticatedRequest = offering(listing('l2', 'Southpoint Waterworks'));
        signedIn(authenticatedRequest);

        render(<ServiceOffers />);

        fireEvent.press(await screen.findByText('Southpoint Waterworks'));

        await waitFor(() =>
            expect(authenticatedRequest).toHaveBeenCalledWith('/bookings/b1/provider', {
                method: 'PUT',
                body: { listing_id: 'l2' },
            }),
        );

        // Back to the booking, never forward into the booking form again.
        await waitFor(() => expect(router.back).toHaveBeenCalled());
        expect(router.replace).not.toHaveBeenCalled();
    });
});

describe('the badge', () => {
    function withOwed(owed: number) {
        (useSession as jest.Mock).mockReturnValue({
            status: 'authenticated',
            user: { nickname: 'Ariel', staffs: [], bookings_needing_provider: owed },
        });
    }

    it('counts the bookings waiting on a choice', () => {
        withOwed(2);

        render(<TabsLayout />);

        expect(screen.getByLabelText('badge 2')).toBeOnTheScreen();
    });

    it('shows nothing when nothing is owed', () => {
        withOwed(0);

        render(<TabsLayout />);

        expect(screen.queryByLabelText(/^badge/)).not.toBeOnTheScreen();
    });

    // An older server sends no count at all, and that must read as none rather
    // than draw NaN on the tab bar.
    it('treats a server that sends no count as none', () => {
        (useSession as jest.Mock).mockReturnValue({
            status: 'authenticated',
            user: { nickname: 'Ariel', staffs: [] },
        });

        render(<TabsLayout />);

        expect(screen.queryByLabelText(/^badge/)).not.toBeOnTheScreen();
    });
});
