/**
 * A day, in Philippine ordering.
 *
 * One call so the two places a hold is shown -- the personal gate and the
 * business banner -- cannot drift into different-looking dates.
 */
export function on(date: string): string {
    return new Date(date).toLocaleDateString('en-PH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}
