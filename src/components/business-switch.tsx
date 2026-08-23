import { Link } from 'expo-router';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Store from 'lucide-react-native/icons/store';
import { useColorScheme } from 'nativewind';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { Staff } from '@/lib/types';
import palette from '@/theme/palette';

/**
 * The way from the personal account into a business, on the Account screen.
 */
export function BusinessSwitch({ businesses }: { businesses: Staff[] }) {
    const { colorScheme } = useColorScheme();
    const colours = palette[colorScheme ?? 'light'];

    if (businesses.length === 0) {
        return null;
    }

    const only = businesses.length === 1 ? businesses[0].provider.name : null;

    return (
        <Link href={{ pathname: '/switch', params: { from: 'Account' } }} asChild>
            <Pressable
                accessibilityRole="button"
                className="border-border bg-card flex-row items-center gap-3.5 rounded-xl border px-4 py-3.5"
            >
                <Store color={colours.brand} size={19} />

                <View className="flex-1 gap-0.5">
                    <Text className="text-[15px] font-medium">
                        {only ? `Switch to ${only}` : 'Switch to a business'}
                    </Text>
                    <Text className="text-muted-foreground text-xs">
                        {only ? 'See the work booked with them' : `${businesses.length} businesses`}
                    </Text>
                </View>

                <ChevronRight color={colours['muted-foreground']} size={17} />
            </Pressable>
        </Link>
    );
}
