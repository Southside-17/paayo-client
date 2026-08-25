import { peso } from '@/lib/money';
import type { Destination, Invoice, Payment, PaymentMethod } from '@/lib/types';

/** The methods a client can be recorded as having paid by, in the order offered. */
export const COLLECTABLE: PaymentMethod['value'][] = ['cash', 'gcash', 'maya', 'bank'];

/**
 * Whether a method was sent somewhere rather than handed over.
 *
 * The same set that leaves a confirmation screen worth photographing, which is
 * why it answers both questions. Mirrors PaymentMethod::isTransfer().
 */
export function isTransfer(method: PaymentMethod['value']): boolean {
    return method === 'gcash' || method === 'maya' || method === 'bank';
}

/**
 * What is still owed on an invoice, or null when there is nothing to owe on.
 *
 * The server is the authority and sends `outstanding` on the invoice; this reads
 * it rather than recomputing, so the two cannot disagree.
 */
export function outstanding(invoice: Invoice | null | undefined): number | null {
    return invoice ? invoice.outstanding : null;
}

/** Whether there is finished work nobody has recorded a payment for. */
export function isOwed(invoice: Invoice | null | undefined): boolean {
    return invoice ? !invoice.is_settled : false;
}

/**
 * The sentence a client reads about where their money stands.
 *
 * Deliberately not an alarm. Nothing here accuses anyone: the crew may simply
 * not have got round to it, which is what most of these are.
 */
export function standing(invoice: Invoice | null | undefined): string | null {
    if (!invoice) {
        return null;
    }

    if (invoice.is_settled) {
        return `${peso(invoice.total)} · paid in full`;
    }

    if (invoice.paid > 0) {
        return `${peso(invoice.outstanding)} of ${peso(invoice.total)} still owing`;
    }

    return `${peso(invoice.total)} · not yet marked as paid`;
}

/**
 * The line under a recorded payment, saying who said so and when.
 *
 * Names the person on purpose. On this rail the record is somebody's word, and
 * a client is owed the chance to see whose before they accept it as settled.
 */
export function attestation(payment: Payment): string {
    const when = new Date(payment.paid_at).toLocaleString('en-PH', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
    });

    return payment.confirmed_by ? `${when} · by ${payment.confirmed_by}` : when;
}

/** How an account is named to a client about to send money to it. */
export function destinationLine(destination: Destination): string {
    const label = destination.institution ?? destination.method.label;

    return `${label} · ${destination.name}`;
}
