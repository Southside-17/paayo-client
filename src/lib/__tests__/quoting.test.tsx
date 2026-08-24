import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';

import ProviderEnquiry from '@/app/(app)/quote/[id]';
import { useSession } from '@/lib/session';
import type { Enquiry, Quotation, Staff } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';

/** Hoisted above jest.mock, which may not reach an imported binding. */
function MockUseFocusEffect(callback: () => void) {
    useEffect(callback, [callback]);
}

jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));
jest.mock('@/lib/workspace', () => ({ useWorkspace: jest.fn() }));
jest.mock('expo-router', () => ({
    Redirect: () => null,
    useFocusEffect: MockUseFocusEffect,
    useLocalSearchParams: () => ({ id: 'e1', name: 'Repair' }),
    router: { back: jest.fn(), push: jest.fn() },
}));

function quotation(over: Partial<Quotation> = {}): Quotation {
    return {
        id: 'q1',
        status: {
            value: 'issued',
            label: 'Waiting on the client',
            wording: 'waiting on the client',
            tone: 'info',
            is_awaiting_answer: true,
            is_agreed: false,
        },
        basis: {
            value: 'on_request',
            label: 'Priced on request',
            reason: 'This work is priced once it has been seen.',
        },
        lines: [
            {
                label: 'The whole job',
                amount: 450_000,
                unit: null,
                estimated_minutes: null,
                maximum_minutes: null,
                is_active: true,
                quantity: null,
            },
        ],
        total: 450_000,
        note: null,
        expires_at: '2026-09-07T15:59:59.000000Z',
        days_left: 6,
        has_lapsed: false,
        is_answerable: true,
        replaces_id: null,
        answered_at: null,
        provider: { id: 'p1', name: 'Tubero Davao Plumbing' },
        created_at: '2026-08-24T00:00:00.000000Z',
        ...over,
    };
}

function enquiry(over: Partial<Enquiry> = {}): Enquiry {
    return {
        id: 'e1',
        status: {
            value: 'open',
            label: 'Waiting on a price',
            wording: 'waiting on a price',
            tone: 'info',
            is_open: true,
            is_awaiting_answer: true,
            needs_another_provider: false,
        },
        description: 'Two aircons, one is not cooling.',
        intake: [{ question: 'Which floor is the unit on?', answer: '12th' }],
        refused_at: null,
        withdrawn_at: null,
        address: { barangay: 'Barangay 5', line: 'Barangay 5, Davao City' },
        latitude: 7.07,
        longitude: 125.61,
        pin_radius: 300,
        pricing_method: { value: 'on_request', label: 'On request', is_on_request: true },
        service: { id: 's1', name: 'Repair' },
        provider: { id: 'p1', name: 'Tubero Davao Plumbing' },
        client: { id: 'u1', nickname: 'Ariel', phone: '0917•••••••' },
        attachments: [],
        created_at: '2026-08-24T00:00:00.000000Z',
        ...over,
    } as Enquiry;
}

function acting(permissions: string[], request: jest.Mock) {
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
                name: 'Tubero Davao Plumbing',
                slug: 'tubero',
                market: { id: 'm1', name: 'Davao City' },
                registration_verified: true,
                suspension: null,
            },
        } as Staff,
        businesses: [],
        enter: jest.fn(),
        leave: jest.fn(),
    });
    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        user: { id: 'u9', nickname: 'Mara', staffs: [] },
        token: 'a-token',
        authenticatedRequest: request,
        reload: jest.fn(),
        logout: jest.fn(),
    });
}

/**
 * The read answers with the enquiry; every write answers with nothing useful,
 * because the screen re-reads after each one.
 */
function answering(subject: Enquiry) {
    return jest.fn(async (path: string, options?: { method?: string }) =>
        options?.method === undefined ? { data: subject } : { data: null },
    );
}

beforeEach(() => jest.clearAllMocks());

it('shows what was asked, and withholds the doorstep', async () => {
    const request = answering(enquiry());
    acting(['booking:view', 'booking:answer'], request);

    render(<ProviderEnquiry />);

    expect(await screen.findByText('Two aircons, one is not cooling.')).toBeOnTheScreen();
    expect(screen.getByText('Barangay 5, Davao City')).toBeOnTheScreen();
    expect(screen.getByText('Send a price')).toBeOnTheScreen();
});

// An enquiry commits nobody to anything, so the client's answers are all the
// business gets to judge the job by.
it('shows the answers the client gave', async () => {
    acting(['booking:view', 'booking:answer'], answering(enquiry()));

    render(<ProviderEnquiry />);

    expect(await screen.findByText('Which floor is the unit on?')).toBeOnTheScreen();
    expect(screen.getByText('12th')).toBeOnTheScreen();
});

it('sends a price as lines rather than one number', async () => {
    const request = answering(enquiry());
    acting(['booking:view', 'booking:answer'], request);

    render(<ProviderEnquiry />);

    fireEvent.press(await screen.findByText('Send a price'));

    fireEvent.changeText(screen.getByLabelText('What line 1 covers'), 'The whole job');
    fireEvent.changeText(screen.getByLabelText('Price of line 1'), '4500');
    fireEvent.press(screen.getByText('Send this price'));

    await waitFor(() =>
        expect(request).toHaveBeenCalledWith(
            '/providers/p1/enquiries/e1/quotation',
            expect.objectContaining({
                method: 'POST',
                body: expect.objectContaining({
                    lines: [
                        expect.objectContaining({ label: 'The whole job', amount: 450_000 }),
                    ],
                }),
            }),
        ),
    );
});

it('asks why before letting a second price go out', async () => {
    const priced = enquiry({
        status: {
            value: 'quoted',
            label: 'Priced',
            wording: 'priced',
            tone: 'success',
            is_open: true,
            is_awaiting_answer: false,
            needs_another_provider: false,
        },
        quotation: quotation(),
    });
    acting(['booking:view', 'booking:answer'], answering(priced));

    render(<ProviderEnquiry />);

    fireEvent.press(await screen.findByText('Send a different price'));

    expect(screen.getByText('Why has the price changed?')).toBeOnTheScreen();
});

it('does not ask why on a first price', async () => {
    acting(['booking:view', 'booking:answer'], answering(enquiry()));

    render(<ProviderEnquiry />);

    fireEvent.press(await screen.findByText('Send a price'));

    expect(screen.queryByText('Why has the price changed?')).not.toBeOnTheScreen();
});

it('pulls a standing price back', async () => {
    const priced = enquiry({
        status: {
            value: 'quoted',
            label: 'Priced',
            wording: 'priced',
            tone: 'success',
            is_open: true,
            is_awaiting_answer: false,
            needs_another_provider: false,
        },
        quotation: quotation(),
    });
    const request = answering(priced);
    acting(['booking:view', 'booking:answer'], request);

    render(<ProviderEnquiry />);

    fireEvent.press(await screen.findByText('Pull this price back'));

    await waitFor(() =>
        expect(request).toHaveBeenCalledWith(
            '/providers/p1/enquiries/e1/quotation',
            expect.objectContaining({ method: 'DELETE' }),
        ),
    );
});

it('records why it was turned down, and warns it cannot be taken back', async () => {
    const request = answering(enquiry());
    acting(['booking:view', 'booking:answer'], request);

    render(<ProviderEnquiry />);

    await screen.findByText('Send a price');

    fireEvent.changeText(screen.getByLabelText('Why you are turning it down'), 'Outside what we do.');
    fireEvent.press(screen.getByText('Turn it down'));

    expect(screen.getByText('Turn this enquiry down?')).toBeOnTheScreen();
    expect(screen.getByText(/cannot be taken back/)).toBeOnTheScreen();

    fireEvent.press(screen.getAllByText('Turn it down')[1]);

    await waitFor(() =>
        expect(request).toHaveBeenCalledWith(
            '/providers/p1/enquiries/e1/refusal',
            expect.objectContaining({
                method: 'POST',
                body: { note: 'Outside what we do.' },
            }),
        ),
    );
});

// Reading is not answering: a technician can be told what was asked without
// being able to commit the business to a figure.
it('gives somebody without the permission nothing to press', async () => {
    acting(['booking:view'], answering(enquiry()));

    render(<ProviderEnquiry />);

    expect(await screen.findByText('Only an owner or manager can answer this')).toBeOnTheScreen();
    expect(screen.queryByText('Send a price')).not.toBeOnTheScreen();
    expect(screen.queryByText('Turn it down')).not.toBeOnTheScreen();
});
