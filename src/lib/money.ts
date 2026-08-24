import type { PricingMethod, RateLine } from '@/lib/types';

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
