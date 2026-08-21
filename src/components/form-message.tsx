import { View } from 'react-native';

import { Text } from '@/components/ui/text';

type Props = { message: string | null; tone?: 'error' | 'success' };

/** A whole-form message: a refusal the fields cannot explain, or a confirmation. */
export function FormMessage({ message, tone = 'error' }: Props) {
    if (!message) {
        return null;
    }

    return (
        <View className={tone === 'error' ? 'bg-destructive-subtle rounded-lg p-3' : 'bg-success-subtle rounded-lg p-3'}>
            <Text className={tone === 'error' ? 'text-destructive text-sm' : 'text-success text-sm'}>
                {message}
            </Text>
        </View>
    );
}
