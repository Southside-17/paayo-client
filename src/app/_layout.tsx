import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { useEffect } from 'react';
import { ActivityIndicator, LogBox, View } from 'react-native';

import { SessionProvider, useSession } from '@/lib/session';
import { WorkspaceProvider } from '@/lib/workspace';
import palette from '@/theme/palette';

import '../global.css';

/**
 * LogBox's notification bar cannot be read in this app, so it is turned off.
 */
LogBox.ignoreAllLogs();

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

/** Where a notification of each kind is read in full. */
const DESTINATIONS: Record<string, (id: string) => string> = {
    'booking.placed': (id) => `/job/${id}`,
    'booking.accepted': (id) => `/booking/${id}`,
    'booking.declined': (id) => `/booking/${id}`,
};

/**
 * Open the record a tapped notification is about.
 */
function useNotificationTaps() {
    useEffect(() => {
        const listener = Notifications.addNotificationResponseReceivedListener(({ notification }) => {
            const data = notification.request.content.data as Record<string, unknown>;
            const destination = DESTINATIONS[String(data.type)];

            if (destination && typeof data.booking_id === 'string') {
                router.push(destination(data.booking_id) as never);
            }
        });

        return () => listener.remove();
    }, []);
}

/**
 * React Navigation paints the ground beneath every screen and during every
 * transition, and it cannot read the CSS variables the rest of the app styles
 * with, so it is handed the same tokens as literals.
 */
function navigationTheme(scheme: 'light' | 'dark') {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    const colors = palette[scheme];

    return {
        ...base,
        colors: {
            ...base.colors,
            primary: colors.brand,
            background: colors.background,
            card: colors.card,
            text: colors.foreground,
            border: colors.border,
            notification: colors.destructive,
        },
    };
}

function RootNavigator() {
    const session = useSession();

    useNotificationTaps();

    if (session.status === 'loading') {
        return (
            <View className="bg-background flex-1 items-center justify-center">
                <ActivityIndicator />
            </View>
        );
    }

    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Protected guard={session.status === 'unauthenticated'}>
                <Stack.Screen name="(auth)" />
            </Stack.Protected>

            <Stack.Protected guard={session.status === 'authenticated'}>
                <Stack.Screen name="(app)" />
            </Stack.Protected>
        </Stack>
    );
}

export default function RootLayout() {
    const { colorScheme } = useColorScheme();
    const scheme = colorScheme === 'dark' ? 'dark' : 'light';

    return (
        <ThemeProvider value={navigationTheme(scheme)}>
            <SessionProvider>
                <WorkspaceProvider>
                    <RootNavigator />
                </WorkspaceProvider>
            </SessionProvider>

            <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        </ThemeProvider>
    );
}
