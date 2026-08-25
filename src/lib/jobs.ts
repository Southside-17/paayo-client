import type { BookedLine, HourRounding, Job, WorkedLine } from '@/lib/types';

/**
 * The one thing a crew member is meant to do next on a job.
 *
 * One button, not a row of them. The steps only ever run in one order, so
 * offering all four is offering three wrong answers -- and the crew are reading
 * this with tools in their hands.
 */
export type NextStep = {
    /** The route segment under `jobs/{job}`, or null when the step is a screen. */
    path: 'departure' | 'arrival' | 'start' | null;
    label: string;
    /** Set when the step is deliberate enough to confirm first. */
    confirm?: { title: string; body: string; button: string };
};

/**
 * What the live button on a job says and does, or null when there is nothing.
 *
 * `starts_on_arrival` is why there is no start step on most cards: arriving
 * writes `started_at` in the same breath when nothing is charged by the hour,
 * so a start tap there would buy a state change and no information.
 */
export function nextStep(job: Job): NextStep | null {
    switch (job.status.value) {
        case 'assigned':
            return { path: 'departure', label: "I'm on my way" };

        case 'enroute':
            return { path: 'arrival', label: "I've arrived" };

        case 'arrived':
            return { path: 'start', label: 'Start work' };

        case 'working':
            return {
                path: null,
                label: 'Finish this job',
                confirm: {
                    title: 'Finished here?',
                    body: 'You will say what was done and how long it took, and that is what the client is billed.',
                    button: 'Yes, finish up',
                },
            };

        default:
            return null;
    }
}

/** A span of minutes as hours and minutes, mirroring HourRounding::span(). */
export function span(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;

    if (hours === 0) {
        return `${rest}m`;
    }

    return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/**
 * What one finished line reads as under the price.
 *
 * The rounding is already applied on the server, so `workings` is printed and
 * never recomputed -- there is one rule and it lives there.
 */
export function accounting(line: WorkedLine): string | null {
    if (line.unit === 'hour') {
        return line.workings;
    }

    if (line.unit === null) {
        return null;
    }

    return line.quantity === null ? null : `${line.quantity} ${line.unit}`;
}

/**
 * What one line will be accounted for as, while the crew are still typing it.
 */
export type Accounted = { label: string; quantity: number | null; minutes: number | null };

/**
 * Minutes worked turned into minutes charged, mirroring HourRounding.
 *
 * **A preview, not the authority.** The server applies this again on the way in
 * and its answer is what bills; this exists so the running total moves as the
 * crew type rather than after a round trip. Always rounds up, the way the enum
 * does.
 */
export function chargeableMinutes(minutes: number, rounding: HourRounding): number {
    const step = rounding.value === 'minute' ? 1 : rounding.value === 'half_hour' ? 30 : 60;

    return Math.ceil(minutes / step) * step;
}

/** What one line comes to, or null while it is still unaccounted for. */
export function lineTotal(
    line: BookedLine,
    stated: Accounted | undefined,
    rounding: HourRounding,
): number | null {
    if (line.unit === 'hour') {
        const minutes = stated?.minutes ?? null;

        return minutes === null
            ? null
            : Math.floor((chargeableMinutes(minutes, rounding) * line.amount) / 60);
    }

    if (line.unit === null) {
        return line.amount;
    }

    const quantity = stated?.quantity ?? line.quantity;

    return quantity === null ? null : line.amount * quantity;
}

/**
 * What the whole job comes to, or null while any line is unaccounted for.
 *
 * One unknowable line makes the figure unknowable, mirroring WorkedLines and
 * BookedLines before it: a partial sum shown where the bill goes is worse than
 * no figure.
 */
export function runningTotal(
    lines: BookedLine[],
    stated: Record<string, Accounted>,
    rounding: HourRounding,
): number | null {
    if (lines.length === 0) {
        return null;
    }

    let total = 0;

    for (const line of lines) {
        const part = lineTotal(line, stated[line.label], rounding);

        if (part === null) {
            return null;
        }

        total += part;
    }

    return total;
}
