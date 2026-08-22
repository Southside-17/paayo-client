import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';

type Props = { title: string; eyebrow?: string; children?: ReactNode };

/**
 * The block every screen opens with: an optional eyebrow, the title, and a
 * trailing slot for the one control that belongs beside it.
 */
export function ScreenHeader({ title, eyebrow, children }: Props) {
    return (
        <View className="flex-row items-end gap-3">
            <View className="flex-1 gap-0.5">
                {eyebrow ? (
                    <Text className="text-muted-foreground text-xs font-medium">{eyebrow}</Text>
                ) : null}
                <Text className="tracking-display text-[26px] font-bold">{title}</Text>
            </View>
            {children}
        </View>
    );
}
