import BellOff from 'lucide-react-native/icons/bell-off';
import { useColorScheme } from 'nativewind';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import palette from '@/theme/palette';

/**
 * What a business is told when its phone cannot be reached about new work.
 */
export function NotifyNotice({ onAsk }: { onAsk: () => void }) {
    const { colorScheme } = useColorScheme();
    const colours = palette[colorScheme ?? 'light'];

    return (
        <Pressable
            accessibilityRole="button"
            onPress={onAsk}
            className="border-warning bg-warning-subtle flex-row items-start gap-3 rounded-xl border p-4"
        >
            <BellOff color={colours.warning} size={18} />

            <View className="flex-1 gap-1">
                <Text className="text-warning font-semibold">
                    You will not hear about new jobs
                </Text>
                <Text className="text-sm">
                    Notifications are off for Paayo, so a job only appears when you open this
                    screen. Tap to turn them on.
                </Text>
            </View>
        </Pressable>
    );
}
