import type { PricingUnit } from '@/lib/types';

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
 * Render what a listing costs, in the unit its service names.
 */
export function priceRange(
    min: number | null,
    max: number | null,
    unit: PricingUnit,
): string {
    if (unit.is_quoted) {
        return unit.label;
    }

    if (min === null) {
        return 'Price on request';
    }

    if (max === null || max === min) {
        return `from ${peso(min)}${unit.suffix}`;
    }

    return `${peso(min)}–${peso(max)}${unit.suffix}`;
}
