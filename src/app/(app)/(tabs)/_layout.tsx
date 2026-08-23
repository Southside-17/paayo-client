import { Tabs } from 'expo-router';
import CircleUser from 'lucide-react-native/icons/circle-user';
import House from 'lucide-react-native/icons/house';
import ListChecks from 'lucide-react-native/icons/list-checks';
import { useColorScheme } from 'nativewind';

import { useSession } from '@/lib/session';
import palette from '@/theme/palette';

/**
 * The signed-in shell: one tab bar over the client's three areas.
 */
export default function TabsLayout() {
    const { colorScheme } = useColorScheme();
    const colours = palette[colorScheme ?? 'light'];
    const session = useSession();

    const owed =
        session.status === 'authenticated' ? (session.user.bookings_needing_provider ?? 0) : 0;

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
                name="index"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ color, size }) => <House color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="bookings"
                options={{
                    title: 'Bookings',
                    tabBarIcon: ({ color, size }) => <ListChecks color={color} size={size} />,
                    tabBarBadge: owed > 0 ? owed : undefined,
                    tabBarBadgeStyle: {
                        backgroundColor: colours.brand,
                        color: colours.background,
                        fontFamily: 'Urbanist',
                        fontSize: 11,
                    },
                }}
            />
            <Tabs.Screen
                name="account"
                options={{
                    title: 'Account',
                    tabBarIcon: ({ color, size }) => <CircleUser color={color} size={size} />,
                }}
            />
        </Tabs>
    );
}
