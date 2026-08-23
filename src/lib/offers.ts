import type { Service, ServiceOffer } from '@/lib/types';

type Market = { id: string; name: string } | null | undefined;

let pinned: string | null = null;
let held: Record<string, ServiceOffer> = {};

/**
 * What the category list already learned about a service, for the picker.
 *
 * The picker needs the market and the list of providers, and the list it was
 * tapped from was answered both. Keeping them here lets that screen paint
 * providers on its first frame instead of asking again and holding skeletons.
 * Keyed on the address because coverage is decided by the pin: a selection
 * change makes every remembered answer wrong at once, so the map is dropped
 * whole rather than entry by entry.
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
}
