import { Tabs } from 'expo-router';
import CircleUser from 'lucide-react-native/icons/circle-user';
import House from 'lucide-react-native/icons/house';
import ListChecks from 'lucide-react-native/icons/list-checks';
import { useColorScheme } from 'nativewind';

import palette from '@/theme/palette';

/**
 * The signed-in shell: one tab bar over the client's three areas.
 *
 * React Navigation draws this bar, so it is styled with literals rather than
 * classes -- the same reason the navigation theme in `src/app/_layout.tsx` is.
 * The family has to be named here too: React Native inherits none, and the
 * labels never pass through `ui/text.tsx`.
 */
export default function TabsLayout() {
    const { colorScheme } = useColorScheme();
    const colours = palette[colorScheme ?? 'light'];

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
                name="requests"
                options={{
                    title: 'Requests',
                    tabBarIcon: ({ color, size }) => <ListChecks color={color} size={size} />,
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
