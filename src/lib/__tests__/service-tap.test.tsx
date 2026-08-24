import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';

import TradeServices from '@/app/(app)/trade/[id]';
import { useSession } from '@/lib/session';
import { useSelectedAddress } from '@/lib/use-selected-address';
import { router } from 'expo-router';

jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));
jest.mock('@/lib/use-selected-address', () => ({ useSelectedAddress: jest.fn() }));
jest.mock('expo-router', () => ({
    useFocusEffect: MockUseFocusEffect,
    useLocalSearchParams: () => ({ id: 'c1', name: 'Air Condition' }),
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));

/** Declared, not assigned: jest.mock is hoisted above the imports. */
function MockUseFocusEffect(callback: () => void) {
    useEffect(callback, [callback]);
}


function listed(covering: object | null) {
    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        authenticatedRequest: jest.fn(async () => ({
            data: [
                {
                    id: 's1',
                    name: 'Cleaning',
                    description: null,
                    covering,
                },
            ],
        })),
        reload: jest.fn(),
    });
    (useSelectedAddress as jest.Mock).mockReturnValue({
        address: { id: 'a1', label: 'Home', latitude: 7.07, longitude: 125.61 },
        ready: true,
    });
}

beforeEach(() => jest.clearAllMocks());

// The list already carries the answer, so the tap goes where it belongs. Working
// it out on the next screen is what showed a provider picker for an instant
// before it replaced itself.
// Straight to the price, not straight to the date picker. Skipping the rate
// card is what let a booking be placed without ever seeing a figure.
it('goes straight to the offer price when the list already names a provider', async () => {
    listed({
        id: 'l1',
        description: null,
        price_min: 80_000,
        price_max: null,
        provider: { id: 'p1', name: 'Kool Breeze Aircon Services', slug: 'kool-breeze' },
    });

    render(<TradeServices />);

    await waitFor(() => expect(screen.getByText('Cleaning')).toBeOnTheScreen());

    fireEvent.press(screen.getByText('Cleaning'));

    expect(router.push).toHaveBeenCalledWith({
        pathname: '/listing/[id]',
        params: {
            id: 'l1',
            serviceId: 's1',
            service: 'Cleaning',
            trade: 'Air Condition',
            covered: '1',
        },
    });
});

it('goes to the picker when nobody covers the address', async () => {
    listed(null);

    render(<TradeServices />);

    await waitFor(() => expect(screen.getByText('Cleaning')).toBeOnTheScreen());

    fireEvent.press(screen.getByText('Cleaning'));

    expect(router.push).toHaveBeenCalledWith({
        pathname: '/service/[id]',
        params: { id: 's1', name: 'Cleaning', trade: 'Air Condition' },
    });
});
