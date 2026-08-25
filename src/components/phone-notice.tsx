import MessageSquareOff from 'lucide-react-native/icons/message-square-off';
import { useColorScheme } from 'nativewind';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import palette from '@/theme/palette';

/**
 * What a client is told when the arrival text cannot reach their number.
 */
export function PhoneNotice({ onConfirm }: { onConfirm: () => void }) {
    const { colorScheme } = useColorScheme();
    const colours = palette[colorScheme ?? 'light'];

    return (
        <Pressable
            accessibilityRole="button"
            onPress={onConfirm}
            className="border-warning bg-warning-subtle flex-row items-start gap-3 rounded-xl border p-4"
        >
            <MessageSquareOff color={colours.warning} size={18} />

            <View className="flex-1 gap-1">
                <Text className="text-warning font-semibold">
                    We cannot text you when the crew arrives
                </Text>
                <Text className="text-sm">
                    Your number is not confirmed, so the arrival text will not reach you. The app
                    will still show it. Tap to confirm your number.
                </Text>
            </View>
        </Pressable>
    );
}
