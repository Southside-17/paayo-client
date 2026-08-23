import { Redirect, Stack, Tabs } from 'expo-router';
import ClipboardList from 'lucide-react-native/icons/clipboard-list';
import Store from 'lucide-react-native/icons/store';
import Wrench from 'lucide-react-native/icons/wrench';
import { useColorScheme } from 'nativewind';

import { useWorkspace } from '@/lib/workspace';
import palette from '@/theme/palette';

/**
 * The business side of the app, behind the same gates the personal side is.
 *
 * A technician carries no permissions, so there is nothing to put in a tab bar
 * -- one tab is a title with furniture around it. They get a plain stack over
 * the single screen that names the business.
 */
export default function ProviderLayout() {
    const { staff } = useWorkspace();
    const { colorScheme } = useColorScheme();
    const colours = palette[colorScheme ?? 'light'];

    if (!staff) {
        return <Redirect href="/" />;
    }

    if (!staff.permissions.includes('booking:view')) {
        return <Stack screenOptions={{ headerShown: false }} />;
    }

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: colours.brand,
                tabBarInactiveTintColor: colours['muted-foreground'],
                tabBarStyle: {
                    backgroundColor: colours.card,
                    borderTopColor: colours.border,
                },
                tabBarLabelStyle: { fontFamily: 'Urbanist', fontSize: 11, fontWeight: '600' },
            }}
        >
            <Tabs.Screen
                name="jobs"
                options={{
                    title: 'Jobs',
                    tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="services"
                options={{
                    title: 'Services',
                    tabBarIcon: ({ color, size }) => <Wrench color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="business"
                options={{
                    title: 'Business',
                    tabBarIcon: ({ color, size }) => <Store color={color} size={size} />,
                }}
            />
            <Tabs.Screen name="standing" options={{ href: null }} />
            <Tabs.Screen name="staff" options={{ href: null }} />
        </Tabs>
    );
}
