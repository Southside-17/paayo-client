import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useSession } from '@/lib/session';
import type { Address } from '@/lib/types';

/**
 * The address work would be sent to, re-read whenever a screen takes focus.
 *
 * Coverage is decided by the pin, so nearly every catalog screen needs this
 * before it can ask a useful question.
 */
export function useDefaultAddress(): Address | null {
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

    return addresses?.find((address) => address.is_default) ?? addresses?.[0] ?? null;
}
