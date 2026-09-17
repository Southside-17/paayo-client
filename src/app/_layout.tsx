import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { useEffect } from 'react';
import { ActivityIndicator, LogBox, View } from 'react-native';

import { UpdateGate } from '@/components/update-gate';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { request } from '@/lib/api';
import { dropStaleWatch } from '@/lib/geofence';
import { JOB_ACTIONS, registerJobActions } from '@/lib/push';
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
    'job.assigned': (id) => `/job/${id}`,
    'job.enroute': (id) => `/booking/${id}`,
    'job.completed': (id) => `/booking/${id}`,
};

/**
 * Answer an action button, or open the record a tapped notification is about.
 *
 * An action does not navigate. The whole point of it is that the crew never
 * open the app: pressing "I'm on my way" on a lock screen and being dropped
 * into a screen would undo the saving.
 *
 * The geofence is deliberately not armed from here. It needs the address's
 * exact pin, and a push travels through Apple or Google -- putting a client's
 * doorstep in one to save a tap is not a trade worth making. Arming happens the
 * next time the job screen is opened.
 */
function useNotificationTaps(token: string | null) {
    useEffect(() => {
        void registerJobActions();
    }, []);

    useEffect(() => {
        const listener = Notifications.addNotificationResponseReceivedListener((response) => {
            const data = response.notification.request.content.data as Record<string, unknown>;
            const step = JOB_ACTIONS[response.actionIdentifier];

            if (step && token && typeof data.job_id === 'string') {
                void request<void>(
                    `/providers/${String(data.provider_id)}/jobs/${data.job_id}/${step}`,
                    { method: 'POST', body: {}, token },
                ).catch(() => {
                    // No signal on a job site is ordinary. The button on the
                    // screen is still there, which is why it never goes away.
                });

                return;
            }

            const destination = DESTINATIONS[String(data.type)];

            if (destination && typeof data.booking_id === 'string') {
                router.push(destination(data.booking_id) as never);
            }
        });

        return () => listener.remove();
    }, [token]);
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

    const token = session.status === 'authenticated' ? (session.token ?? null) : null;

    useNotificationTaps(token);

    // A fence left armed by a launch that ended -- a job finished from another
    // phone, say -- is dropped once there is a token to ask the server with.
    useEffect(() => {
        if (token !== null) {
            void dropStaleWatch(token);
        }
    }, [token]);

    if (session.status === 'loading') {
        return (
            <View className="bg-background flex-1 items-center justify-center">
                <ActivityIndicator />
            </View>
        );
    }

    if (session.status === 'offline') {
        return (
            <View className="bg-background flex-1 items-center justify-center gap-4 px-8">
                <Text className="text-foreground text-center text-base">
                    Paayo could not be reached. Check your connection and try again.
                </Text>
                <Button variant="outline" onPress={() => void session.retry()}>
                    Try again
                </Button>
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

            <UpdateGate />

            <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        </ThemeProvider>
    );
}
