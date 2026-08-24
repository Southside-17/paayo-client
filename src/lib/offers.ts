import type { BookedLine, Listing, Service, ServiceOffer } from '@/lib/types';

type Market = { id: string; name: string } | null | undefined;

let pinned: string | null = null;
let held: Record<string, ServiceOffer> = {};
let carried: Record<string, Carried> = {};

type Carried = {
    listing: Listing;
    answers: Record<string, string>;
    lines: BookedLine[];
};

/**
 * What the trade list already learned about a service, for the picker.
 */
export function remember(addressId: string | null, market: Market, services: Service[]): void {
    if (addressId !== pinned) {
        pinned = addressId;
        held = {};
    }

    for (const service of services) {
        held[service.id] = {
            data: service,
            market: market ?? null,
            covering: service.covering ?? null,
            alternatives: service.alternatives ?? [],
        };
    }
}

/** What is known about a service at this address, if the list came through here. */
export function recall(serviceId: string, addressId: string | null): ServiceOffer | null {
    if (addressId !== pinned) {
        return null;
    }

    return held[serviceId] ?? null;
}

/** Forget everything. For tests, and for signing out. */
export function forget(): void {
    pinned = null;
    held = {};
    carried = {};
}

/**
 * Hold what the listing screen gathered, for the booking screen to pick up.
 *
 * Ten answers at 500 characters will not fit in a query param, and serialising
 * a whole Listing through the router is the thing `remember()` exists to avoid,
 * so both travel in module state under a key instead.
 */
export function carry(
    listing: Listing,
    answers: Record<string, string>,
    lines: BookedLine[],
): string {
    carried[listing.id] = { listing, answers, lines };

    return listing.id;
}

/** What the listing screen gathered under this key, if it is still held. */
export function recallCarried(key: string): Carried | null {
    return carried[key] ?? null;
}
