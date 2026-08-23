import { useAddresses } from '@/lib/addresses';
import type { Address } from '@/lib/types';

type Answer = { address: Address | null; ready: boolean };

/**
 * The address work would be sent to, as the catalog screens read it.
 */
export function useSelectedAddress(): Answer {
    const { address, ready } = useAddresses();

    return { address, ready };
}
