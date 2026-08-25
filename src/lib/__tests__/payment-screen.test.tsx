import { render, screen, waitFor } from '@testing-library/react-native';
import { View } from 'react-native';

import RecordPayment from '@/app/(app)/job/payment';
import { useSession } from '@/lib/session';
import type { Booking, Destination, Invoice, Staff } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';

jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));
jest.mock('@/lib/workspace', () => ({ useWorkspace: jest.fn() }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-router', () => ({
    Redirect: MockRedirect,
    useLocalSearchParams: () => ({ id: 'j1', name: 'Aircon cleaning' }),
    router: { back: jest.fn(), push: jest.fn() },
}));

function MockRedirect({ href }: { href: string }) {
    return <View accessibilityLabel={`redirect ${href}`} />;
}

const owner: Staff = {
    id: 'st1',
    role: 'owner',
    role_label: 'Owner',
    permissions: ['job:work', 'payment:confirm', 'provider:update'],
    resignation_requested_at: null,
    resignation_lapses_at: null,
    provider: {
        id: 'p1',
        name: 'Zamora Aircon',
        slug: 'zamora-aircon',
        market: { id: 'm1', name: 'Davao City' },
        registration_verified: true,
        suspension: null,
    },
};

const gcash: Destination = {
    method: { value: 'ewallet', label: 'E-wallet' },
    handle: '09171234567',
    name: 'Juan D.',
    institution: 'GCash',
    has_code: false,
};

const maya: Destination = {
    method: { value: 'ewallet', label: 'E-wallet' },
    handle: '09991234567',
    name: 'Juan D.',
    institution: 'Maya',
    has_code: false,
};

const invoice: Invoice = {
    id: 'inv1',
    lines: [],
    total: 200_000,
    paid: 0,
    outstanding: 200_000,
    is_settled: false,
    payments: [],
    created_at: '2026-08-25T10:00:00+08:00',
};

function bookingWith(over: Partial<Booking> = {}, destinations: Destination[] = []): Booking {
    return {
        id: 'b1',
        status: { value: 'accepted', label: 'Accepted', wording: 'accepted', tone: 'success' },
        description: 'Two split types.',
        scheduled_at: '2026-08-26T09:00:00+08:00',
        accepted_at: '2026-08-25T09:00:00+08:00',
        cancelled_at: null,
        refused_at: null,
        agreed_total: 200_000,
        price_min: null,
        price_max: null,
        address: {},
        latitude: null,
        longitude: null,
        pin_radius: null,
        surcharge: null,
        pricing_method: { value: 'per_job', label: 'Per job', is_on_request: false },
        hour_rounding: { value: 'hour', label: 'To the hour' },
        lines: [],
        expected_total: 200_000,
        intake: [],
        service: { id: 's1', name: 'Aircon cleaning' },
        provider: { id: 'p1', name: 'Zamora Aircon', destinations },
        invoice,
        created_at: '2026-08-25T08:00:00+08:00',
        ...over,
    } as Booking;
}

function signedIn(booking: Booking) {
    const request = jest.fn(async () => ({ data: booking }));

    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        token: 'a-token',
        authenticatedRequest: request,
        reload: jest.fn(),
    });

    (useWorkspace as jest.Mock).mockReturnValue({
        staff: owner,
        businesses: [],
        enter: jest.fn(),
        leave: jest.fn(),
    });

    return request;
}

beforeEach(() => jest.clearAllMocks());

it('shows what is owed and offers cash with nowhere published', async () => {
    signedIn(bookingWith());

    render(<RecordPayment />);

    await waitFor(() => expect(screen.getByText('₱2,000')).toBeTruthy());
    expect(screen.getByLabelText('Cash')).toBeTruthy();
});

// Offering GCash with no GCash number is offering a refusal.
it('offers a transfer only where the business published somewhere to send it', async () => {
    signedIn(bookingWith());

    render(<RecordPayment />);

    await waitFor(() => expect(screen.getByLabelText('Cash')).toBeTruthy());
    expect(screen.queryByLabelText('GCash')).toBeNull();
    expect(screen.queryByLabelText('E-wallet')).toBeNull();
});

// Accounts, not rails. "E-wallet" would ask the crew to pick a category and then
// pick again, and the institution is what they recognise anyway.
it('names each published account rather than the rail it sits on', async () => {
    signedIn(bookingWith({}, [gcash, maya]));

    render(<RecordPayment />);

    await waitFor(() => expect(screen.getByLabelText('GCash')).toBeTruthy());
    expect(screen.getByLabelText('Maya')).toBeTruthy();
    expect(screen.getByLabelText('Cash')).toBeTruthy();
    expect(screen.queryByLabelText('E-wallet')).toBeNull();
});

// Cash leaves nothing to photograph, so asking for a receipt would be asking for
// something that does not exist.
it('asks for no receipt on cash, which is what it opens on', async () => {
    signedIn(bookingWith({}, [gcash]));

    render(<RecordPayment />);

    await waitFor(() => expect(screen.getByLabelText('Cash')).toBeTruthy());
    expect(screen.queryByText('Photo of the confirmation')).toBeNull();
});

it('says nothing is owed when somebody already recorded it', async () => {
    signedIn(bookingWith({ invoice: { ...invoice, paid: 200_000, outstanding: 0, is_settled: true } }));

    render(<RecordPayment />);

    await waitFor(() => expect(screen.getByText('This is already paid')).toBeTruthy());
    expect(screen.queryByText('Record payment')).toBeNull();
});

it('sends a crew member with no business back to the start', () => {
    (useSession as jest.Mock).mockReturnValue({ status: 'authenticated', authenticatedRequest: jest.fn() });
    (useWorkspace as jest.Mock).mockReturnValue({ staff: null, businesses: [], enter: jest.fn(), leave: jest.fn() });

    render(<RecordPayment />);

    expect(screen.getByLabelText('redirect /')).toBeTruthy();
});
