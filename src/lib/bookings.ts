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
 * Anything a filter chip can narrow: a booking, or an enquiry.
 *
 * Structural rather than a union, because these two only ever read the status --
 * naming the shape keeps them from having to know every row type that gains a
 * filtered list later.
 */
type Statused = { status: { value: string } };

/**
 * How many bookings sit in each status.
 *
 * Every status is counted, not just the filterable ones, so a chip the server
 * adds later reads a real number rather than zero.
 */
export function countByStatus(rows: Statused[]): Record<string, number> {
    return rows.reduce<Record<string, number>>((counts, row) => {
        counts[row.status.value] = (counts[row.status.value] ?? 0) + 1;

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
export function narrowTo<T extends Statused>(rows: T[], status: string | null): T[] {
    return status === null ? rows : rows.filter((row) => row.status.value === status);
}
