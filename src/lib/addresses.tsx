import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useSession } from './session';
import type { Address } from './types';

type AddressesValue = {
    /** Every address on the account, default first. */
    addresses: Address[];
    /** The one work would be sent to, or null when none can be. */
    address: Address | null;
    /** False until the list has landed once. */
    ready: boolean;
    select: (address: Address) => void;
    reload: () => Promise<void>;
};

const AddressesContext = createContext<AddressesValue | null>(null);

/** Whether a provider could ever be matched to this address. */
function dispatchable(address: Address): boolean {
    return address.latitude !== null && address.longitude !== null;
}

/**
 * Where work would be sent, asked once and chosen on the device.
 */
export function AddressesProvider({ children }: { children: ReactNode }) {
    const session = useSession();
    const [addresses, setAddresses] = useState<Address[] | null>(null);
    const [chosen, setChosen] = useState<string | null>(null);

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;

    /**
     * Ask for the list without touching state, so the caller applies it.
     */
    const read = useCallback(async (): Promise<Address[] | null> => {
        if (!authenticatedRequest) {
            return null;
        }

        try {
            const { data } = await authenticatedRequest<{ data: Address[] }>('/addresses');

            return data;
        } catch {
            return null;
        }
    }, [authenticatedRequest]);

    const reload = useCallback(async () => {
        const fresh = await read();

        // Only the first failure settles the list, so a blip while refreshing
        // after an edit does not empty a screen that had one.
        setAddresses((held) => fresh ?? held ?? []);
    }, [read]);

    useEffect(() => {
        let cancelled = false;

        void (async () => {
            const fresh = await read();

            if (!cancelled) {
                setAddresses(fresh ?? []);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [read]);

    const held = useMemo(() => addresses ?? [], [addresses]);

    // An unpinned address cannot be selected, so it is not seeded either: the
    // catalog would answer unfiltered and every tap would land on the picker
    // reporting that nobody serves the area.
    const seeded =
        held.find((entry) => entry.is_default && dispatchable(entry)) ??
        held.find(dispatchable) ??
        null;

    const address = held.find((entry) => entry.id === chosen && dispatchable(entry)) ?? seeded;

    const select = useCallback((entry: Address) => {
        if (dispatchable(entry)) {
            setChosen(entry.id);
        }
    }, []);

    const value = useMemo<AddressesValue>(
        () => ({ addresses: held, address, ready: addresses !== null, reload, select }),
        [address, addresses, held, reload, select],
    );

    return <AddressesContext.Provider value={value}>{children}</AddressesContext.Provider>;
}

export function useAddresses(): AddressesValue {
    const addresses = useContext(AddressesContext);

    if (!addresses) {
        throw new Error('useAddresses must be used inside an AddressesProvider.');
    }

    return addresses;
}
