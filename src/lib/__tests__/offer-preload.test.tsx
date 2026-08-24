import { render, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';

import TradeServices from '@/app/(app)/trade/[id]';
import ServiceOffers from '@/app/(app)/service/[id]';
import { forget } from '@/lib/offers';
import { useSession } from '@/lib/session';
import { useSelectedAddress } from '@/lib/use-selected-address';

jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));
jest.mock('@/lib/use-selected-address', () => ({ useSelectedAddress: jest.fn() }));
jest.mock('expo-router', () => ({
    useFocusEffect: MockUseFocusEffect,
    useLocalSearchParams: MockParams,
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));

function MockUseFocusEffect(callback: () => void) {
    useEffect(callback, [callback]);
}

let params: Record<string, string> = {};

function MockParams() {
    return params;
}

const method = { value: 'per_job', label: 'Per job', is_on_request: false };

const listing = (id: string, provider: string, price: number) => ({
    id,
    description: null,
    pricing_method: method,
    rates: [],
    price_min: price,
    price_max: null,
    provider: { id: `p-${id}`, name: provider, slug: id },
});

/** One row nobody covers, carrying the market's list with it. */
const uncovered = {
    id: 's1',
    name: 'Freon Recharge',
    description: null,
    covering: null,
    alternatives: [listing('l2', 'Matina Cooling Works', 90_000)],
};

/** One row that has an answer, so it carries no list at all. */
const covered = {
    id: 's2',
    name: 'Aircon Cleaning',
    description: null,
    covering: listing('l1', 'Kool Breeze Aircon Services', 80_000),
};

function answering(handler: (path: string) => unknown) {
    const request = jest.fn(async (path: string) => handler(path));

    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        authenticatedRequest: request,
        reload: jest.fn(),
    });

    (useSelectedAddress as jest.Mock).mockReturnValue({
        address: { id: 'a1', label: 'Home', latitude: 7.07, longitude: 125.61 },
        ready: true,
    });

    return request;
}

beforeEach(() => {
    jest.clearAllMocks();
    forget();
});

// The list is answered everything the picker needs, so opening the picker after
// it should cost nothing. This is the whole point of carrying alternatives on
// the rows rather than fetching them a screen later.
it('opens the picker on providers without asking again', async () => {
    params = { id: 'c1', name: 'Air Condition' };

    const request = answering(() => ({
        data: [covered, uncovered],
        market: { id: 'm1', name: 'Davao City' },
    }));

    render(<TradeServices />);

    await waitFor(() => expect(screen.getByText('Freon Recharge')).toBeOnTheScreen());

    const asked = request.mock.calls.length;

    params = { id: 's1', name: 'Freon Recharge', trade: 'Air Condition' };

    render(<ServiceOffers />);

    // On the first frame, from what the list already knew.
    expect(screen.getByText('Matina Cooling Works')).toBeOnTheScreen();
    expect(screen.getByText('No one covers your area for Freon Recharge')).toBeOnTheScreen();
    expect(request.mock.calls).toHaveLength(asked);
});

it('asks for itself when it was not reached through a list', async () => {
    params = { id: 's1', name: 'Freon Recharge', trade: 'Air Condition' };

    const request = answering(() => ({
        data: uncovered,
        market: { id: 'm1', name: 'Davao City' },
        covering: null,
        alternatives: [listing('l2', 'Matina Cooling Works', 90_000)],
    }));

    render(<ServiceOffers />);

    await waitFor(() => expect(screen.getByText('Matina Cooling Works')).toBeOnTheScreen());
    expect(request).toHaveBeenCalledWith('/services/s1?address=a1');
});

// Coverage is decided by the pin, so every remembered answer is wrong the
// moment the pin changes. Nothing survives it.
it('forgets what it knew when work moves to another address', async () => {
    params = { id: 'c1', name: 'Air Condition' };

    const request = answering(() => ({
        data: [uncovered],
        market: { id: 'm1', name: 'Davao City' },
    }));

    render(<TradeServices />);

    await waitFor(() => expect(screen.getByText('Freon Recharge')).toBeOnTheScreen());

    (useSelectedAddress as jest.Mock).mockReturnValue({
        address: { id: 'a2', label: 'Office', latitude: 7.11, longitude: 125.63 },
        ready: true,
    });

    params = { id: 's1', name: 'Freon Recharge', trade: 'Air Condition' };

    render(<ServiceOffers />);

    await waitFor(() => expect(request).toHaveBeenCalledWith('/services/s1?address=a2'));
});

// A covered row has an answer, so it is never sent a list -- and the picker is
// never the screen it opens.
it('remembers nothing to choose from for a row that has an answer', async () => {
    params = { id: 'c1', name: 'Air Condition' };

    answering(() => ({
        data: [covered],
        market: { id: 'm1', name: 'Davao City' },
    }));

    render(<TradeServices />);

    await waitFor(() => expect(screen.getByText('Aircon Cleaning')).toBeOnTheScreen());

    params = { id: 's2', name: 'Aircon Cleaning', trade: 'Air Condition' };

    render(<ServiceOffers />);

    expect(screen.queryByText('Nobody offers this yet')).not.toBeOnTheScreen();

    const { router } = jest.requireMock('expo-router') as { router: { replace: jest.Mock } };

    await waitFor(() =>
        expect(router.replace).toHaveBeenCalledWith(
            expect.objectContaining({
                pathname: '/book',
                params: expect.objectContaining({ listing: 'l1', covered: '1' }),
            }),
        ),
    );
});
