import { Redirect, Stack, usePathname } from 'expo-router';

import { useSession } from '@/lib/session';

/**
 * Everything past sign in. An unconfirmed address is held at the verification
 * gate, mirroring the server, where every route but the resend endpoint sits
 * behind `verified`.
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

    return <Stack screenOptions={{ headerShown: false }} />;
}
