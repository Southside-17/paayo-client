import { COLLECTABLE, attestation, destinationLine, isOwed, isTransfer, outstanding, standing } from '@/lib/billing';
import type { Destination, Invoice, Payment } from '@/lib/types';

const invoice = (total: number, paid: number): Invoice => ({
    id: 'inv_1',
    lines: [],
    total,
    paid,
    outstanding: Math.max(0, total - paid),
    is_settled: paid >= total,
    created_at: '2026-08-25T10:00:00+08:00',
});

const payment = (over: Partial<Payment> = {}): Payment => ({
    id: 'pay_1',
    method: { value: 'cash', label: 'Cash', wording: 'paid in cash' },
    amount: 200_000,
    paid_at: '2026-08-25T18:31:00+08:00',
    is_attested: true,
    confirmed_by: 'Mario',
    destination: null,
    ...over,
});

// Custody, not whether it was electronic. A GCash sent straight to the provider
// is the same shape as cash on the doorstep, and the receipt requirement follows
// the same line.
it('counts a transfer as anything sent somewhere, cash as neither', () => {
    expect(isTransfer('gcash')).toBe(true);
    expect(isTransfer('maya')).toBe(true);
    expect(isTransfer('bank')).toBe(true);
    expect(isTransfer('cash')).toBe(false);
    expect(isTransfer('paymongo')).toBe(false);
});

it('offers only the rails a person can attest', () => {
    expect(COLLECTABLE).toEqual(['cash', 'gcash', 'maya', 'bank']);
    expect(COLLECTABLE).not.toContain('paymongo');
});

it('reads what is owed off the server rather than recomputing it', () => {
    expect(outstanding(invoice(200_000, 50_000))).toBe(150_000);
    expect(outstanding(null)).toBeNull();
    expect(outstanding(undefined)).toBeNull();
});

it('treats no invoice as nothing owed, not as owing', () => {
    expect(isOwed(null)).toBe(false);
    expect(isOwed(undefined)).toBe(false);
    expect(isOwed(invoice(200_000, 0))).toBe(true);
    expect(isOwed(invoice(200_000, 200_000))).toBe(false);
});

// Not an alarm. Nothing here accuses anybody: the crew may simply not have got
// round to it, which is what most of these are.
it('says where the money stands without accusing anyone', () => {
    expect(standing(invoice(200_000, 0))).toBe('₱2,000 · not yet marked as paid');
    expect(standing(invoice(200_000, 200_000))).toBe('₱2,000 · paid in full');
    expect(standing(invoice(200_000, 50_000))).toBe('₱1,500 of ₱2,000 still owing');
    expect(standing(null)).toBeNull();
});

// Names the person on purpose: on this rail the record is somebody's word, and
// the client is owed the chance to see whose.
it('names who said the money arrived', () => {
    expect(attestation(payment())).toContain('by Mario');
    expect(attestation(payment({ confirmed_by: null }))).not.toContain('by');
});

it('names an account by its institution, and by the wallet when it is one', () => {
    const bank: Destination = {
        method: { value: 'bank', label: 'Bank transfer' },
        handle: '1234567890',
        name: 'Juan Dela Cruz',
        institution: 'BPI',
        has_code: false,
    };

    const gcash: Destination = {
        method: { value: 'gcash', label: 'GCash' },
        handle: '09171234567',
        name: 'Juan D.',
        institution: null,
        has_code: true,
    };

    expect(destinationLine(bank)).toBe('BPI · Juan Dela Cruz');
    expect(destinationLine(gcash)).toBe('GCash · Juan D.');
});
