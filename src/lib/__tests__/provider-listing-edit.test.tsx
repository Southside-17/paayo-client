import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';

import ProviderListingEdit from '@/app/(app)/offer/[id]';
import { PesoInput } from '@/components/peso-input';
import { Switch } from '@/components/ui/switch';
import { useSession } from '@/lib/session';
import type { ProviderListing, RateLine, Staff } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';

/** Hoisted above jest.mock, which may not reach an imported binding. */
function MockUseFocusEffect(callback: () => void) {
    useEffect(callback, [callback]);
}

jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));
jest.mock('@/lib/workspace', () => ({ useWorkspace: jest.fn() }));
jest.mock('expo-router', () => ({
    useFocusEffect: MockUseFocusEffect,
    useLocalSearchParams: () => ({ id: 'l1', name: 'Cleaning' }),
    router: { back: jest.fn(), push: jest.fn() },
}));

function line(label: string, amount: number, unit: string | null = 'unit'): RateLine {
    return {
        label,
        amount,
        unit,
        estimated_minutes: null,
        maximum_minutes: null,
        is_active: true,
    };
}

function offer(over: Partial<ProviderListing> = {}): ProviderListing {
    return {
        id: 'l1',
        description: null,
        pricing_method: { value: 'per_unit', label: 'Per unit', is_on_request: false },
        hour_rounding: { value: 'hour' as const, label: 'To the hour' },
        rates: [line('Window type', 80_000), line('Split type', 100_000)],
        allows_many_lines: false,
        intake: ['Which floor is the unit on?'],
        price_min: 80_000,
        price_max: 100_000,
        paused_at: null,
        service: {
            id: 'sv1',
            name: 'Cleaning',
            description: null,
            trade: {
                id: 't1',
                name: 'Aircon',
                slug: 'aircon',
                icon: null,
                units: ['unit', 'metre'],
                services: [],
            },
        },
        standing: { wording: 'live', tone: 'success', reason: 'Taking work.' },
        ...over,
    } as ProviderListing;
}

function draft(over: Partial<ProviderListing> = {}): ProviderListing {
    return offer({
        standing: {
            wording: 'draft',
            tone: 'neutral',
            reason: 'Clients cannot see it until Paayo approves it.',
        },
        ...over,
    });
}

function inReview(over: Partial<ProviderListing> = {}): ProviderListing {
    return offer({
        standing: {
            wording: 'in review',
            tone: 'warning',
            reason: 'Paayo is looking at this offer.',
        },
        review: {
            status: 'pending',
            kind: 'creation',
            rejection_reason: null,
            reviewed_at: null,
            submitted_at: '2026-09-14T00:00:00.000000Z',
        },
        ...over,
    });
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
                name: 'Matina Cooling Works',
                slug: 'matina',
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
        user: { id: 'u1', nickname: 'Mara', staffs: [] },
        token: 'a-token',
        authenticatedRequest: request,
        reload: jest.fn(),
        logout: jest.fn(),
    });
}

/**
 * The index answers with a list and every write answers with one offer, exactly
 * as the API does. A mock that returns the same shape for both leaves the screen
 * holding an array where a listing belongs, and the crash surfaces in whichever
 * test runs next.
 */
function answering(listing: ProviderListing) {
    return jest.fn(async (path: string, options?: { method?: string }) =>
        options?.method === undefined ? { data: [listing] } : { data: listing },
    );
}

const owner = (listing = offer()) => {
    const request = answering(listing);
    acting(['listing:view', 'listing:edit'], request);

    return request;
};

beforeEach(() => jest.clearAllMocks());

it('shows the card a business already has', async () => {
    owner();

    render(<ProviderListingEdit />);

    expect(await screen.findByText('How do you charge for this?')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('Window type')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('Which floor is the unit on?')).toBeOnTheScreen();
});

it('saves a repriced line back to the business', async () => {
    const request = owner();

    render(<ProviderListingEdit />);

    await waitFor(() => expect(screen.getByDisplayValue('Split type')).toBeOnTheScreen());

    fireEvent.changeText(screen.getByLabelText('Price of line 2'), '1150');
    fireEvent.press(screen.getByText('Save'));

    await waitFor(() =>
        expect(request).toHaveBeenCalledWith(
            '/providers/p1/listings/l1',
            expect.objectContaining({
                method: 'PATCH',
                body: expect.objectContaining({
                    rates: expect.arrayContaining([
                        expect.objectContaining({ label: 'Split type', amount: 115_000 }),
                    ]),
                }),
            }),
        ),
    );

    expect(
        screen.getByText(
            'Paayo has the new prices. Clients still see the current card until this is approved.',
        ),
    ).toBeOnTheScreen();
    expect(screen.getByText('How do you charge for this?')).toBeOnTheScreen();
});

// Pricing is the most commercially sensitive thing a business has, so a manager
// reads the card and is given nothing to press -- not a disabled control.
it('gives a manager nothing to change', async () => {
    const request = answering(offer());
    acting(['listing:view'], request);

    render(<ProviderListingEdit />);

    expect(await screen.findByText('Only an owner can change prices')).toBeOnTheScreen();
    expect(screen.queryByText('Save')).not.toBeOnTheScreen();
    expect(screen.queryByText('Add a price')).not.toBeOnTheScreen();
    expect(screen.queryByText('Send for review')).not.toBeOnTheScreen();
    expect(screen.queryByText('Ask to take this down')).not.toBeOnTheScreen();
});

it('drops the card when the work becomes quoted on request', async () => {
    owner();

    render(<ProviderListingEdit />);

    await waitFor(() => expect(screen.getByDisplayValue('Window type')).toBeOnTheScreen());

    fireEvent.press(screen.getByText('On request'));

    expect(screen.queryByDisplayValue('Window type')).not.toBeOnTheScreen();
    expect(screen.queryByText('Can a client pick more than one?')).not.toBeOnTheScreen();
});

// The suggestions are the trade's vocabulary, not one list for every trade: a
// plumber counts fixtures and a painter counts square metres.
it('suggests what the trade counts in', async () => {
    owner();

    render(<ProviderListingEdit />);

    await waitFor(() => expect(screen.getByDisplayValue('Window type')).toBeOnTheScreen());

    // One chip set per rate line, and this card has two.
    expect(screen.getAllByText('metre')).toHaveLength(2);
    expect(screen.queryByText('sqm')).not.toBeOnTheScreen();
});

it('offers a unit when the trade names none', async () => {
    const listing = offer();
    owner({ ...listing, service: { ...listing.service, trade: { ...listing.service.trade!, units: [] } } });

    render(<ProviderListingEdit />);

    await waitFor(() => expect(screen.getByDisplayValue('Window type')).toBeOnTheScreen());

    expect(screen.getAllByText('unit')).toHaveLength(2);
    expect(screen.queryByText('metre')).not.toBeOnTheScreen();
});

it('asks for hours once the work is charged by the hour', async () => {
    owner();

    render(<ProviderListingEdit />);

    await waitFor(() => expect(screen.getByText('Per hour')).toBeOnTheScreen());

    fireEvent.press(screen.getByText('Per hour'));

    expect(screen.getByLabelText('Usual minutes for line 1')).toBeOnTheScreen();
    expect(screen.getByLabelText('Longest minutes for line 1')).toBeOnTheScreen();
});

it('confirms before it stops taking work', async () => {
    const request = owner();

    render(<ProviderListingEdit />);

    await waitFor(() => expect(screen.getByText('Stop taking work')).toBeOnTheScreen());

    fireEvent.press(screen.getByText('Stop taking work'));

    expect(screen.getByText('Stop taking work on this?')).toBeOnTheScreen();
    expect(request).toHaveBeenCalledTimes(1); // the load, and nothing else yet
});

it('starts taking work again without confirming', async () => {
    const request = owner(offer({ paused_at: '2026-08-01T00:00:00.000000Z' }));

    render(<ProviderListingEdit />);

    await waitFor(() =>
        expect(screen.getByText('Start taking work again')).toBeOnTheScreen(),
    );

    fireEvent.press(screen.getByText('Start taking work again'));

    await waitFor(() =>
        expect(request).toHaveBeenCalledWith(
            '/providers/p1/listings/l1/pause',
            expect.objectContaining({ method: 'DELETE' }),
        ),
    );
});

it('sends a draft after writing the card', async () => {
    const request = owner(draft());

    render(<ProviderListingEdit />);

    fireEvent.press(await screen.findByText('Send for review'));

    await waitFor(() =>
        expect(request).toHaveBeenCalledWith(
            '/providers/p1/listings/l1/submission',
            expect.objectContaining({ method: 'POST' }),
        ),
    );

    expect(request).toHaveBeenCalledWith(
        '/providers/p1/listings/l1',
        expect.objectContaining({ method: 'PATCH' }),
    );
    expect(screen.queryByText('Ask to take this down')).not.toBeOnTheScreen();
    expect(screen.queryByText('Stop taking work')).not.toBeOnTheScreen();
});

it('lets a draft be saved without sending it', async () => {
    const request = owner(draft());

    render(<ProviderListingEdit />);

    fireEvent.press(await screen.findByText('Save'));

    await waitFor(() =>
        expect(request).toHaveBeenCalledWith(
            '/providers/p1/listings/l1',
            expect.objectContaining({ method: 'PATCH' }),
        ),
    );

    expect(request).not.toHaveBeenCalledWith(
        '/providers/p1/listings/l1/submission',
        expect.anything(),
    );
    expect(
        screen.getByText('Saved. Send it for review when you are ready.'),
    ).toBeOnTheScreen();
});

it('locks a submission that is waiting and lets it be taken back', async () => {
    const request = owner(inReview());

    render(<ProviderListingEdit />);

    expect(await screen.findByText('Take back your submission')).toBeOnTheScreen();
    expect(screen.queryByText('Save')).not.toBeOnTheScreen();
    expect(screen.queryByText('Send for review')).not.toBeOnTheScreen();
    expect(screen.queryByText('Add a price')).not.toBeOnTheScreen();

    fireEvent.press(screen.getByText('Take back your submission'));

    await waitFor(() =>
        expect(request).toHaveBeenCalledWith(
            '/providers/p1/listings/l1/submission',
            expect.objectContaining({ method: 'DELETE' }),
        ),
    );
});

it('asks Paayo before taking a live offer down', async () => {
    const request = owner();

    render(<ProviderListingEdit />);

    fireEvent.press(await screen.findByText('Ask to take this down'));

    expect(screen.getByText('Ask Paayo to take this down?')).toBeOnTheScreen();
    expect(request).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getAllByText('Ask to take this down')[1]);

    await waitFor(() =>
        expect(request).toHaveBeenCalledWith(
            '/providers/p1/listings/l1/withdrawal',
            expect.objectContaining({ method: 'POST' }),
        ),
    );
});

describe('the primitives it needed', () => {
    it('reads money as pesos and reports it as centavos', () => {
        const onChange = jest.fn();

        render(<PesoInput value={115_000} onChange={onChange} accessibilityLabel="Price" />);

        expect(screen.getByDisplayValue('1150')).toBeOnTheScreen();

        fireEvent.changeText(screen.getByLabelText('Price'), '900');

        expect(onChange).toHaveBeenCalledWith(90_000);
    });

    it('reports an emptied money field as nothing, not as zero', () => {
        const onChange = jest.fn();

        render(<PesoInput value={5_000} onChange={onChange} accessibilityLabel="Price" />);
        fireEvent.changeText(screen.getByLabelText('Price'), '');

        expect(onChange).toHaveBeenCalledWith(null);
    });

    it('turns a switch on and off', () => {
        const onValueChange = jest.fn();

        render(
            <Switch value={false} onValueChange={onValueChange} accessibilityLabel="Menu" />,
        );

        fireEvent.press(screen.getByLabelText('Menu'));

        expect(onValueChange).toHaveBeenCalledWith(true);
    });
});
