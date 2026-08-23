import { GOOGLE, type Brand } from '@/lib/brands';
import { googleIsConfigured } from '@/lib/google';

export type SocialProvider = {
    /** Matches App\Enums\SocialProvider on the server, and the route segment. */
    key: string;
    label: string;
    brand: Brand;
    /** Whether this build carries the credentials the provider needs. */
    isConfigured: () => boolean;
};

/**
 * The providers that can open an account, in the order they are offered.
 */
export const SOCIAL_PROVIDERS: SocialProvider[] = [
    { key: 'google', label: 'Google', brand: GOOGLE, isConfigured: googleIsConfigured },
];

/** The providers this build can actually reach. */
export function enabledSocialProviders(): SocialProvider[] {
    return SOCIAL_PROVIDERS.filter((provider) => provider.isConfigured());
}
