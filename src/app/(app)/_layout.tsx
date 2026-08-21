import { Redirect, Stack, usePathname } from 'expo-router';

import { useSession } from '@/lib/session';

/**
 * Everything past sign in, holding the two gates the server holds.
 *
 * Order matters and matches the middleware: `verified` then EnsureHasNickname.
 * Proving the address comes before choosing what to be called, and a provider
 * signup arrives already confirmed so it only ever meets the second one.
 */
export default function AppLayout() {
    const session = useSession();
    const pathname = usePathname();

    if (session.status !== 'authenticated') {
        return null;
    }

    if (!session.user.email_verified && pathname !== '/verify-email') {
        return <Redirect href="/verify-email" />;
    }

    if (session.user.email_verified && session.user.nickname === '' && pathname !== '/set-nickname') {
        return <Redirect href="/set-nickname" />;
    }

    return <Stack screenOptions={{ headerShown: false }} />;
}
