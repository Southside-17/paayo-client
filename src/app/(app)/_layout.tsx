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

    if (!session.user.email_verified) {
        return pathname === '/verify-email' ? (
            <Stack screenOptions={{ headerShown: false }} />
        ) : (
            <Redirect href="/verify-email" />
        );
    }

    if (session.user.nickname === '') {
        return pathname === '/set-nickname' ? (
            <Stack screenOptions={{ headerShown: false }} />
        ) : (
            <Redirect href="/set-nickname" />
        );
    }

    // Both satisfied, so a gate screen has nothing left to hold. Without this
    // the redirect only ever pointed one way: answering the gate left the
    // person standing on it, and the button looked like it had done nothing.
    if (pathname === '/verify-email' || pathname === '/set-nickname') {
        return <Redirect href="/" />;
    }

    return <Stack screenOptions={{ headerShown: false }} />;
}
