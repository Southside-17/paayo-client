import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { ActivityIndicator, LogBox, View } from 'react-native';

import { SessionProvider, useSession } from '@/lib/session';
import { WorkspaceProvider } from '@/lib/workspace';
import palette from '@/theme/palette';

import '../global.css';

/**
 * LogBox's notification bar cannot be read in this app, so it is turned off.
 *
 * `LogBoxButton` passes its `style` as a function of the pressed state, and
 * that function is where the dark background lives. NativeWind registers its
 * own interop on React Native's `Pressable` -- LogBox's included -- and the
 * background never lands, so the white container behind it shows through and
 * the white message sits on white. What is left is a blank bar with an amber
 * `!` and a dismiss cross, covering the tab bar and saying nothing.
 *
 * Nothing is lost. Every warning still reaches the Metro terminal and
 * `adb logcat`, which is where they are legible, and React Native's own note on
 * this call is explicit that uncaught errors still open the full screen
 * LogBox -- that one renders correctly and is the one worth interrupting for.
 */
LogBox.ignoreAllLogs();

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
