import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';

import Business from '@/app/(app)/(provider)/business';
import ProviderLayout from '@/app/(app)/(provider)/_layout';
import Job from '@/app/(app)/job/[id]';
import Jobs from '@/app/(app)/(provider)/jobs';
import Account from '@/app/(app)/(tabs)/account';
import Switch from '@/app/(app)/switch';
import { useSession } from '@/lib/session';
import type { Booking, Staff, SuspensionNotice } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';

jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));
jest.mock('@/lib/workspace', () => ({ useWorkspace: jest.fn() }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-router', () => ({
    Link: MockLink,
    Redirect: MockRedirect,
    Tabs: MockTabs,
    useFocusEffect: MockUseFocusEffect,
    useLocalSearchParams: () => ({ id: 'b1', name: 'Aircon cleaning' }),
    router: { back: jest.fn(), dismissAll: jest.fn(), replace: jest.fn() },
}));

function MockLink({ href, children }: { href: unknown; children: ReactNode }) {
    return <View accessibilityLabel={`to ${String(href)}`}>{children}</View>;
}

function MockRedirect({ href }: { href: string }) {
    return <View accessibilityLabel={`redirect ${href}`} />;
}

function MockTabs({ children }: { children: ReactNode }) {
    return <View accessibilityLabel="tabs">{children}</View>;
}

MockTabs.Screen = function MockTabsScreen({ name }: { name: string }) {
    return <View accessibilityLabel={`tab ${name}`} />;
};

function MockUseFocusEffect(callback: () => void) {
    useEffect(callback, [callback]);
}

const held: SuspensionNotice = {
    scope: 'activity',
    notice: 'The business stays listed, but its work is on hold while this is in force.',
    punitive: true,
    reason: 'Conduct',
    starts_at: '2026-08-01T00:00:00.000000Z',
    ends_at: null,
    appealed_at: null,
};

function staffAt(id: string, name: string, over: Partial<Staff['provider']> = {}): Staff {
    return {
        id,
        role: 'owner',
        role_label: 'Owner',
        permissions: ['booking:view'],
        provider: {
            id: `p-${id}`,
            name,
            slug: name.toLowerCase().replace(/\s+/g, '-'),
            market: { id: 'm1', name: 'Davao City' },
            registration_verified: true,
            suspension: null,
            ...over,
        },
    };
}

const job: Booking = {
    id: 'b1',
    status: {
        value: 'pending',
        label: 'Awaiting a provider',
        wording: 'awaiting a provider',
        tone: 'info',
        is_open: true,
    },
    description: 'The unit drips.',
    scheduled_at: '2026-09-01T02:00:00.000000Z',
    cancelled_at: null,
    price_min: 150_000,
    price_max: null,
    address: { label: 'Home', line: '12 Mabini Street, Poblacion' },
    latitude: 7.07,
    longitude: 125.61,
    surcharge: null,
    service: {
        id: 's1',
        name: 'Aircon cleaning',
        pricing_unit: { value: 'unit', label: 'per unit', suffix: '/unit', is_quoted: false },
    },
    provider: { id: 'p-s1', name: 'Bright Electric' },
    client: { id: 'u9', nickname: 'Mara', phone: '09171234567' },
    created_at: '2026-08-01T00:00:00.000000Z',
};

const enter = jest.fn();
const leave = jest.fn();

function acting(staff: Staff | null, businesses: Staff[] = staff ? [staff] : []) {
    (useWorkspace as jest.Mock).mockReturnValue({ staff, businesses, enter, leave });
}

function signedIn(authenticatedRequest: jest.Mock = jest.fn(), staffs: Staff[] = []) {
    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        user: {
            id: 'u1',
            nickname: 'Mara',
            fullname: null,
            phone: null,
            avatar: false,
            email: 'mara@example.com',
            email_verified: true,
            identification_verified: true,
            two_factor_enabled: false,
            has_password: true,
            administrator: false,
            suspension: null,
            staffs,
            created_at: '2026-01-01T00:00:00.000000Z',
        },
        token: 'a-token',
        authenticatedRequest,
        reload: jest.fn(),
        logout: jest.fn(),
    });
}

beforeEach(() => jest.clearAllMocks());

describe('the way in', () => {
    it('offers no switch to an account that is on no staff', () => {
        signedIn();

        render(<Account />);

        expect(screen.queryByText(/Switch to/)).not.toBeOnTheScreen();
    });

    // One business is named outright: that reads as the thing it does, where
    // "a business" reads as a category of thing.
    it('names the one business rather than calling it a business', () => {
        signedIn(jest.fn(), [staffAt('s1', 'Bright Electric')]);

        render(<Account />);

        expect(screen.getByText('Switch to Bright Electric')).toBeOnTheScreen();
    });

    it('stops naming them once there is more than one', () => {
        signedIn(jest.fn(), [staffAt('s1', 'Bright Electric'), staffAt('s2', 'Zamora Aircon')]);

        render(<Account />);

        expect(screen.getByText('Switch to a business')).toBeOnTheScreen();
        expect(screen.getByText('2 businesses')).toBeOnTheScreen();
    });
});

describe('the switcher', () => {
    it('lists personal above every business', () => {
        acting(null, [staffAt('s1', 'Bright Electric'), staffAt('s2', 'Zamora Aircon')]);

        render(<Switch />);

        expect(screen.getByText('Personal')).toBeOnTheScreen();
        expect(screen.getByText('Bright Electric')).toBeOnTheScreen();
        expect(screen.getByText('Zamora Aircon')).toBeOnTheScreen();
    });

    it('switches into the business that was tapped', () => {
        const business = staffAt('s1', 'Bright Electric');
        acting(null, [business]);

        render(<Switch />);

        fireEvent.press(screen.getByText('Bright Electric'));

        expect(enter).toHaveBeenCalledWith(business);
    });

    it('switches back out to personal', () => {
        acting(staffAt('s1', 'Bright Electric'));

        render(<Switch />);

        fireEvent.press(screen.getByText('Personal'));

        expect(leave).toHaveBeenCalled();
    });

    // Held businesses stay on the list and stay tappable. Hiding one would be
    // the single way of never being told about it.
    it('keeps a suspended business listed, and says so on the row', () => {
        const suspended = staffAt('s1', 'Held Cooling', { suspension: held });
        acting(null, [suspended]);

        render(<Switch />);

        expect(screen.getByText('suspended')).toBeOnTheScreen();

        fireEvent.press(screen.getByText('Held Cooling'));

        expect(enter).toHaveBeenCalledWith(suspended);
    });
});

describe('the business side', () => {
    it('is not entered without a business to act as', () => {
        acting(null);

        render(<ProviderLayout />);

        expect(screen.getByLabelText('redirect /')).toBeOnTheScreen();
    });

    it('opens on jobs, with the business beside it', () => {
        acting(staffAt('s1', 'Bright Electric'));

        render(<ProviderLayout />);

        expect(screen.getByLabelText('tab jobs')).toBeOnTheScreen();
        expect(screen.getByLabelText('tab business')).toBeOnTheScreen();
    });

    it('reads the queue off the business being acted as', async () => {
        acting(staffAt('s1', 'Bright Electric'));
        const authenticatedRequest = jest.fn().mockResolvedValue({ data: [job] });
        signedIn(authenticatedRequest);

        render(<Jobs />);

        await waitFor(() =>
            expect(authenticatedRequest).toHaveBeenCalledWith('/providers/p-s1/bookings'),
        );
    });

    it('leads each job with the work, the client and when they are expected', async () => {
        acting(staffAt('s1', 'Bright Electric'));
        signedIn(jest.fn().mockResolvedValue({ data: [job] }));

        render(<Jobs />);

        expect(await screen.findByText('Aircon cleaning')).toBeOnTheScreen();
        expect(screen.getByText('Mara')).toBeOnTheScreen();
        expect(screen.getByText('12 Mabini Street, Poblacion')).toBeOnTheScreen();
    });

    it('says so when there is nothing booked', async () => {
        acting(staffAt('s1', 'Bright Electric'));
        signedIn(jest.fn().mockResolvedValue({ data: [] }));

        render(<Jobs />);

        expect(await screen.findByText('Nothing booked yet')).toBeOnTheScreen();
    });

    it('puts the hold on the queue, where the work would be', async () => {
        acting(staffAt('s1', 'Held Cooling', { suspension: held }));
        signedIn(jest.fn().mockResolvedValue({ data: [] }));

        render(<Jobs />);

        expect(await screen.findByText('This business is suspended')).toBeOnTheScreen();
        expect(screen.getByText(held.notice)).toBeOnTheScreen();
    });

    // punitive is false for an investigation, a compromised account and a legal
    // order. Calling any of those a suspension accuses somebody of something.
    it('does not call a protective hold a suspension', async () => {
        acting(
            staffAt('s1', 'Held Cooling', {
                suspension: { ...held, punitive: false, reason: 'Under investigation' },
            }),
        );
        signedIn(jest.fn().mockResolvedValue({ data: [] }));

        render(<Jobs />);

        expect(await screen.findByText('This business is on hold')).toBeOnTheScreen();
    });

    it('names the market the business is locked to', () => {
        acting(staffAt('s1', 'Bright Electric'));

        render(<Business />);

        expect(screen.getByText('Davao City')).toBeOnTheScreen();
        expect(screen.getByText('registered')).toBeOnTheScreen();
    });

    it('warns when no market has been set, since nothing can be booked', () => {
        acting(staffAt('s1', 'Bright Electric', { market: null, registration_verified: false }));

        render(<Business />);

        expect(screen.getByText(/No market yet/)).toBeOnTheScreen();
        expect(screen.getByText('not registered')).toBeOnTheScreen();
    });

    it('shows one job in full, leading with who asked and how to reach them', async () => {
        acting(staffAt('s1', 'Bright Electric'));
        signedIn(jest.fn().mockResolvedValue({ data: job }));

        render(<Job />);

        // Twice on purpose, matching the client's own booking screen: the
        // eyebrow frames the job and the card answers "Who asked?".
        expect(await screen.findAllByText('Mara')).toHaveLength(2);
        expect(screen.getByText('09171234567')).toBeOnTheScreen();
        expect(screen.getByText('The unit drips.')).toBeOnTheScreen();
    });

    it('reads one job off the business being acted as', async () => {
        acting(staffAt('s1', 'Bright Electric'));
        const authenticatedRequest = jest.fn().mockResolvedValue({ data: job });
        signedIn(authenticatedRequest);

        render(<Job />);

        await waitFor(() =>
            expect(authenticatedRequest).toHaveBeenCalledWith('/providers/p-s1/bookings/b1'),
        );
    });

    // Said in a sentence rather than drawn as a disabled button: a greyed-out
    // control reads as something that is temporarily unavailable.
    it('says taking work is not built rather than offering a dead button', async () => {
        acting(staffAt('s1', 'Bright Electric'));
        signedIn(jest.fn().mockResolvedValue({ data: job }));

        render(<Job />);

        expect(
            await screen.findByText('Taking and turning down work is not here yet.'),
        ).toBeOnTheScreen();
    });

    it('offers the way back to personal', () => {
        acting(staffAt('s1', 'Bright Electric'));

        render(<Business />);

        fireEvent.press(screen.getByText('Switch to personal'));

        expect(leave).toHaveBeenCalled();
    });
});
