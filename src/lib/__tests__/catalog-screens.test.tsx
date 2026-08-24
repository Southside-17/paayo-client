import { render, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import TradeServices from '@/app/(app)/trade/[id]';
import ServiceOffers from '@/app/(app)/service/[id]';
import Home from '@/app/(app)/(tabs)/index';
import { Skeleton } from '@/components/ui/skeleton';
import { AddressesProvider } from '@/lib/addresses';
import { useSession } from '@/lib/session';

jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));

jest.mock('expo-router', () => ({
    Link: MockLink,
    useFocusEffect: MockUseFocusEffect,
    useLocalSearchParams: MockParams,
}));

function MockLink({ children }: { href: unknown; children: ReactNode }) {
    return <View>{children}</View>;
}

function MockUseFocusEffect(callback: () => void) {
    useEffect(callback, [callback]);
}

// Read at call time, so each test can say what the tapped row carried. A
// hoisted function may close over this; the factory itself may not.
let params: Record<string, string> = {};

function MockParams() {
    return params;
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

/** A request that never settles, so the loading state is what renders. */
function pending() {
    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        user,
        token: 'a-token',
        authenticatedRequest: jest.fn(() => new Promise(() => {})),
        reload: jest.fn(),
    });
}

function answering(data: unknown) {
    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        user,
        token: 'a-token',
        authenticatedRequest: jest.fn(() => Promise.resolve({ data })),
        reload: jest.fn(),
    });
}

/** Screens read the address from the provider, so the tree needs one. */
function inApp(ui: ReactNode) {
    return render(<AddressesProvider>{ui}</AddressesProvider>);
}

it('holds the shape of the grid while the catalog is on its way', () => {
    params = {};
    pending();

    inApp(<Home />);

    expect(screen.UNSAFE_getAllByType(Skeleton).length).toBeGreaterThan(0);
});

it('holds the shape of the list while the services are on their way', () => {
    params = { id: 'c1', name: 'Air Condition' };
    pending();

    inApp(<TradeServices />);

    expect(screen.UNSAFE_getAllByType(Skeleton).length).toBeGreaterThan(0);
});

// The tile that was tapped already knows the name, so the title must not
// settle from a placeholder once the services land.
it('opens with the name of the trade that was tapped', () => {
    params = { id: 'c1', name: 'Air Condition' };
    pending();

    inApp(<TradeServices />);

    expect(screen.getByText('Air Condition')).toBeOnTheScreen();
});

it('drops the skeleton once the services arrive', async () => {
    params = { id: 'c1', name: 'Air Condition' };
    answering([
        {
            id: 's1',
            name: 'Cleaning',
            description: 'Strip and wash the unit.',
            
            trade: {
                id: 'c1',
                name: 'Air Condition',
                slug: 'air-condition',
                icon: 'air-conditioning',
                units: [],
            },
        },
    ]);

    inApp(<TradeServices />);

    await waitFor(() => expect(screen.getByText('Cleaning')).toBeOnTheScreen());
    expect(screen.UNSAFE_queryAllByType(Skeleton)).toHaveLength(0);
});

// The provider list is one screen further down and had the same fault: it
// opened saying "Service" and renamed itself once the offers landed.
it('opens the provider list with the service that was tapped', () => {
    params = { id: 's1', name: 'Cleaning', trade: 'Air Condition' };
    pending();

    inApp(<ServiceOffers />);

    expect(screen.getByText('Cleaning')).toBeOnTheScreen();
    expect(screen.UNSAFE_getAllByType(Skeleton).length).toBeGreaterThan(0);
    expect(screen.queryByText('Service')).toBeNull();
});
