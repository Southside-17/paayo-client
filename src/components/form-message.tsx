import { View } from 'react-native';

import { Text } from '@/components/ui/text';

type Tone = 'error' | 'success' | 'warning';

type Props = { message: string | null; tone?: Tone };

const surface: Record<Tone, string> = {
    error: 'bg-destructive-subtle rounded-lg p-3',
    success: 'bg-success-subtle rounded-lg p-3',
    warning: 'bg-warning-subtle rounded-lg p-3',
};

const wording: Record<Tone, string> = {
    error: 'text-destructive text-sm',
    success: 'text-success text-sm',
    warning: 'text-warning text-sm',
};

/**
 * A whole-form message: a refusal the fields cannot explain, a confirmation, or
 * a state worth naming that is neither -- an answer that was read and was not
 * the one hoped for.
 */
export function FormMessage({ message, tone = 'error' }: Props) {
    if (!message) {
        return null;
    }

    return (
        <View className={surface[tone]}>
            <Text className={wording[tone]}>{message}</Text>
        </View>
    );
}
