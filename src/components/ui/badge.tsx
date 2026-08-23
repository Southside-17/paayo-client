import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { TONES, type Tone } from '@/components/ui/tone';
import { cn } from '@/lib/utils';

type Props = { tone?: Tone; dot?: boolean; children: string; className?: string };

/**
 * A quiet label on a row: smaller than a status pill, and silent by default.
 */
export function Badge({ tone = 'neutral', dot = false, children, className }: Props) {
    const tokens = TONES[tone];

    return (
        <View
            className={cn(
                'flex-row items-center gap-1 self-start rounded-full px-2 py-0.5',
                tokens.fill,
                className,
            )}
        >
            {dot ? <View testID="badge-dot" className={cn('size-1 rounded-full', tokens.dot)} /> : null}
            <Text className={cn('text-[11px] font-medium', tokens.ink)}>{children}</Text>
        </View>
    );
}
