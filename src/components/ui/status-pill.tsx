import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { TONES, type Tone } from '@/components/ui/tone';
import { cn } from '@/lib/utils';

type Props = { tone: Tone; children: string; className?: string };

/**
 * Where a thing stands, said in colour and a dot together.
 */
export function StatusPill({ tone, children, className }: Props) {
    const tokens = TONES[tone];

    return (
        <View
            className={cn(
                'flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1',
                tokens.fill,
                className,
            )}
        >
            <View testID="status-dot" className={cn('size-1.5 rounded-full', tokens.dot)} />
            <Text className={cn('text-xs font-semibold', tokens.ink)}>{children}</Text>
        </View>
    );
}
