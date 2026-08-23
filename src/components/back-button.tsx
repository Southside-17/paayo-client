import { router } from 'expo-router';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import { useColorScheme } from 'nativewind';
import { Pressable } from 'react-native';

import { Text } from '@/components/ui/text';
import palette from '@/theme/palette';

type Props = { label: string };

/**
 * The way back up a browse hierarchy, naming where it goes.
 */
export function BackButton({ label }: Props) {
    const { colorScheme } = useColorScheme();
    const colours = palette[colorScheme ?? 'light'];

    return (
        <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            className="-ml-1 flex-row items-center gap-1 self-start py-1"
        >
            <ChevronLeft color={colours.brand} size={20} />
            <Text className="text-brand text-[15px]">{label}</Text>
        </Pressable>
    );
}
