import { render, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import { View } from 'react-native';

import Job from '@/app/(app)/job/[id]';
import { stopWatching, watchForArrival } from '@/lib/geofence';
import { useSession } from '@/lib/session';
import type { Booking } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';

jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));
jest.mock('@/lib/workspace', () => ({ useWorkspace: jest.fn() }));
jest.mock('@/lib/geofence', () => ({
    watchForArrival: jest.fn(async () => true),
    stopWatching: jest.fn(async () => undefined),
}));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-router', () => ({
    Redirect: MockRedirect,
    useFocusEffect: MockUseFocusEffect,
    useLocalSearchParams: () => ({ id: 'b1', name: 'Aircon cleaning', job: 'w1' }),
    router: { back: jest.fn(), dismissAll: jest.fn(), replace: jest.fn() },
}));

function MockRedirect({ href }: { href: string }) {
    return <View accessibilityLabel={`redirect ${href}`} />;
}

function MockUseFocusEffect(callback: () => void) {
    useEffect(callback, [callback]);
}

/** A booking taken and on the road, only as much of it as the screen reads. */
function underway(progress: 'enroute' | 'arrived' | 'completed'): Booking {
    return {
        id: 'b1',
        status: {
            value: 'accepted',
            label: 'Accepted',
            wording: 'accepted',
            tone: 'info',
            is_open: true,
            is_awaiting_client: false,
            needs_another_provider: false,
        },
        description: 'The unit drips.',
        scheduled_at: '2026-09-01T02:00:00.000000Z',
        accepted_at: '2026-08-02T00:00:00.000000Z',
        cancelled_at: null,
        refused_at: null,
        agreed_total: 150_000,
        settled_total: 150_000,
        price_min: 150_000,
        price_max: null,
        address: { label: 'Home', line: '12 Mabini Street, Barangay 5, Davao City' },
        latitude: 7.07,
        longitude: 125.61,
        pin_radius: null,
        surcharge: null,
        pricing_method: { value: 'per_job', label: 'Per job', is_on_request: false },
        hour_rounding: { value: 'hour', label: 'To the hour' },
        lines: [],
        expected_total: 150_000,
        intake: [],
        service: { id: 's1', name: 'Aircon cleaning' },
        provider: { id: 'p1', name: 'Bright Electric' },
        client: { id: 'u9', nickname: 'Mara', phone: '09171234567' },
        created_at: '2026-08-01T00:00:00.000000Z',
        job: {
            id: 'w1',
            booking_id: 'b1',
            status: {
                value: progress,
                label: progress,
                wording: progress,
                tone: 'info',
                is_underway: progress !== 'completed',
                is_finished: progress === 'completed',
            },
            enroute_at: '2026-09-01T01:00:00.000000Z',
            arrived_at: progress === 'enroute' ? null : '2026-09-01T02:00:00.000000Z',
            started_at: null,
            completed_at: null,
            cancelled_at: null,
            lines: [],
            final_total: null,
            note: null,
            elapsed_minutes: null,
            starts_on_arrival: true,
            hourly_label: null,
            crew: [],
            created_at: '2026-08-02T00:00:00.000000Z',
        },
    } as unknown as Booking;
}

function showing(booking: Booking) {
    (useWorkspace as jest.Mock).mockReturnValue({
        staff: {
            id: 's1',
            role: 'technician',
            role_label: 'Technician',
            permissions: ['job:work'],
            provider: { id: 'p1', name: 'Bright Electric' },
        },
        businesses: [],
        enter: jest.fn(),
        leave: jest.fn(),
    });
    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        user: { id: 'u1', nickname: 'Juan' },
        token: 'a-token',
        authenticatedRequest: jest.fn().mockResolvedValue({ data: booking }),
        reload: jest.fn(),
        logout: jest.fn(),
    });
}

beforeEach(() => jest.clearAllMocks());

it('arms the fence when the job is on the road', async () => {
    showing(underway('enroute'));

    render(<Job />);

    await waitFor(() =>
        expect(watchForArrival).toHaveBeenCalledWith(
            { provider: 'p1', job: 'w1' },
            { latitude: 7.07, longitude: 125.61 },
        ),
    );
    expect(stopWatching).not.toHaveBeenCalled();
});

// The crew go back to the Jobs tab, or close the app, before they leave the
// depot. The fence lives as long as the job is on the road, not the screen.
it('keeps the fence up when the screen is left', async () => {
    showing(underway('enroute'));

    const { unmount } = render(<Job />);

    await waitFor(() => expect(watchForArrival).toHaveBeenCalled());

    unmount();

    expect(stopWatching).not.toHaveBeenCalled();
});

it('drops the fence once the job is no longer on the road', async () => {
    showing(underway('arrived'));

    render(<Job />);

    await waitFor(() => expect(stopWatching).toHaveBeenCalledWith('w1'));
    expect(watchForArrival).not.toHaveBeenCalled();
});
