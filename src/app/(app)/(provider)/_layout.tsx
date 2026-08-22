import { Redirect, Tabs } from 'expo-router';
import ClipboardList from 'lucide-react-native/icons/clipboard-list';
import Store from 'lucide-react-native/icons/store';
import { useColorScheme } from 'nativewind';

import { useWorkspace } from '@/lib/workspace';
import palette from '@/theme/palette';

/**
 * The business side of the app, behind the same gates the personal side is.
 *
 * The redirect is the whole guard: `staff` is looked up in the account on every
 * render, so being taken off a staff empties it and this leaves on its own,
 * without anything having to notice.
 */
export default function ProviderLayout() {
    const { staff } = useWorkspace();
    const { colorScheme } = useColorScheme();
    const colours = palette[colorScheme ?? 'light'];

    if (!staff) {
        return <Redirect href="/" />;
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
                name="business"
                options={{
                    title: 'Business',
                    tabBarIcon: ({ color, size }) => <Store color={color} size={size} />,
                }}
            />
        </Tabs>
    );
}
