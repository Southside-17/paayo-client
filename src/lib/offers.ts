import type { Service, ServiceOffer } from '@/lib/types';

type Market = { id: string; name: string } | null | undefined;

let pinned: string | null = null;
let held: Record<string, ServiceOffer> = {};

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
}
