import type { Booking } from '@/lib/types';

/** The day and hour a visit is set for, as one line. */
export function when(scheduled: string): string {
    return new Date(scheduled).toLocaleString('en-PH', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
    });
}

/**
 * How many bookings sit in each status.
 *
 * Every status is counted, not just the filterable ones, so a chip the server
 * adds later reads a real number rather than zero.
 */
export function countByStatus(bookings: Booking[]): Record<string, number> {
    return bookings.reduce<Record<string, number>>((counts, booking) => {
        counts[booking.status.value] = (counts[booking.status.value] ?? 0) + 1;

        return counts;
    }, {});
}

/**
 * The bookings in one status, or all of them when nothing is chosen.
 *
 * Narrowing happens here rather than on the server: neither list is paginated,
 * so the client already holds every row, and a round trip per chip would cost a
 * loading state to show what is already in memory.
 */
export function narrowTo(bookings: Booking[], status: string | null): Booking[] {
    return status === null
        ? bookings
        : bookings.filter((booking) => booking.status.value === status);
}
