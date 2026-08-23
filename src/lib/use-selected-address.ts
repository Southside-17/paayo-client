import { useAddresses } from '@/lib/addresses';
import type { Address } from '@/lib/types';

type Answer = { address: Address | null; ready: boolean };

/**
 * The address work would be sent to, as the catalog screens read it.
 *
 * `ready` is not decoration. Coverage is decided by the pin, so a catalog screen
 * that asks before this settles asks the unfiltered question, gets a longer
 * list, and then visibly shrinks it a moment later. Null alone cannot say
 * whether that means "none saved" or "not yet".
 */
export function useSelectedAddress(): Answer {
    const { address, ready } = useAddresses();

    return { address, ready };
}
