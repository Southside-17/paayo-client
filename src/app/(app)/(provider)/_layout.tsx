import { Redirect, Tabs } from 'expo-router';
import ClipboardList from 'lucide-react-native/icons/clipboard-list';
import Store from 'lucide-react-native/icons/store';
import Wrench from 'lucide-react-native/icons/wrench';
import { useColorScheme } from 'nativewind';

import { useWorkspace } from '@/lib/workspace';
import palette from '@/theme/palette';

/**
 * The business side of the app, behind the same gates the personal side is.
 *
 * Every tab is gated on its own permission rather than the layout branching on
 * one of them. It used to fall back to a bare Stack for anybody without
 * `booking:view`, which left a technician with no screens at all -- and now
 * that they hold `job:work` they have the one screen the role exists for.
 * `href: null` keeps a tab routable but off the bar, so a link into it still
 * works for whoever may read it.
 */
export default function ProviderLayout() {
    const { staff } = useWorkspace();
    const { colorScheme } = useColorScheme();
    const colours = palette[colorScheme ?? 'light'];

    if (!staff) {
        return <Redirect href="/" />;
    }

    // Business is on the bar for everybody: asking to leave is deliberately not
    // a permission, so every role has at least that one screen and there is no
    // roster left that gets no tab bar at all.
    const mayWork = staff.permissions.includes('job:work');
    const mayReadListings = staff.permissions.includes('listing:view');

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
                    href: mayWork ? undefined : null,
                    tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="services"
                options={{
                    title: 'Services',
                    href: mayReadListings ? undefined : null,
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
            <Tabs.Screen name="registration" options={{ href: null }} />
        </Tabs>
    );
}
