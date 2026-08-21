import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { SessionProvider, useSession } from '@/lib/session';

import '../global.css';

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
    return (
        <SessionProvider>
            <RootNavigator />
        </SessionProvider>
    );
}
