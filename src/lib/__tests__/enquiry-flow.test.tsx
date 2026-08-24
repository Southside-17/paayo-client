import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';

import EnquiryDetail from '@/app/(app)/enquiry/[id]';
import NewEnquiry from '@/app/(app)/enquiry/new';
import { useSession } from '@/lib/session';
import type { Enquiry, Quotation } from '@/lib/types';

/** Hoisted above jest.mock, which may not reach an imported binding. */
function MockUseFocusEffect(callback: () => void) {
    useEffect(callback, [callback]);
}

let mockParams: Record<string, string> = { id: 'e1' };

jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));
jest.mock('@/lib/use-selected-address', () => ({
    useSelectedAddress: () => ({
        address: { id: 'a1', label: 'Home', line: '12 Mabini Street', latitude: 7.07, longitude: 125.61 },
        ready: true,
    }),
}));
jest.mock('expo-router', () => ({
    useFocusEffect: MockUseFocusEffect,
    useLocalSearchParams: () => mockParams,
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canDismiss: () => false, dismissAll: jest.fn() },
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
        intake: [],
        refused_at: null,
        withdrawn_at: null,
        address: { label: 'Home', line: '12 Mabini Street' },
        latitude: 7.07,
        longitude: 125.61,
        pin_radius: null,
        pricing_method: { value: 'on_request', label: 'On request', is_on_request: true },
        service: { id: 's1', name: 'Repair' },
        provider: { id: 'p1', name: 'Tubero Davao Plumbing' },
        attachments: [],
        created_at: '2026-08-24T00:00:00.000000Z',
        ...over,
    } as Enquiry;
}

function signedIn(authenticatedRequest: jest.Mock) {
    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        user: { id: 'u1', nickname: 'Ariel', staffs: [] },
        token: 'a-token',
        authenticatedRequest,
        reload: jest.fn(),
        logout: jest.fn(),
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { id: 'e1' };
});

describe('asking a price', () => {
    beforeEach(() => {
        mockParams = { listing: 'l1', service: 'Repair', provider: 'Tubero Davao Plumbing' };
    });

    // The absence of a date is the whole concept: nothing is being scheduled.
    it('asks for no day and no time', () => {
        signedIn(jest.fn());

        render(<NewEnquiry />);

        expect(screen.getByText('What needs doing?')).toBeOnTheScreen();
        expect(screen.queryByText('When should they arrive?')).not.toBeOnTheScreen();
        expect(screen.getByText(/not booking anything yet/)).toBeOnTheScreen();
    });

    it('refuses to send without the instruction that gets priced', () => {
        const request = jest.fn();
        signedIn(request);

        render(<NewEnquiry />);

        fireEvent.press(screen.getByText('Send enquiry'));

        expect(screen.getByText('Say what you need priced.')).toBeOnTheScreen();
        expect(request).not.toHaveBeenCalled();
    });
});

describe('reading a price', () => {
    it('leads with the figure and words the validity', async () => {
        signedIn(jest.fn().mockResolvedValue({
            data: enquiry({ quotation: quotation(), status: { ...enquiry().status, value: 'quoted', wording: 'priced', is_awaiting_answer: false } }),
        }));

        render(<EnquiryDetail />);

        // Twice: the figure that leads, and the only line making it up.
        expect(await screen.findAllByText('₱4,500')).toHaveLength(2);
        // A raw date makes the reader count days; the count is the decision.
        expect(screen.getByText('Good for 6 more days.')).toBeOnTheScreen();
        expect(screen.getByText('Accept and book')).toBeOnTheScreen();
        expect(screen.getByText('Turn it down')).toBeOnTheScreen();
    });

    it('says a lapsed price has run out and offers no way to take it', async () => {
        signedIn(jest.fn().mockResolvedValue({
            data: enquiry({
                quotation: quotation({ has_lapsed: true, is_answerable: false, days_left: 0 }),
            }),
        }));

        render(<EnquiryDetail />);

        expect(await screen.findByText('This price has run out.')).toBeOnTheScreen();
        expect(screen.queryByText('Accept and book')).not.toBeOnTheScreen();
    });

    // Somebody asked to pay more than they were told is owed the reason first.
    it('shows why a replacement price changed', async () => {
        signedIn(jest.fn().mockResolvedValue({
            data: enquiry({
                quotation: quotation({
                    note: 'The roof needs scaffolding after all.',
                    replaces_id: 'q0',
                    total: 620_000,
                }),
            }),
        }));

        render(<EnquiryDetail />);

        expect(await screen.findByText('The roof needs scaffolding after all.')).toBeOnTheScreen();
        expect(screen.getByText('₱6,200')).toBeOnTheScreen();
        expect(screen.getAllByText('₱4,500')).toHaveLength(1);
    });

    it('agrees a rate rather than a figure when the lines are hourly', async () => {
        signedIn(jest.fn().mockResolvedValue({
            data: enquiry({ quotation: quotation({ total: null }) }),
        }));

        render(<EnquiryDetail />);

        expect(await screen.findByText('By the hour')).toBeOnTheScreen();
    });
});

describe('accepting a price', () => {
    it('books the work at the day and time picked', async () => {
        const request = jest.fn().mockImplementation((path: string, options?: { method?: string }) =>
            options?.method === 'POST'
                ? Promise.resolve({
                      data: { id: 'b1', service: { name: 'Repair' }, provider: { name: 'Tubero Davao Plumbing' } },
                  })
                : Promise.resolve({ data: enquiry({ quotation: quotation() }) }),
        );
        signedIn(request);

        render(<EnquiryDetail />);

        await waitFor(() => expect(screen.getByText('Accept and book')).toBeOnTheScreen());

        fireEvent.press(screen.getByText('Accept and book'));

        // The dialog confirms; the day and hour were chosen on the screen.
        fireEvent.press(screen.getAllByText('Accept and book')[1]);

        await waitFor(() =>
            expect(request).toHaveBeenCalledWith(
                '/enquiries/e1/quotation/acceptance',
                expect.objectContaining({
                    method: 'POST',
                    body: expect.objectContaining({ scheduled_at: expect.any(String) }),
                }),
            ),
        );
    });

    it('offers a day and a time only while a price stands', async () => {
        signedIn(jest.fn().mockResolvedValue({ data: enquiry() }));

        render(<EnquiryDetail />);

        await waitFor(() => expect(screen.getByText('Waiting on their price')).toBeOnTheScreen());

        expect(screen.queryByText('When should they come?')).not.toBeOnTheScreen();
    });
});

describe('being turned down', () => {
    it('says to ask somebody else, and that nothing was lost', async () => {
        signedIn(jest.fn().mockResolvedValue({
            data: enquiry({
                status: {
                    value: 'declined',
                    label: 'Turned down',
                    wording: 'turned down',
                    tone: 'warning',
                    is_open: false,
                    is_awaiting_answer: false,
                    needs_another_provider: true,
                },
            }),
        }));

        render(<EnquiryDetail />);

        expect(
            await screen.findByText('Tubero Davao Plumbing will not be quoting this'),
        ).toBeOnTheScreen();
        expect(screen.getByText(/An enquiry costs nothing/)).toBeOnTheScreen();
        expect(screen.getByText('Ask someone else')).toBeOnTheScreen();
    });
});
