/**
 * A day, in Philippine ordering.
 */
export function on(date: string): string {
    return new Date(date).toLocaleDateString('en-PH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}
