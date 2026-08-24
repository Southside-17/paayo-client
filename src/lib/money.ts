import type { BookedLine, PricingMethod, RateLine } from '@/lib/types';

/** Render centavos as pesos, without the centavos when they are zero. */
export function peso(centavos: number): string {
    const pesos = centavos / 100;
    const whole = Number.isInteger(pesos);

    return `₱${pesos.toLocaleString('en-PH', {
        minimumFractionDigits: whole ? 0 : 2,
        maximumFractionDigits: 2,
    })}`;
}

/**
 * Render the band a provider's rate card derives, or say it is quoted instead.
 */
export function priceRange(
    min: number | null,
    max: number | null,
    method: PricingMethod,
): string {
    if (method.is_on_request) {
        return method.label;
    }

    if (min === null) {
        return 'Price on request';
    }

    if (max === null || max === min) {
        return `from ${peso(min)}`;
    }

    return `${peso(min)}–${peso(max)}`;
}

/**
 * Render one rate line: what it covers, and what it costs per what.
 *
 * 'hour' mirrors RateLine::HOUR on the server; change it in both or neither.
 */
export function rateLine(line: RateLine): string {
    if (line.unit === null) {
        return peso(line.amount);
    }

    return line.unit === 'hour'
        ? `${peso(line.amount)}/hr`
        : `${peso(line.amount)} per ${line.unit}`;
}

/**
 * Render what a picked line comes to, mirroring Booking::expectedTotal().
 *
 * Null for an hourly line and for a count nobody has given: that total does not
 * exist yet, and showing a number for it would be a guess dressed as a price.
 */
export function figure(line: RateLine | null, quantity: number | null): string | null {
    if (line === null || line.unit === 'hour') {
        return null;
    }

    if (line.unit === null) {
        return peso(line.amount);
    }

    return quantity === null ? null : peso(line.amount * quantity);
}

/**
 * Render the arithmetic behind a figure, so the number is checkable.
 *
 * The whole reason this screen exists is that a band asks to be trusted; the
 * multiplication is what makes the total answerable instead.
 */
export function workings(line: RateLine | null, quantity: number | null): string | null {
    if (line === null || line.unit === null || line.unit === 'hour') {
        return null;
    }

    if (quantity === null) {
        return `${peso(line.amount)} per ${line.unit} · they measure on site`;
    }

    return `${peso(line.amount)} × ${quantity} ${line.unit}`;
}

/**
 * Render what a whole set of picked lines comes to.
 *
 * One line nobody can total makes the whole figure unknowable, mirroring
 * BookedLines::total() -- a partial sum shown as the price would be a lie.
 */
export function basket(lines: BookedLine[]): string | null {
    if (lines.length === 0) {
        return null;
    }

    let total = 0;

    for (const line of lines) {
        if (line.unit === 'hour') {
            return null;
        }

        if (line.unit === null) {
            total += line.amount;

            continue;
        }

        if (line.quantity === null) {
            return null;
        }

        total += line.amount * line.quantity;
    }

    return peso(total);
}
