import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useSession } from '@/lib/session';
import type { Address } from '@/lib/types';

type Answer = { address: Address | null; ready: boolean };

/**
 * The address work would be sent to, re-read whenever a screen takes focus.
 *
 * `ready` is not decoration. Coverage is decided by the pin, so a catalog
 * screen that asks before this settles asks the unfiltered question, gets a
 * longer list, and then visibly shrinks it a moment later. Null alone cannot
 * say whether that means "none saved" or "not yet".
 */
export function useDefaultAddress(): Answer {
    const session = useSession();
    const [addresses, setAddresses] = useState<Address[] | null>(null);

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;

    useFocusEffect(
        useCallback(() => {
            if (!authenticatedRequest) {
                return;
            }

            void authenticatedRequest<{ data: Address[] }>('/addresses')
                .then(({ data }) => setAddresses(data))
                .catch(() => setAddresses([]));
        }, [authenticatedRequest]),
    );

    return {
        address: addresses?.find((entry) => entry.is_default) ?? addresses?.[0] ?? null,
        ready: addresses !== null,
    };
}
