import { Stack } from 'expo-router';

/** Login is the root of this stack, so every other screen here sits over it. */
export const unstable_settings = { initialRouteName: 'login' };

export default function AuthLayout() {
    return <Stack screenOptions={{ headerShown: false }} />;
}
