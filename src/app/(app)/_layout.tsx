import { Redirect, Stack, usePathname } from 'expo-router';

import { AddressesProvider } from '@/lib/addresses';
import { useSession } from '@/lib/session';

/** The personal side is the root of this stack, so switching always lands home. */
export const unstable_settings = { initialRouteName: '(tabs)' };

/**
 * Everything past sign in, holding the three gates the server holds.
 */
export default function AppLayout() {
    const session = useSession();
    const pathname = usePathname();

    if (session.status !== 'authenticated') {
        return null;
    }

    if (session.user.suspension) {
        return pathname === '/held' ? (
            <Stack screenOptions={{ headerShown: false }} />
        ) : (
            <Redirect href="/held" />
        );
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

    if (pathname === '/held' || pathname === '/verify-email' || pathname === '/set-nickname') {
        return <Redirect href="/" />;
    }

    return (
        <AddressesProvider>
            <Stack screenOptions={{ headerShown: false }} />
        </AddressesProvider>
    );
}
