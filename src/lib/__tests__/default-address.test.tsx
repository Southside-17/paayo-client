import { render, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';

import ServiceOffers from '@/app/(app)/service/[id]';
import { useSession } from '@/lib/session';
import { router } from 'expo-router';

jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));
jest.mock('expo-router', () => ({
    useFocusEffect: MockUseFocusEffect,
    useLocalSearchParams: () => ({ id: 's1', name: 'Cleaning', category: 'Air Condition' }),
    router: { replace: jest.fn(), back: jest.fn(), push: jest.fn() },
}));

/** Declared, not assigned: jest.mock is hoisted above the imports. */
function MockUseFocusEffect(callback: () => void) {
    useEffect(callback, [callback]);
}

const service = {
    id: 's1',
    name: 'Cleaning',
    description: null,
    pricing_unit: { value: 'fixed', label: 'Fixed price', suffix: '', is_quoted: false },
};

/**
 * The real useDefaultAddress, deliberately not mocked.
 *
 * Every other test here stands one in, which hides the thing most likely to go
 * wrong: this screen asks a question whose answer depends on an address that
 * arrives from a second request, and asking before it lands sends no address at
 * all -- which the server answers with no provider, and the screen reports as
 * nobody serving the area.
 */
it('asks with the default address, once, and not before it has one', async () => {
    const request = jest.fn(async (path: string) => {
        if (path === '/addresses') {
            return {
                data: [
                    {
                        id: 'a1',
                        label: 'Home',
                        is_default: true,
                        latitude: 7.07,
                        longitude: 125.61,
                    },
                ],
            };
        }

        return {
            data: service,
            market: { id: 'm1', name: 'Davao City' },
            covering: {
                id: 'l1',
                description: null,
                price_min: 80_000,
                price_max: null,
                provider: { id: 'p1', name: 'Kool Breeze Aircon Services', slug: 'kool-breeze' },
            },
            alternatives: [],
        };
    });

    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        authenticatedRequest: request,
        reload: jest.fn(),
    });

    render(<ServiceOffers />);

    await waitFor(() => expect(router.replace).toHaveBeenCalled());

    const asked = request.mock.calls
        .map(([path]) => path as string)
        .filter((path) => path.startsWith('/services/'));

    expect(asked).toEqual(['/services/s1?address=a1']);
});
