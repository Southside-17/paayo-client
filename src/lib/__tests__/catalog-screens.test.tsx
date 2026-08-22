import { render, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import CategoryServices from '@/app/(app)/category/[id]';
import Home from '@/app/(app)/(tabs)/index';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/lib/session';

jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));
jest.mock('expo-router', () => ({
    Link: MockLink,
    useFocusEffect: MockUseFocusEffect,
    useLocalSearchParams: () => ({ id: 'c1', name: 'Air Condition' }),
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

it('holds the shape of the grid while the catalog is on its way', () => {
    pending();

    render(<Home />);

    expect(screen.UNSAFE_getAllByType(Skeleton).length).toBeGreaterThan(0);
});

it('holds the shape of the list while the services are on their way', () => {
    pending();

    render(<CategoryServices />);

    expect(screen.UNSAFE_getAllByType(Skeleton).length).toBeGreaterThan(0);
});

// The tile that was tapped already knows the name, so the title must not
// settle from a placeholder once the services land.
it('opens with the name of the trade that was tapped', () => {
    pending();

    render(<CategoryServices />);

    expect(screen.getByText('Air Condition')).toBeOnTheScreen();
});

it('drops the skeleton once the services arrive', async () => {
    answering([
        {
            id: 's1',
            name: 'Cleaning',
            description: 'Strip and wash the unit.',
            pricing_unit: { value: 'per-unit', label: 'Per unit', suffix: ' per unit', is_quoted: false },
            category: { id: 'c1', name: 'Air Condition', slug: 'air-condition', icon: 'air-conditioning' },
        },
    ]);

    render(<CategoryServices />);

    await waitFor(() => expect(screen.getByText('Cleaning')).toBeOnTheScreen());
    expect(screen.UNSAFE_queryAllByType(Skeleton)).toHaveLength(0);
});
