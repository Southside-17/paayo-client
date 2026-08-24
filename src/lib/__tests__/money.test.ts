import { peso, priceRange, rateLine } from '@/lib/money';

const perJob = { value: 'per_job', label: 'Per job', is_on_request: false };
const perUnit = { value: 'per_unit', label: 'Per unit', is_on_request: false };
const onRequest = { value: 'on_request', label: 'Priced on request', is_on_request: true };

const line = (amount: number, unit: string | null) => ({
    label: 'Split type',
    amount,
    unit,
    estimated_minutes: unit === 'hour' ? 120 : null,
    maximum_minutes: unit === 'hour' ? 240 : null,
    is_active: true,
});

it('drops the centavos when there are none', () => {
    expect(peso(150_000)).toBe('₱1,500');
    expect(peso(150_050)).toBe('₱1,500.50');
});

it('reads a floor as a floor, not a guess at a ceiling', () => {
    expect(priceRange(150_000, null, perJob)).toBe('from ₱1,500');
    expect(priceRange(150_000, 250_000, perUnit)).toBe('₱1,500–₱2,500');
});

// A listing priced on request has no band by construction, so a number here
// would be one the client invented.
it('names the method rather than a number when the job has to be seen', () => {
    expect(priceRange(null, null, onRequest)).toBe('Priced on request');
});

it('says a rate is not priced yet rather than free', () => {
    expect(priceRange(null, null, perUnit)).toBe('Price on request');
});

it('carries the unit each rate is charged per', () => {
    expect(rateLine(line(60_000, 'unit'))).toBe('₱600 per unit');
    expect(rateLine(line(18_000, 'sqm'))).toBe('₱180 per sqm');
    expect(rateLine(line(50_000, 'hour'))).toBe('₱500/hr');
    expect(rateLine(line(1_500_000, null))).toBe('₱15,000');
});
