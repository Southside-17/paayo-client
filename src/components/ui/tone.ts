/**
 * The five statuses a pill or a badge can carry.
 *
 * Every tone names a real token family: the base colour is the ink, the
 * `-subtle` variant behind it. Neutral has no family of its own and borrows
 * muted, which is the same pairing the console uses for an inert state.
 */
export type Tone = 'brand' | 'success' | 'warning' | 'info' | 'neutral';

type ToneClasses = { fill: string; dot: string; ink: string };

/**
 * NativeWind reads class names statically, so each tone spells its classes out
 * in full. Building them from the tone name leaves nothing for the compiler to
 * find and every pill renders unstyled.
 */
export const TONES: Record<Tone, ToneClasses> = {
    brand: { fill: 'bg-brand-subtle', dot: 'bg-brand', ink: 'text-brand' },
    success: { fill: 'bg-success-subtle', dot: 'bg-success', ink: 'text-success' },
    warning: { fill: 'bg-warning-subtle', dot: 'bg-warning', ink: 'text-warning' },
    info: { fill: 'bg-info-subtle', dot: 'bg-info', ink: 'text-info' },
    neutral: { fill: 'bg-muted', dot: 'bg-muted-foreground', ink: 'text-muted-foreground' },
};
