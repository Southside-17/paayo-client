import { render, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';

import ServiceOffers from '@/app/(app)/service/[id]';
import { ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useDefaultAddress } from '@/lib/use-default-address';
import { router } from 'expo-router';

/** Hoisted above jest.mock, which may not reach an imported binding. */
function MockUseFocusEffect(callback: () => void) {
    useEffect(callback, [callback]);
}

jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));
jest.mock('@/lib/use-default-address', () => ({ useDefaultAddress: jest.fn() }));
jest.mock('expo-router', () => ({
    useFocusEffect: MockUseFocusEffect,
    useLocalSearchParams: () => ({ id: 's1', name: 'Cleaning', category: 'Air Condition' }),
    router: { replace: jest.fn(), back: jest.fn(), push: jest.fn() },
}));

const service = {
    id: 's1',
    name: 'Cleaning',
    description: 'Strip, wash and reassemble the unit.',
    pricing_unit: { value: 'fixed', label: 'Fixed price', suffix: '', is_quoted: false },
};

const listing = (id: string, provider: string) => ({
    id,
    description: null,
    price_min: 80_000,
    price_max: null,
    provider: { id: `p-${id}`, name: provider, slug: provider.toLowerCase() },
});

function signedIn(authenticatedRequest: jest.Mock) {
    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        authenticatedRequest,
        reload: jest.fn(),
    });
    (useDefaultAddress as jest.Mock).mockReturnValue({
        address: { id: 'a1', label: 'Home', latitude: 7.07, longitude: 125.61 },
        ready: true,
    });
}

beforeEach(() => jest.clearAllMocks());

// Scenario 1. A provider covering the address is chosen without asking, so this
// screen is never a step the client sees.
it('hands straight to booking when a provider covers the address', async () => {
    signedIn(
        jest.fn(async () => ({
            data: service,
            market: { id: 'm1', name: 'Davao City' },
            covering: listing('l1', 'Kool Breeze Aircon Services'),
            alternatives: [],
        })),
    );

    render(<ServiceOffers />);

    await waitFor(() => expect(router.replace).toHaveBeenCalled());

    expect(router.replace).toHaveBeenCalledWith(
        expect.objectContaining({
            pathname: '/book',
            params: expect.objectContaining({
                listing: 'l1',
                provider: 'Kool Breeze Aircon Services',
                covered: '1',
            }),
        }),
    );
});

// Scenario 2. Nobody covers that zone, so the client picks from the market --
// and the screen says why it is asking rather than showing a bare list.
it('explains itself, naming the service and the market, when nobody covers', async () => {
    signedIn(
        jest.fn(async () => ({
            data: service,
            market: { id: 'm1', name: 'Davao City' },
            covering: null,
            alternatives: [listing('l2', 'Davao Aircon Specialists')],
        })),
    );

    render(<ServiceOffers />);

    await waitFor(() =>
        expect(screen.getByText('No one covers your area for Cleaning')).toBeOnTheScreen(),
    );

    expect(
        screen.getByText(
            'These providers offer it elsewhere in Davao City and can still take the job, but they may add a travel charge when they accept.',
        ),
    ).toBeOnTheScreen();

    expect(screen.getByText('Davao Aircon Specialists')).toBeOnTheScreen();
    expect(router.replace).not.toHaveBeenCalled();
});

// The address arrives after the first render, and the answer depends on it.
// Asking before it settles is what would silently produce an empty screen.
it('waits for the address, then asks again with it', async () => {
    const request = jest.fn(async () => ({
        data: service,
        market: { id: 'm1', name: 'Davao City' },
        covering: listing('l1', 'Kool Breeze Aircon Services'),
        alternatives: [],
    }));

    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        authenticatedRequest: request,
        reload: jest.fn(),
    });
    (useDefaultAddress as jest.Mock).mockReturnValue({ address: null, ready: false });

    const view = render(<ServiceOffers />);

    expect(request).not.toHaveBeenCalled();

    (useDefaultAddress as jest.Mock).mockReturnValue({
        address: { id: 'a1', label: 'Home', latitude: 7.07 },
        ready: true,
    });

    view.rerender(<ServiceOffers />);

    await waitFor(() => expect(request).toHaveBeenCalledWith('/services/s1?address=a1'));
});

it('asks the client for an address rather than blaming the catalog', async () => {
    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        authenticatedRequest: jest.fn(async () => ({ data: service })),
        reload: jest.fn(),
    });
    (useDefaultAddress as jest.Mock).mockReturnValue({ address: null, ready: true });

    render(<ServiceOffers />);

    await waitFor(() => expect(screen.getByText('Where should they go?')).toBeOnTheScreen());
});

it('says an address has no pin instead of saying nobody serves it', async () => {
    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        authenticatedRequest: jest.fn(async () => ({
            data: service,
            market: { id: 'm1', name: 'Davao City' },
            covering: null,
            alternatives: [],
        })),
        reload: jest.fn(),
    });
    (useDefaultAddress as jest.Mock).mockReturnValue({
        address: { id: 'a1', label: 'Home', latitude: null },
        ready: true,
    });

    render(<ServiceOffers />);

    await waitFor(() => expect(screen.getByText('Home has no pin')).toBeOnTheScreen());
});

it('shows a refusal rather than sitting on a skeleton', async () => {
    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        authenticatedRequest: jest.fn(async () => {
            throw new ApiError(422, 'Unprocessable', {
                address: ['Drop a pin on this address before searching from it.'],
            });
        }),
        reload: jest.fn(),
    });
    (useDefaultAddress as jest.Mock).mockReturnValue({
        address: { id: 'a1', label: 'Home', latitude: 7.07 },
        ready: true,
    });

    render(<ServiceOffers />);

    await waitFor(() =>
        expect(
            screen.getByText('Drop a pin on this address before searching from it.'),
        ).toBeOnTheScreen(),
    );
});

it('says nobody offers it rather than showing an empty list', async () => {
    signedIn(
        jest.fn(async () => ({
            data: service,
            market: { id: 'm1', name: 'Davao City' },
            covering: null,
            alternatives: [],
        })),
    );

    render(<ServiceOffers />);

    await waitFor(() => expect(screen.getByText('Nobody offers this yet')).toBeOnTheScreen());
});
