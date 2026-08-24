import { fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect } from 'react';

import Services from '@/app/(app)/(provider)/services';
import { useSession } from '@/lib/session';
import type { ProviderListing, Service, Staff, Trade } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';

jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));
jest.mock('@/lib/workspace', () => ({ useWorkspace: jest.fn() }));
jest.mock('expo-router', () => ({
    useFocusEffect: MockUseFocusEffect,
    router: { push: jest.fn() },
}));

function MockUseFocusEffect(callback: () => void) {
    useEffect(callback, [callback]);
}

const FIXED = { value: 'per_job', label: 'Per job', is_on_request: false };

function service(id: string, name: string): Service {
    return { id, name, description: null };
}

function trade(id: string, name: string, services: Service[]): Trade {
    return { id, name, slug: name.toLowerCase(), icon: null, units: [], services };
}

function offering(id: string, named: Service, tradeOf: Trade, over: Partial<ProviderListing> = {}) {
    return {
        id,
        description: null,
        pricing_method: FIXED,
        rates: [],
        allows_many_lines: false,
        intake: [],
        price_min: 150_000,
        price_max: null,
        paused_at: null,
        service: { ...named, trade: tradeOf },
        standing: { wording: 'live', tone: 'success', reason: 'Taking work.' },
        ...over,
    } as ProviderListing;
}

const aircon = trade('t1', 'Aircon', [service('sv1', 'Cleaning'), service('sv2', 'Ducting')]);

function acting(permissions = ['listing:view']) {
    (useWorkspace as jest.Mock).mockReturnValue({
        staff: {
            id: 's1',
            role: 'owner',
            role_label: 'Owner',
            permissions,
            resignation_requested_at: null,
            resignation_lapses_at: null,
            provider: {
                id: 'p1',
                name: 'Matina Cooling Works',
                slug: 'matina',
                market: { id: 'm1', name: 'Davao City' },
                registration_verified: true,
                suspension: null,
            },
        } as Staff,
        businesses: [],
        enter: jest.fn(),
        leave: jest.fn(),
    });
}

function answering(listings: ProviderListing[], trades: Trade[] = [aircon]) {
    return jest.fn(async (path: string) =>
        path.includes('/listings') ? { data: listings } : { data: trades },
    );
}

function signedIn(authenticatedRequest: jest.Mock) {
    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        user: { id: 'u1', nickname: 'Mara', staffs: [] },
        token: 'a-token',
        authenticatedRequest,
        reload: jest.fn(),
        logout: jest.fn(),
    });
}

beforeEach(() => jest.clearAllMocks());

describe('what a business sells', () => {
    it('reads its offers and the catalog off the business being acted as', async () => {
        acting();
        const request = answering([]);
        signedIn(request);

        render(<Services />);

        expect(await screen.findByText('Nothing to sell yet')).toBeOnTheScreen();
        expect(request).toHaveBeenCalledWith('/providers/p1/listings');
        expect(request).toHaveBeenCalledWith('/trades');
    });

    it('leads each offer with the service, its price and where it stands', async () => {
        acting();
        signedIn(answering([offering('l1', service('sv1', 'Cleaning'), aircon)]));

        render(<Services />);

        expect(await screen.findByText('Cleaning')).toBeOnTheScreen();
        expect(screen.getByText('from ₱1,500')).toBeOnTheScreen();
        expect(screen.getByText('live')).toBeOnTheScreen();
    });

    // A live row says its price and nothing else; silence is the good state.
    it('says why only when the offer is not taking work', async () => {
        acting();
        signedIn(
            answering([
                offering('l1', service('sv1', 'Cleaning'), aircon, {
                    paused_at: '2026-08-01T00:00:00.000000Z',
                    standing: {
                        wording: 'paused',
                        tone: 'warning',
                        reason: 'Not taking work right now. Start it again when you are ready.',
                    },
                }),
            ]),
        );

        render(<Services />);

        expect(await screen.findByText('paused')).toBeOnTheScreen();
        expect(
            screen.getByText('Not taking work right now. Start it again when you are ready.'),
        ).toBeOnTheScreen();
    });

    it('heads each trade once, in the order the server sent them', async () => {
        acting();
        const plumbing = trade('t2', 'Plumbing', []);
        signedIn(
            answering([
                offering('l1', service('sv1', 'Cleaning'), aircon),
                offering('l2', service('sv2', 'Ducting'), aircon),
                offering('l3', service('sv3', 'Drain Cleaning'), plumbing),
            ]),
        );

        render(<Services />);

        expect(await screen.findAllByText('Aircon')).toHaveLength(1);
        expect(screen.getByText('Plumbing')).toBeOnTheScreen();
    });
});

describe('the catalog', () => {
    it('marks the services this business already sells', async () => {
        acting();
        signedIn(answering([offering('l1', service('sv1', 'Cleaning'), aircon)]));

        render(<Services />);

        await screen.findByText('Cleaning');

        fireEvent.press(screen.getByText('catalog'));

        expect(screen.getByText('You sell this · from ₱1,500')).toBeOnTheScreen();
        expect(screen.getByText('Not sold here')).toBeOnTheScreen();
    });

    it('filters on a search and keeps the trade the hit belongs to', async () => {
        acting();
        signedIn(answering([]));

        render(<Services />);

        await screen.findByText('Nothing to sell yet');

        fireEvent.press(screen.getByText('catalog'));
        fireEvent.changeText(screen.getByPlaceholderText('Search 2 services'), 'duct');

        expect(screen.getByText('Ducting')).toBeOnTheScreen();
        expect(screen.queryByText('Cleaning')).not.toBeOnTheScreen();
        expect(screen.getByText('Aircon')).toBeOnTheScreen();
    });

    // Says the catalog lacks it, not that the search failed. A bare "no
    // results" reads as the app not looking properly.
    it('blames the catalog when a search finds nothing, and names who can fix it', async () => {
        acting();
        signedIn(answering([]));

        render(<Services />);

        await screen.findByText('Nothing to sell yet');

        fireEvent.press(screen.getByText('catalog'));
        fireEvent.changeText(screen.getByPlaceholderText('Search 2 services'), 'pool');

        expect(screen.getByText(/Paayo does not publish a service by that name/)).toBeOnTheScreen();

        fireEvent.press(screen.getByText('Clear the search'));

        expect(screen.getByText('Cleaning')).toBeOnTheScreen();
    });
});

describe('when it cannot be loaded', () => {
    it('says what did not happen and that nothing has changed', async () => {
        acting();
        signedIn(jest.fn().mockRejectedValue(new Error('offline')));

        render(<Services />);

        expect(await screen.findByText('Could not reach Paayo')).toBeOnTheScreen();
        expect(screen.getByText(/What you sell has not changed/)).toBeOnTheScreen();
        expect(screen.getByText('Try again')).toBeOnTheScreen();
    });
});

// A business could see a band and nothing else -- not its own lines, not its
// own questions, and nothing to tap.
it('says how many prices and questions an offer carries', async () => {
    acting();
    signedIn(answering([
        offering('l1', service('sv1', 'Cleaning'), aircon, {
            rates: [
                {
                    label: 'Window type',
                    amount: 80_000,
                    unit: 'unit',
                    estimated_minutes: null,
                    maximum_minutes: null,
                    is_active: true,
                },
                {
                    label: 'Split type',
                    amount: 100_000,
                    unit: 'unit',
                    estimated_minutes: null,
                    maximum_minutes: null,
                    is_active: true,
                },
            ],
            intake: ['Which floor is the unit on?'],
        }),
    ]));

    render(<Services />);

    expect(await screen.findByText('2 prices · 1 question')).toBeOnTheScreen();
});

it('opens an offer to be edited', async () => {
    acting();
    signedIn(answering([offering('l1', service('sv1', 'Cleaning'), aircon)]));

    render(<Services />);

    fireEvent.press(await screen.findByLabelText('Edit Cleaning'));

    const { router } = jest.requireMock('expo-router') as { router: { push: jest.Mock } };

    expect(router.push).toHaveBeenCalledWith(
        expect.objectContaining({
            pathname: '/offer/[id]',
            params: { id: 'l1', name: 'Cleaning' },
        }),
    );
});
