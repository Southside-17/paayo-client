import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import Book from '@/app/(app)/book';
import BookingDetail from '@/app/(app)/booking/[id]';
import Bookings from '@/app/(app)/(tabs)/bookings';
import * as ImagePicker from 'expo-image-picker';

import { ApiError } from '@/lib/api';
import { router } from 'expo-router';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useSession } from '@/lib/session';

jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('@/lib/picture', () => ({
    preparePicture: jest.fn(async (asset: { uri: string }) => ({
        uri: asset.uri,
        name: 'photo.jpg',
        type: 'image/jpeg',
    })),
}));
jest.mock('@/lib/upload', () => ({
    uploadAttachment: jest.fn(async () => ({ id: 'att-1' })),
    discardAttachment: jest.fn(async () => undefined),
}));
jest.mock('expo-router', () => ({
    Link: MockLink,
    useFocusEffect: MockUseFocusEffect,
    useLocalSearchParams: () => ({
        listing: 'l1',
        id: 'b1',
        name: 'Cleaning',
        service: 'Cleaning',
        provider: 'FixRight Manila',
    }),
    router: {
        back: jest.fn(),
        push: jest.fn(),
        replace: jest.fn(),
        dismissAll: jest.fn(),
        canDismiss: () => true,
    },
}));

/**
 * Attach a photo, which every booking needs before it can be placed.
 */
async function attachPhoto() {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///aircon.jpg', mimeType: 'image/jpeg', fileName: 'aircon.jpg' }],
    });

    fireEvent.press(screen.getByLabelText('Add a photo or video'));

    // The thumbnail appears as soon as the file is chosen; the button stops
    // saying "Sending" once the bytes have landed and the id is known.
    await waitFor(() => expect(screen.getByLabelText('Remove')).toBeOnTheScreen());
    await waitFor(() => expect(screen.queryByText('Sending photos…')).toBeNull());
}

/** Press the confirming button inside the dialog. */
function confirmThrough(label: string) {
    fireEvent.press(screen.getAllByText(label).at(-1)!);
}

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

const address = { id: 'a1', label: 'Home', is_default: true, latitude: 14.55, longitude: 121.02 };

const booking = {
    id: 'b1',
    status: { value: 'pending', label: 'Awaiting a provider', wording: 'awaiting a provider', tone: 'info', is_open: true },
    description: 'The unit drips.',
    scheduled_at: '2026-09-01T02:00:00.000000Z',
    cancelled_at: null,
    price_min: 150_000,
    price_max: null,
    address: { label: 'Home', line: '12 Kalayaan, Makati' },
    latitude: 14.55,
    longitude: 121.02,
    service: { id: 's1', name: 'Cleaning', pricing_unit: { value: 'fixed', label: 'Fixed price', suffix: '', is_quoted: false } },
    provider: { id: 'p1', name: 'FixRight Manila' },
    created_at: '2026-08-01T00:00:00.000000Z',
};

function signedIn(authenticatedRequest: jest.Mock) {
    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        user,
        token: 'a-token',
        authenticatedRequest,
        reload: jest.fn(),
    });
}

it('posts the listing, the address and a chosen time', async () => {
    const request = jest.fn((path: string, options?: { body: Record<string, string> }) => {
        void options;

        return path === '/addresses'
            ? Promise.resolve({ data: [address] })
            : Promise.resolve({ data: booking });
    });

    signedIn(request);

    render(<Book />);

    await waitFor(() => expect(screen.getByText('Home')).toBeOnTheScreen());
    await attachPhoto();

    fireEvent.changeText(screen.getByPlaceholderText(/drips/), 'The unit drips.');
    fireEvent.press(screen.getByText('Place booking'));
    confirmThrough('Place booking');

    await waitFor(() => expect(request).toHaveBeenCalledWith('/bookings', expect.anything()));

    const call = request.mock.calls.find(([path]) => path === '/bookings');
    const body = call?.[1]?.body ?? {};

    expect(body.listing_id).toBe('l1');
    expect(body.address_id).toBe('a1');
    expect(body.description).toBe('The unit drips.');
    expect(body.attachments).toEqual(['att-1']);
    expect(new Date(body.scheduled_at).getTime()).toBeGreaterThan(Date.now());
});

// Coverage is the refusal the whole zone machinery exists to produce, and the
// server keys it to listing_id, which owns no input on this form.
it('shows a provider who does not work there, rather than going quiet', async () => {
    const request = jest.fn((path: string) => {
        if (path === '/addresses') {
            return Promise.resolve({ data: [address] });
        }

        return Promise.reject(
            new ApiError(422, 'This provider does not work at that address.', {
                listing_id: ['This provider does not work at that address.'],
            }),
        );
    });

    signedIn(request);

    render(<Book />);

    await waitFor(() => expect(screen.getByText('Home')).toBeOnTheScreen());
    await attachPhoto();

    fireEvent.press(screen.getByText('Place booking'));
    confirmThrough('Place booking');

    await waitFor(() =>
        expect(screen.getByText('This provider does not work at that address.')).toBeOnTheScreen(),
    );
});

// The button used to sit disabled with nothing saying why, and the only visible
// hint was on a field that was already filled in.
it('says a photo is missing rather than refusing quietly', async () => {
    const request = jest.fn((path: string) =>
        path === '/addresses'
            ? Promise.resolve({ data: [address] })
            : Promise.resolve({ data: booking }),
    );

    signedIn(request);

    render(<Book />);

    await waitFor(() => expect(screen.getByText('Home')).toBeOnTheScreen());

    fireEvent.press(screen.getByText('Place booking'));

    expect(screen.getByText('Add a photo or a video of the work.')).toBeOnTheScreen();
    expect(screen.queryByText('Place this booking?')).toBeNull();
    expect(request).not.toHaveBeenCalledWith('/bookings', expect.anything());
});

// Who and where are settled before this screen. Letting either change here would
// invalidate the coverage that chose the provider in the first place.
it('shows who and where without offering a way to change them', async () => {
    const request = jest.fn((path: string) =>
        path === '/addresses'
            ? Promise.resolve({ data: [address, { ...address, id: 'a2', label: 'Work', is_default: false }] })
            : Promise.resolve({ data: booking }),
    );

    signedIn(request);

    render(<Book />);

    await waitFor(() => expect(screen.getByText('Home')).toBeOnTheScreen());

    // The second address exists on the account and must not be offered here.
    expect(screen.queryByText('Work')).toBeNull();
    expect(screen.getByText('Who is coming')).toBeOnTheScreen();
    expect(screen.getByText('FixRight Manila')).toBeOnTheScreen();
});

it('lists a booking with the tone the server gave it', async () => {
    signedIn(jest.fn(() => Promise.resolve({ data: [booking] })));

    render(<Bookings />);

    await waitFor(() => expect(screen.getByText('Cleaning')).toBeOnTheScreen());
    expect(screen.getByText('awaiting a provider')).toBeOnTheScreen();
    expect(screen.getByText('FixRight Manila')).toBeOnTheScreen();
});

it('says nothing is booked rather than showing an empty list', async () => {
    signedIn(jest.fn(() => Promise.resolve({ data: [] })));

    render(<Bookings />);

    await waitFor(() => expect(screen.getByText('Nothing booked yet')).toBeOnTheScreen());
});

// Booking commits someone to a visit and cancelling cannot be undone. Neither
// may happen on a single tap.
it('asks before placing, and posts nothing until the answer is yes', async () => {
    const request = jest.fn((path: string) =>
        path === '/addresses'
            ? Promise.resolve({ data: [address] })
            : Promise.resolve({ data: booking }),
    );

    signedIn(request);

    render(<Book />);

    await waitFor(() => expect(screen.getByText('Home')).toBeOnTheScreen());
    await attachPhoto();

    fireEvent.press(screen.getByText('Place booking'));

    expect(screen.getByText('Place this booking?')).toBeOnTheScreen();
    expect(request).not.toHaveBeenCalledWith('/bookings', expect.anything());
});

it('clears the provider list behind it once a booking is placed', async () => {
    const request = jest.fn((path: string) =>
        path === '/addresses'
            ? Promise.resolve({ data: [address] })
            : Promise.resolve({ data: booking }),
    );

    signedIn(request);

    render(<Book />);

    await waitFor(() => expect(screen.getByText('Home')).toBeOnTheScreen());
    await attachPhoto();

    fireEvent.press(screen.getByText('Place booking'));
    confirmThrough('Place booking');

    await waitFor(() => expect(router.dismissAll).toHaveBeenCalled());
    expect(router.replace).toHaveBeenCalledWith('/bookings');
});

it('asks before cancelling, and cancels nothing until the answer is yes', async () => {
    const request = jest.fn(() => Promise.resolve({ data: booking }));

    signedIn(request);

    render(<BookingDetail />);

    await waitFor(() => expect(screen.getByText('Cancel this booking')).toBeOnTheScreen());

    fireEvent.press(screen.getByText('Cancel this booking'));

    expect(screen.getByText('Cancel this booking?')).toBeOnTheScreen();
    expect(request).not.toHaveBeenCalledWith('/bookings/b1/cancellation', expect.anything());

    confirmThrough('Cancel booking');

    await waitFor(() =>
        expect(request).toHaveBeenCalledWith('/bookings/b1/cancellation', { method: 'POST' }),
    );
});

// On a dialog about cancelling, a button reading Cancel means both things.
it('offers to keep the booking rather than to cancel the cancelling', async () => {
    signedIn(jest.fn(() => Promise.resolve({ data: booking })));

    render(<BookingDetail />);

    await waitFor(() => expect(screen.getByText('Cancel this booking')).toBeOnTheScreen());

    fireEvent.press(screen.getByText('Cancel this booking'));

    expect(screen.getByText('Keep it')).toBeOnTheScreen();
    expect(screen.queryByText('Cancel')).toBeNull();
});

// The dialog is ours, not the platform's: React Native's Alert draws in the
// operating system's colours and typeface and reads as another application.
it('draws the confirmation in the app, not in the operating system', async () => {
    signedIn(jest.fn(() => Promise.resolve({ data: booking })));

    render(<BookingDetail />);

    await waitFor(() => expect(screen.getByText('Cancel this booking')).toBeOnTheScreen());

    fireEvent.press(screen.getByText('Cancel this booking'));

    expect(screen.UNSAFE_getByType(ConfirmDialog)).toBeTruthy();
});
