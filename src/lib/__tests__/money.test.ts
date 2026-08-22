import { peso, priceRange } from '@/lib/money';

const fixed = { value: 'fixed', label: 'Fixed price', suffix: '', is_quoted: false };
const hourly = { value: 'hourly', label: 'Hourly rate', suffix: '/hr', is_quoted: false };
const quoted = { value: 'quote', label: 'Quote on request', suffix: '', is_quoted: true };

it('drops the centavos when there are none', () => {
    expect(peso(150_000)).toBe('₱1,500');
    expect(peso(150_050)).toBe('₱1,500.50');
});

it('carries the unit its service names', () => {
    expect(priceRange(150_000, null, hourly)).toBe('from ₱1,500/hr');
});

it('reads a floor as a floor, not a guess at a ceiling', () => {
    expect(priceRange(150_000, null, fixed)).toBe('from ₱1,500');
    expect(priceRange(150_000, 250_000, fixed)).toBe('₱1,500–₱2,500');
});

// The server clears the price of a quoted service, so a number here would be
// one the client invented.
it('names the unit rather than a number when the job has to be seen', () => {
    expect(priceRange(null, null, quoted)).toBe('Quote on request');
});
