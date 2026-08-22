import { Redirect, Stack, usePathname } from 'expo-router';

import { useSession } from '@/lib/session';

/** The personal side is the root of this stack, so switching always lands home. */
export const unstable_settings = { initialRouteName: '(tabs)' };

/**
 * Everything past sign in, holding the three gates the server holds.
 *
 * Order matters and matches the middleware: EnsureNotSuspended, then
 * `verified`, then EnsureHasNickname. A hold comes first because it outranks
 * both -- the API answers 403 to the verification email a held account would
 * be sent to ask for, so a gate in front of this one strands them on a screen
 * whose only button cannot work. Proving the address then comes before choosing
 * what to be called, and a provider signup arrives already confirmed so it only
 * ever meets the last one.
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

    // Every gate satisfied, so a gate screen has nothing left to hold. Without
    // this the redirect only ever pointed one way: answering the gate left the
    // person standing on it, and the button looked like it had done nothing.
    if (pathname === '/held' || pathname === '/verify-email' || pathname === '/set-nickname') {
        return <Redirect href="/" />;
    }

    return <Stack screenOptions={{ headerShown: false }} />;
}
