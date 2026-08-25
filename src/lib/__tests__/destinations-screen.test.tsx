import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';

import Destinations from '@/app/(app)/destinations';
import { useSession } from '@/lib/session';
import type { Destination, Staff } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';

jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));
jest.mock('@/lib/workspace', () => ({ useWorkspace: jest.fn() }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-router', () => ({
    useFocusEffect: MockUseFocusEffect,
    router: { back: jest.fn() },
}));

// A real effect rather than a call during render, so the fetch it starts settles
// inside act() the way it does on a device.
function MockUseFocusEffect(callback: () => void) {
    useEffect(callback, [callback]);
}

const owner = (permissions: string[] = ['provider:update']): Staff =>
    ({
        id: 'st1',
        role: 'owner',
        role_label: 'Owner',
        permissions,
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
    }) as Staff;

const gcash: Destination = {
    method: { value: 'ewallet', label: 'E-wallet' },
    handle: '09171234567',
    name: 'Juan D.',
    institution: 'GCash',
    has_code: true,
    code_url: 'https://store.example/qr.png?sig=abc',
};

function signedIn(published: Destination[], staff: Staff = owner()) {
    const request = jest.fn(async (path: string, options?: { method?: string; body?: unknown }) => {
        if (options?.method === 'POST') {
            return { data: published };
        }

        return {
            data: published,
            meta: { institutions: { ewallet: ['GCash', 'Maya'], bank: ['BPI', 'Landbank'] } },
        };
    });

    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        token: 'a-token',
        authenticatedRequest: request,
        reload: jest.fn(),
    });

    (useWorkspace as jest.Mock).mockReturnValue({
        staff,
        businesses: [],
        enter: jest.fn(),
        leave: jest.fn(),
    });

    return request;
}

/** The FormData the screen sent, as plain pairs. */
function sent(request: jest.Mock): Record<string, string> {
    const posted = request.mock.calls.find(([, options]) => options?.method === 'POST');
    const body = posted?.[1]?.body as FormData;
    const pairs: Record<string, string> = {};

    for (const [key, value] of (body as unknown as { entries(): Iterable<[string, string]> }).entries()) {
        pairs[key] = String(value);
    }

    return pairs;
}

beforeEach(() => jest.clearAllMocks());

it('shows a published account with the QR against it', async () => {
    signedIn([gcash]);

    render(<Destinations />);

    await waitFor(() => expect(screen.getByLabelText('GCash QR')).toBeTruthy());
    expect(screen.getByDisplayValue('09171234567')).toBeTruthy();
    expect(screen.getByDisplayValue('Juan D.')).toBeTruthy();
});

// Suggestions, not a whitelist: tapping one fills the field, and the screen says
// so out loud for the business banking somewhere nobody listed.
it('offers the suggested institutions and says they are only suggestions', async () => {
    signedIn([gcash]);

    render(<Destinations />);

    await waitFor(() => expect(screen.getByLabelText('Maya')).toBeTruthy());
    expect(screen.getByText(/not suggested, type it/i)).toBeTruthy();
});

// Editing a number must not silently drop the QR, so an untouched account sends
// no file and no removal -- which is what tells the server to keep what it has.
it('says nothing about the QR when it was left alone', async () => {
    const request = signedIn([gcash]);

    render(<Destinations />);
    await waitFor(() => expect(screen.getByLabelText('GCash QR')).toBeTruthy());

    await act(async () => void fireEvent.press(screen.getByText('Save')));

    await waitFor(() => expect(sent(request)['destinations[0][method]']).toBe('ewallet'));

    const body = sent(request);

    expect(body['destinations[0][institution]']).toBe('GCash');
    expect(body['destinations[0][remove_code]']).toBeUndefined();
    expect(body['destinations[0][code]']).toBeUndefined();
});

it('asks for the QR to go once it is taken down', async () => {
    const request = signedIn([gcash]);

    render(<Destinations />);
    await waitFor(() => expect(screen.getByLabelText('Take the QR down')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Take the QR down'));

    expect(screen.queryByLabelText('GCash QR')).toBeNull();

    await act(async () => void fireEvent.press(screen.getByText('Save')));

    await waitFor(() => expect(sent(request)['destinations[0][remove_code]']).toBe('1'));
});

// The point of collapsing the wallets: two of one rail is ordinary.
it('takes a second account on the same rail', async () => {
    signedIn([gcash]);

    render(<Destinations />);
    await waitFor(() => expect(screen.getByLabelText('Add E-wallet')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Add E-wallet'));

    expect(screen.getAllByLabelText('Which wallet')).toHaveLength(2);
});

it('shows nothing to somebody who cannot change where money goes', async () => {
    const request = signedIn([gcash], owner([]));

    render(<Destinations />);

    // Awaited rather than asserted on the spot: the screen still starts its read
    // before it decides it has nothing to show, and letting that settle inside
    // the test is what keeps the update inside act().
    await waitFor(() => expect(request).toHaveBeenCalled());

    expect(screen.queryByText('Save')).toBeNull();
});
