import { peso } from '@/lib/money';
import type { Destination, Invoice, IssuedParty, Payment, PaymentMethod } from '@/lib/types';

/** The rails a client can be recorded as having paid on, in the order offered. */
export const COLLECTABLE: PaymentMethod['value'][] = ['cash', 'ewallet', 'bank'];

/**
 * Whether a payment was sent somewhere rather than handed over.
 *
 * One question doing three jobs, mirroring PaymentMethod::isTransfer(): a
 * transfer names the institution it went to, has a published account behind it,
 * and leaves a confirmation screen worth photographing. Cash does none.
 */
export function isTransfer(method: PaymentMethod['value']): boolean {
    return method === 'ewallet' || method === 'bank';
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

/**
 * How an account is named to a client about to send money to it.
 *
 * The institution first, because that is what a person recognises -- "GCash",
 * not "E-wallet" -- and the account name second, because that is the only thing
 * that lets them check they are sending to the right person.
 */
export function destinationLine(destination: Destination): string {
    return `${destination.institution} · ${destination.name}`;
}

/**
 * How the business that issued an invoice is named on it.
 *
 * Read off the invoice, never off the provider: an issued invoice is kept as it
 * was issued, so a business that has since re-registered still shows the name it
 * billed under. The trading name follows in brackets where the two differ, which
 * is what lets a client match the document to the company they booked.
 */
export function issuerLine(invoice: Invoice | null | undefined): string | null {
    const issuer = invoice?.issued_from;

    if (!issuer) {
        return null;
    }

    const named = issuer.business_style ? `${issuer.name} (${issuer.business_style})` : issuer.name;

    return issuer.tin ? `${named} · TIN ${issuer.tin}` : named;
}

/** How the party an invoice was made out to is named on it. */
export function billedLine(invoice: Invoice | null | undefined): string | null {
    const billed: IssuedParty | null | undefined = invoice?.issued_to;

    if (!billed) {
        return null;
    }

    return billed.tin ? `${billed.name} · TIN ${billed.tin}` : billed.name;
}
