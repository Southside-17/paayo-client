import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { ActivityIndicator, View } from 'react-native';

import { SessionProvider, useSession } from '@/lib/session';
import palette from '@/theme/palette';

import '../global.css';

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
                <RootNavigator />
            </SessionProvider>

            <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        </ThemeProvider>
    );
}
