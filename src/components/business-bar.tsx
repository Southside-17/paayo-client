import { Link } from 'expo-router';
import ChevronsUpDown from 'lucide-react-native/icons/chevrons-up-down';
import Store from 'lucide-react-native/icons/store';
import { useColorScheme } from 'nativewind';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useWorkspace } from '@/lib/workspace';
import palette from '@/theme/palette';

/**
 * The business being acted as, and the way back out of it.
 *
 * Every provider screen opens with this, so which side of the app you are on is
 * never a thing you have to remember.
 */
export function BusinessBar({ from }: { from: string }) {
    const { staff } = useWorkspace();
    const { colorScheme } = useColorScheme();
    const colours = palette[colorScheme ?? 'light'];

    if (!staff) {
        return null;
    }

    return (
        <Link href={{ pathname: '/switch', params: { from } }} asChild>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Acting as ${staff.provider.name}. Switch.`}
                className="border-border bg-card flex-row items-center gap-3 rounded-xl border px-4 py-3"
            >
                <Store color={colours.brand} size={19} />

                <View className="flex-1 gap-0.5">
                    <Text className="text-[15px] font-semibold">{staff.provider.name}</Text>
                    <Text className="text-muted-foreground text-xs">{staff.role_label}</Text>
                </View>

                <ChevronsUpDown color={colours['muted-foreground']} size={17} />
            </Pressable>
        </Link>
    );
}
