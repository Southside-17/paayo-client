import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';

import Business from '@/app/(app)/(provider)/business';
import ProviderLayout from '@/app/(app)/(provider)/_layout';
import Job from '@/app/(app)/job/[id]';
import Jobs from '@/app/(app)/(provider)/jobs';
import { BusinessChip } from '@/components/business-chip';
import { useSession } from '@/lib/session';
import type { Booking, ProviderStaff, Staff, SuspensionNotice } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';

jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));
jest.mock('@/lib/workspace', () => ({ useWorkspace: jest.fn() }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-router', () => ({
    Link: MockLink,
    Redirect: MockRedirect,
    Stack: MockStack,
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

function MockStack() {
    return <View accessibilityLabel="stack" />;
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

function staffAt(
    id: string,
    name: string,
    over: Partial<Staff['provider']> = {},
    permissions: string[] = ['booking:view', 'staff:view', 'invitation:view', 'listing:view'],
): Staff {
    return {
        id,
        role: permissions.length === 0 ? 'technician' : 'owner',
        role_label: permissions.length === 0 ? 'Technician' : 'Owner',
        permissions,
        resignation_requested_at: null,
        resignation_lapses_at: null,
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

/**
 * Somebody on a staff, as the roster sends them.
 */
function person(over: Partial<ProviderStaff> = {}): ProviderStaff {
    return {
        id: 'st1',
        role: 'owner',
        role_label: 'Owner',
        joined_at: '2026-02-03T00:00:00.000000Z',
        resignation_requested_at: null,
        resignation_lapses_at: null,
        is_you: true,
        user: { id: 'u1', nickname: 'Mara', email: 'mara@example.com' },
        ...over,
    };
}

/**
 * Somebody who has asked to leave and is waiting on an answer.
 */
function leaver(): ProviderStaff {
    return person({
        id: 'st2',
        role: 'technician',
        role_label: 'Technician',
        is_you: false,
        resignation_requested_at: '2026-09-03T00:00:00.000000Z',
        resignation_lapses_at: '2026-09-10T00:00:00.000000Z',
        user: { id: 'u2', nickname: 'Jun', email: 'jun@example.com' },
    });
}

const job: Booking = {
    id: 'b1',
    status: {
        value: 'pending',
        label: 'Pending',
        wording: 'pending',
        tone: 'info',
        is_open: true,
        is_awaiting_client: false,
        needs_another_provider: false,
    },
    description: 'The unit drips.',
    scheduled_at: '2026-09-01T02:00:00.000000Z',
    accepted_at: null,
    cancelled_at: null,
    refused_at: null,
    agreed_total: null,
    price_min: 150_000,
    price_max: null,
    address: { line: 'Barangay 5, Davao City, Davao del Sur, 8000' },
    latitude: 7.07,
    longitude: 125.61,
    pin_radius: 300,
    surcharge: null,
    pricing_method: { value: 'per_job', label: 'Per job', is_on_request: false },
    hour_rounding: { value: 'hour' as const, label: 'To the hour' },
    // A line, because a booking with none cannot be taken at all -- it is a
    // request to be quoted, and the screen offers a price instead.
    lines: [
        {
            label: 'Call out',
            amount: 150_000,
            unit: null,
            estimated_minutes: null,
            maximum_minutes: null,
            is_active: true,
            quantity: null,
        },
    ],
    expected_total: null,
    intake: [],
    service: { id: 's1', name: 'Aircon cleaning' },
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

/**
 * One request mock that answers by path, because the business screen reads its
 * staff, its invitations and its offers in the same breath.
 */
function answering(byPath: Record<string, unknown>) {
    return jest.fn(async (path: string) => {
        const match = Object.keys(byPath).find((key) => path.includes(key));

        return match ? byPath[match] : { data: [] };
    });
}

beforeEach(() => jest.clearAllMocks());

describe('the way in', () => {
    it('draws no chip for an account that is on no staff', () => {
        signedIn();
        acting(null, []);

        render(<BusinessChip />);

        expect(screen.queryByLabelText(/Acting as/)).not.toBeOnTheScreen();
    });

    it('names the side being acted on', () => {
        signedIn(jest.fn(), [staffAt('s1', 'Bright Electric')]);
        acting(null, [staffAt('s1', 'Bright Electric')]);

        render(<BusinessChip />);

        expect(screen.getByText('Mara')).toBeOnTheScreen();
    });

    // One business is the common case, so the chip switches straight across.
    // A sheet listing two rows to make a foregone choice is a wasted tap.
    it('switches straight across when there is only one business', () => {
        const business = staffAt('s1', 'Bright Electric');
        signedIn(jest.fn(), [business]);
        acting(null, [business]);

        render(<BusinessChip />);

        fireEvent.press(screen.getByLabelText(/Acting as/));

        expect(enter).toHaveBeenCalledWith(business);
        expect(screen.queryByText('Act as')).not.toBeOnTheScreen();
    });

    it('switches straight back out again', () => {
        const business = staffAt('s1', 'Bright Electric');
        signedIn(jest.fn(), [business]);
        acting(business, [business]);

        render(<BusinessChip />);

        fireEvent.press(screen.getByLabelText(/Acting as/));

        expect(leave).toHaveBeenCalled();
    });
});

describe('the switcher', () => {
    const two = () => [staffAt('s1', 'Bright Electric'), staffAt('s2', 'Zamora Aircon')];

    it('opens a sheet once there is a choice to make', () => {
        signedIn(jest.fn(), two());
        acting(null, two());

        render(<BusinessChip />);

        fireEvent.press(screen.getByLabelText(/Acting as/));

        expect(screen.getByText('Act as')).toBeOnTheScreen();
        expect(screen.getByText('Bright Electric')).toBeOnTheScreen();
        expect(screen.getByText('Zamora Aircon')).toBeOnTheScreen();
    });

    // Name over role, so the personal row parses the same way a business row
    // does: who, then what you are there.
    it('leads the personal row with the name and puts Personal under it', () => {
        signedIn(jest.fn(), two());
        acting(null, two());

        render(<BusinessChip />);

        fireEvent.press(screen.getByLabelText(/Acting as/));

        // Twice: once on the chip, once as the row it opens.
        expect(screen.getAllByText('Mara')).toHaveLength(2);
        expect(screen.getByText('Personal')).toBeOnTheScreen();
    });

    it('switches into the business that was tapped', () => {
        const businesses = two();
        signedIn(jest.fn(), businesses);
        acting(null, businesses);

        render(<BusinessChip />);

        fireEvent.press(screen.getByLabelText(/Acting as/));
        fireEvent.press(screen.getByText('Zamora Aircon'));

        expect(enter).toHaveBeenCalledWith(businesses[1]);
    });

    it('switches back out to personal', () => {
        const businesses = two();
        signedIn(jest.fn(), businesses);
        acting(businesses[0], businesses);

        render(<BusinessChip />);

        fireEvent.press(screen.getByLabelText(/Acting as/));
        fireEvent.press(screen.getByText('Personal'));

        expect(leave).toHaveBeenCalled();
    });

    // Held businesses stay on the list and stay tappable. Hiding one would be
    // the single way of never being told about it.
    it('keeps a suspended business listed, and says so on the row', () => {
        const businesses = [staffAt('s1', 'Held Cooling', { suspension: held }), staffAt('s2', 'Zamora Aircon')];
        signedIn(jest.fn(), businesses);
        acting(null, businesses);

        render(<BusinessChip />);

        fireEvent.press(screen.getByLabelText(/Acting as/));

        expect(screen.getByText('on hold')).toBeOnTheScreen();

        fireEvent.press(screen.getByText('Held Cooling'));

        expect(enter).toHaveBeenCalledWith(businesses[0]);
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
        expect(screen.getByText('Barangay 5, Davao City, Davao del Sur, 8000')).toBeOnTheScreen();
    });

    // The same vocabulary the client's own list narrows by, off the same enum.
    it('narrows the queue to one status, and counts what is in each', async () => {
        const taken = {
            ...job,
            id: 'j2',
            status: { ...job.status, value: 'accepted', label: 'Accepted', wording: 'accepted' },
            service: { ...job.service, name: 'Freon recharge' },
        };

        acting(staffAt('s1', 'Bright Electric'));
        signedIn(
            jest.fn().mockResolvedValue({
                data: [job, taken],
                meta: {
                    filters: [
                        { value: 'pending', label: 'Pending' },
                        { value: 'accepted', label: 'Accepted' },
                    ],
                },
            }),
        );

        render(<Jobs />);

        fireEvent.press(await screen.findByLabelText('Accepted, 1'));

        expect(screen.getByText('Freon recharge')).toBeOnTheScreen();
        expect(screen.queryByText('Aircon cleaning')).toBeNull();
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

    it('names the market the business is locked to', async () => {
        acting(staffAt('s1', 'Bright Electric'));
        signedIn(answering({}));

        render(<Business />);

        expect(await screen.findByText('Davao City')).toBeOnTheScreen();
        expect(screen.getByText('registered')).toBeOnTheScreen();
    });

    // Services is a tab of its own, so a card here would be a second door to one
    // room. The role stands alone under the name -- "you are the Owner" says
    // nothing the word Owner does not.
    it('leaves Services to its tab, and names the role plainly', async () => {
        acting(staffAt('s1', 'Bright Electric'));
        signedIn(answering({}));

        render(<Business />);

        expect(await screen.findByText('Davao City · Owner')).toBeOnTheScreen();
        expect(screen.queryByText(/What you sell/)).not.toBeOnTheScreen();
    });

    it('warns when no market has been set, since nothing can be booked', async () => {
        acting(staffAt('s1', 'Bright Electric', { market: null, registration_verified: false }));
        signedIn(answering({}));

        render(<Business />);

        expect(
            await screen.findByText(/No market yet, so nothing can be booked/),
        ).toBeOnTheScreen();
        expect(screen.getByText('no papers')).toBeOnTheScreen();
    });

    // Staff leads because it is the only thing on the screen anybody can change.
    it('leads with the people, and names the ones who want out', async () => {
        acting(staffAt('s1', 'Bright Electric'));
        signedIn(answering({ '/staffs': { data: [person(), leaver()] } }));

        render(<Business />);

        expect(await screen.findByText('Jun')).toBeOnTheScreen();
        expect(screen.getByText(/Mara/)).toBeOnTheScreen();
        expect(screen.getByText('Wants to leave')).toBeOnTheScreen();
    });

    it('says who owns the market and the papers, since the business cannot change either', async () => {
        acting(staffAt('s1', 'Bright Electric'));
        signedIn(answering({}));

        render(<Business />);

        expect(await screen.findByText('Set by Paayo')).toBeOnTheScreen();
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

    // One banner at the top rather than a disclaimer beside every field it
    // applies to, which is how the same sentence ended up under the phone and
    // under the map.
    it('says once, at the top, what taking the job would tell them', async () => {
        acting(staffAt('s1', 'Bright Electric'));
        signedIn(jest.fn().mockResolvedValue({ data: job }));

        render(<Job />);

        expect(
            await screen.findByText(
                'Exact address and phone number are hidden until you take this job.',
            ),
        ).toBeOnTheScreen();
    });

    // A masked number and an empty field are different answers: one says the
    // client is reachable and the other says they never filled it in.
    it('shows the number masked back to its network prefix', async () => {
        acting(staffAt('s1', 'Bright Electric'));
        signedIn(
            jest.fn().mockResolvedValue({
                data: { ...job, client: { id: 'u9', nickname: 'Mara', phone: '0917•••••••' } },
            }),
        );

        render(<Job />);

        expect(await screen.findByText('0917•••••••')).toBeOnTheScreen();
        expect(screen.queryByText('No phone number on this account.')).not.toBeOnTheScreen();
    });

    it('drops the banner once the job has been taken', async () => {
        acting(staffAt('s1', 'Bright Electric'));
        signedIn(
            jest.fn().mockResolvedValue({
                data: {
                    ...job,
                    accepted_at: '2026-08-02T00:00:00.000000Z',
                    address: { label: 'Home', line: '12 Mabini Street, Barangay 5, Davao City' },
                    pin_radius: null,
                    status: { ...job.status, value: 'accepted' },
                },
            }),
        );

        render(<Job />);

        expect(await screen.findByText('09171234567')).toBeOnTheScreen();
        expect(
            screen.queryByText(
                'Exact address and phone number are hidden until you take this job.',
            ),
        ).not.toBeOnTheScreen();
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

    // Not two equal buttons: taking work is the ordinary answer and turning it
    // down is the exception, so they do not get the same weight.
    it('leads with taking the job and keeps turning it down quieter', async () => {
        acting(staffAt('s1', 'Bright Electric'));
        signedIn(jest.fn().mockResolvedValue({ data: job }));

        render(<Job />);

        expect(await screen.findByText('Take this job')).toBeOnTheScreen();
        expect(screen.getByText("Can't take it")).toBeOnTheScreen();
    });

    it('names the promise before it is made, rather than asking if you are sure', async () => {
        acting(staffAt('s1', 'Bright Electric'));
        signedIn(jest.fn().mockResolvedValue({ data: job }));

        render(<Job />);

        fireEvent.press(await screen.findByText('Take this job'));

        // The area is on the screen twice by then -- the Where card and the
        // dialog -- so the sentence is matched whole rather than by its parts.
        expect(
            screen.getByText(/You are saying you will be in Barangay 5, Davao City/),
        ).toBeOnTheScreen();
        expect(
            screen.getByText(/The street and Mara's number arrive once you accept/),
        ).toBeOnTheScreen();
        expect(screen.getByText('Take the job')).toBeOnTheScreen();
    });

    it('sends the acceptance to the business being acted as', async () => {
        acting(staffAt('s1', 'Bright Electric'));
        const authenticatedRequest = jest.fn().mockResolvedValue({ data: job });
        signedIn(authenticatedRequest);

        render(<Job />);

        fireEvent.press(await screen.findByText('Take this job'));
        fireEvent.press(within(screen.getByTestId('confirm-dialog')).getByText('Take the job'));

        await waitFor(() =>
            expect(authenticatedRequest).toHaveBeenCalledWith(
                '/providers/p-s1/bookings/b1/acceptance',
                { method: 'POST', body: {} },
            ),
        );
    });

    it('asks why before turning work down, and keeps that note between us', async () => {
        acting(staffAt('s1', 'Bright Electric'));
        const authenticatedRequest = jest.fn().mockResolvedValue({ data: job });
        signedIn(authenticatedRequest);

        render(<Job />);

        fireEvent.press(await screen.findByText("Can't take it"));
        fireEvent.changeText(
            screen.getByPlaceholderText('Fully booked, too far, wrong job.'),
            '  Fully booked.  ',
        );
        fireEvent.press(screen.getByText('Turn it down'));
        fireEvent.press(within(screen.getByTestId('confirm-dialog')).getByText('Turn it down'));

        await waitFor(() =>
            expect(authenticatedRequest).toHaveBeenCalledWith(
                '/providers/p-s1/bookings/b1/refusal',
                { method: 'POST', body: { note: 'Fully booked.' } },
            ),
        );
    });

    // Both answers commit the business, so neither goes through on one tap.
    it('names what the client is left with before the job is turned down', async () => {
        acting(staffAt('s1', 'Bright Electric'));
        const authenticatedRequest = jest.fn().mockResolvedValue({ data: job });
        signedIn(authenticatedRequest);

        render(<Job />);

        fireEvent.press(await screen.findByText("Can't take it"));
        fireEvent.press(screen.getByText('Turn it down'));

        const dialog = within(screen.getByTestId('confirm-dialog'));

        expect(dialog.getByText('Turn down this job?')).toBeOnTheScreen();
        expect(
            dialog.getByText(/Mara will be asked to choose another business/),
        ).toBeOnTheScreen();
        expect(authenticatedRequest).not.toHaveBeenCalledWith(
            '/providers/p-s1/bookings/b1/refusal',
            expect.anything(),
        );
    });

    it('leaves the job alone when the refusal is backed out of', async () => {
        acting(staffAt('s1', 'Bright Electric'));
        const authenticatedRequest = jest.fn().mockResolvedValue({ data: job });
        signedIn(authenticatedRequest);

        render(<Job />);

        fireEvent.press(await screen.findByText("Can't take it"));
        fireEvent.press(screen.getByText('Turn it down'));
        fireEvent.press(within(screen.getByTestId('confirm-dialog')).getByText('Keep it'));

        expect(screen.queryByTestId('confirm-dialog')).not.toBeOnTheScreen();
        expect(authenticatedRequest).not.toHaveBeenCalledWith(
            '/providers/p-s1/bookings/b1/refusal',
            expect.anything(),
        );
    });

    // The notice says what is true; a disabled button reads as temporary.
    it('replaces both controls with the notice under a hold', async () => {
        acting(staffAt('s1', 'Held Cooling', { suspension: held }));
        signedIn(jest.fn().mockResolvedValue({ data: job }));

        render(<Job />);

        expect(await screen.findByText('This business is suspended')).toBeOnTheScreen();
        expect(screen.queryByText('Take this job')).not.toBeOnTheScreen();
        expect(screen.queryByText("Can't take it")).not.toBeOnTheScreen();
    });

    it('keeps the staff away from a technician, who may not read it', async () => {
        acting(staffAt('s1', 'Bright Electric', {}, []));
        signedIn(answering({ '/staffs': { data: [person()] } }));

        render(<Business />);

        expect(await screen.findByText('Set by Paayo')).toBeOnTheScreen();
        expect(screen.queryByText('Who works here')).not.toBeOnTheScreen();
    });
});

// The server refuses to accept work with nothing agreed on it, so offering the
// button would be offering a refusal. A client who picked no lines is asking to
// be quoted, and the price is the way through.
it('offers a price rather than a take when nothing was picked', async () => {
    acting(staffAt('s1', 'Bright Electric'));
    signedIn(jest.fn().mockResolvedValue({ data: { ...job, lines: [] } }));

    render(<Job />);

    expect(await screen.findByText('Send them a price')).toBeOnTheScreen();
    expect(screen.queryByText('Take this job')).toBeNull();
    expect(screen.getByText(/not picked anything to price/i)).toBeOnTheScreen();
});

// Money owed outranks the work's own state on the list. A finished job nobody has
// been paid for still needs something doing, and "completed" reads as though it
// does not -- which is how it shipped, alongside a card the crew could not reach.
it('flags a finished job nobody has been paid for', async () => {
    acting(staffAt('s1', 'Bright Electric'));
    signedIn(
        jest.fn().mockResolvedValue({
            data: [
                {
                    ...job,
                    status: { value: 'accepted', label: 'Accepted', wording: 'accepted', tone: 'success' },
                    invoice: {
                        id: 'inv1',
                        lines: [],
                        total: 200_000,
                        paid: 0,
                        outstanding: 200_000,
                        is_settled: false,
                        created_at: '2026-08-25T10:00:00+08:00',
                    },
                },
            ],
        }),
    );

    render(<Jobs />);

    expect(await screen.findByText('unpaid')).toBeOnTheScreen();
    expect(screen.queryByText('accepted')).toBeNull();
});
