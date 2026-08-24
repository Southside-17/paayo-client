import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';

import ListingDetail from '@/app/(app)/listing/[id]';
import { basket, workings } from '@/lib/money';
import { forget, recallCarried } from '@/lib/offers';
import { useSession } from '@/lib/session';
import { useSelectedAddress } from '@/lib/use-selected-address';
import type { RateLine } from '@/lib/types';
import { router } from 'expo-router';

/** Hoisted above jest.mock, which may not reach an imported binding. */
function MockUseFocusEffect(callback: () => void) {
    useEffect(callback, [callback]);
}

jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));
jest.mock('@/lib/use-selected-address', () => ({ useSelectedAddress: jest.fn() }));
jest.mock('expo-router', () => ({
    useFocusEffect: MockUseFocusEffect,
    useLocalSearchParams: () => ({
        id: 'l1',
        serviceId: 's1',
        service: 'Cleaning',
        trade: 'Air Condition',
        covered: '1',
    }),
    router: { replace: jest.fn(), back: jest.fn(), push: jest.fn() },
}));

function line(label: string, amount: number, unit: string | null = 'unit'): RateLine {
    return {
        label,
        amount,
        unit,
        estimated_minutes: null,
        maximum_minutes: null,
        is_active: true,
    };
}

const hourly: RateLine = {
    label: 'Troubleshooting',
    amount: 50_000,
    unit: 'hour',
    estimated_minutes: 120,
    maximum_minutes: 240,
    is_active: true,
};

function offering(
    rates: RateLine[],
    intake: string[] = [],
    onRequest = false,
    many = false,
) {
    return {
        data: { id: 's1', name: 'Cleaning', description: null },
        market: { id: 'm1', name: 'Davao City' },
        covering: {
            id: 'l1',
            description: 'Same-day work across Davao.',
            pricing_method: onRequest
                ? { value: 'on_request', label: 'Priced on request', is_on_request: true }
                : { value: 'per_unit', label: 'Per unit', is_on_request: false },
            rates,
            allows_many_lines: many,
            intake,
            price_min: rates.length > 0 ? Math.min(...rates.map((one) => one.amount)) : null,
            price_max: rates.length > 0 ? Math.max(...rates.map((one) => one.amount)) : null,
            provider: { id: 'p1', name: 'Kool Breeze', slug: 'kool-breeze' },
        },
        alternatives: [],
    };
}

function signedIn(answer: unknown) {
    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        authenticatedRequest: jest.fn(async () => answer),
        reload: jest.fn(),
    });
    (useSelectedAddress as jest.Mock).mockReturnValue({
        address: { id: 'a1', label: 'Home', latitude: 7.07, longitude: 125.61 },
        ready: true,
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    forget();
});

it('shows what a provider charges before anybody picks a date', async () => {
    signedIn(offering([line('Window type', 80_000), line('Split type', 100_000)]));

    render(<ListingDetail />);

    await waitFor(() => expect(screen.getByText('Kool Breeze')).toBeOnTheScreen());

    expect(screen.getByText('What do they charge for?')).toBeOnTheScreen();
    expect(screen.getByText('Window type')).toBeOnTheScreen();
    expect(screen.getByText('Split type')).toBeOnTheScreen();
});

// The whole reason this screen exists: a band asks to be trusted, a figure with
// its arithmetic under it can be checked.
it('turns a picked line and a count into a figure with its workings', async () => {
    signedIn(offering([line('Window type', 80_000), line('Split type', 100_000)]));

    render(<ListingDetail />);

    await waitFor(() => expect(screen.getByText('Split type')).toBeOnTheScreen());

    fireEvent.press(screen.getByText('Split type'));
    fireEvent.changeText(screen.getByLabelText('How many Split type'), '2');

    await waitFor(() => expect(screen.getByText('₱2,000')).toBeOnTheScreen());
    expect(screen.getAllByText('₱1,000 × 2 unit').length).toBeGreaterThan(0);
});

it('asks for no count until a line has been picked', async () => {
    signedIn(offering([line('Window type', 80_000), line('Split type', 100_000)]));

    render(<ListingDetail />);

    await waitFor(() => expect(screen.getByText('Split type')).toBeOnTheScreen());

    expect(screen.queryByLabelText('How many Split type')).not.toBeOnTheScreen();
});

it('picks the only line on a one-line card, because there is nothing to choose', async () => {
    signedIn(offering([line('Whole unit', 80_000)]));

    render(<ListingDetail />);

    await waitFor(() => expect(screen.getByText('What they charge')).toBeOnTheScreen());

    expect(screen.getByLabelText('How many Whole unit')).toBeOnTheScreen();
});

// There must never be a state a client cannot get out of. The auto-picked line
// on a one-line card was the case with no way back.
it('clears a picked line when it is tapped again', async () => {
    signedIn(offering([line('Whole unit', 80_000)]));

    render(<ListingDetail />);

    await waitFor(() =>
        expect(screen.getByLabelText('How many Whole unit')).toBeOnTheScreen(),
    );

    fireEvent.press(screen.getByText('Whole unit'));

    expect(screen.queryByLabelText('How many Whole unit')).not.toBeOnTheScreen();
    expect(screen.getByText('Pick what you need to see a figure.')).toBeOnTheScreen();
});

// Tubero Davao Plumbing: a faucet AND a toilet is one plumber visit, not two
// bookings. Single-select forced two, which is what this setting fixes.
it('orders several lines at once when the provider allows it', async () => {
    signedIn(
        offering(
            [line('Faucet or angle valve', 75_000), line('Toilet, sink or shower', 110_000)],
            [],
            false,
            true,
        ),
    );

    render(<ListingDetail />);

    await waitFor(() =>
        expect(screen.getByText('Faucet or angle valve')).toBeOnTheScreen(),
    );

    fireEvent.press(screen.getByText('Faucet or angle valve'));
    fireEvent.press(screen.getByText('Toilet, sink or shower'));
    fireEvent.changeText(screen.getByLabelText('How many Faucet or angle valve'), '2');
    fireEvent.changeText(screen.getByLabelText('How many Toilet, sink or shower'), '1');

    await waitFor(() => expect(screen.getByText('₱2,600')).toBeOnTheScreen());
});

it('replaces the pick instead of adding to it when only one is allowed', async () => {
    signedIn(offering([line('Window type', 80_000), line('Split type', 100_000)]));

    render(<ListingDetail />);

    await waitFor(() => expect(screen.getByText('Split type')).toBeOnTheScreen());

    fireEvent.press(screen.getByText('Window type'));
    fireEvent.press(screen.getByText('Split type'));

    expect(screen.getByLabelText('How many Split type')).toBeOnTheScreen();
    expect(screen.queryByLabelText('How many Window type')).not.toBeOnTheScreen();
});

it('lets somebody say they cannot tell the lines apart', async () => {
    signedIn(offering([line('Window type', 80_000), line('Split type', 100_000)]));

    render(<ListingDetail />);

    await waitFor(() => expect(screen.getByText("I'm not sure")).toBeOnTheScreen());

    fireEvent.press(screen.getByText("I'm not sure"));

    expect(
        screen.getByText('They will confirm the price when they see it.'),
    ).toBeOnTheScreen();
});

it('asks for no count on an hourly line, and reads its span back', async () => {
    signedIn(offering([hourly]));

    render(<ListingDetail />);

    await waitFor(() => expect(screen.getByText('Troubleshooting')).toBeOnTheScreen());

    expect(screen.queryByLabelText('How many Troubleshooting')).not.toBeOnTheScreen();
    expect(
        screen.getByText('Usually about 2 hours, and they stop at 4.'),
    ).toBeOnTheScreen();
});

it('shows no card at all when the work is priced on request', async () => {
    signedIn(offering([], ['What is it doing?'], true));

    render(<ListingDetail />);

    await waitFor(() =>
        expect(screen.getByText('They price this after seeing it')).toBeOnTheScreen(),
    );

    expect(screen.queryByText('What do they charge for?')).not.toBeOnTheScreen();
    expect(screen.getByText('What is it doing?')).toBeOnTheScreen();
});

it('asks the provider questions, and nothing when there are none', async () => {
    signedIn(offering([line('Window type', 80_000)], ['Which floor is the unit on?']));

    render(<ListingDetail />);

    await waitFor(() =>
        expect(screen.getByText('A few questions from them')).toBeOnTheScreen(),
    );

    expect(screen.getByLabelText('Which floor is the unit on?')).toBeOnTheScreen();
});

it('carries nothing forward and still continues when nothing was answered', async () => {
    signedIn(offering([line('Window type', 80_000), line('Split type', 100_000)]));

    render(<ListingDetail />);

    await waitFor(() => expect(screen.getByText('Continue')).toBeOnTheScreen());

    fireEvent.press(screen.getByText('Continue'));

    expect(router.push).toHaveBeenCalledWith(
        expect.objectContaining({
            pathname: '/book',
            params: expect.objectContaining({ listing: 'l1' }),
        }),
    );
});

it('carries the picked line and count into the booking screen', async () => {
    signedIn(offering([line('Window type', 80_000), line('Split type', 100_000)]));

    render(<ListingDetail />);

    await waitFor(() => expect(screen.getByText('Split type')).toBeOnTheScreen());

    fireEvent.press(screen.getByText('Split type'));
    fireEvent.changeText(screen.getByLabelText('How many Split type'), '3');
    fireEvent.press(screen.getByText('Continue'));

    expect(recallCarried('l1')?.lines).toEqual([
        expect.objectContaining({ label: 'Split type', quantity: 3 }),
    ]);
});

describe('the figure', () => {
    const booked = (one: RateLine, quantity: number | null) => ({ ...one, quantity });

    it('sums every picked line', () => {
        expect(
            basket([
                booked(line('Faucet', 75_000), 2),
                booked(line('Toilet', 110_000), 1),
            ]),
        ).toBe('₱2,600');
    });

    it('shows the arithmetic behind one line', () => {
        expect(workings(line('Split type', 100_000), 2)).toBe('₱1,000 × 2 unit');
    });

    it('is a flat line on its own', () => {
        expect(basket([booked(line('Whole house', 1_500_000, null), null)])).toBe('₱15,000');
    });

    // One unknowable line makes the whole figure unknowable. A partial sum shown
    // as the price would be a lie.
    it('does not exist when any line cannot be totalled', () => {
        expect(basket([booked(hourly, null)])).toBeNull();
        expect(
            basket([booked(line('Faucet', 75_000), 2), booked(line('Toilet', 110_000), null)]),
        ).toBeNull();
    });

    it('does not exist when nothing was picked', () => {
        expect(basket([])).toBeNull();
    });
});
