import { useColorScheme } from 'nativewind';
import type { ComponentType, ReactNode } from 'react';
import { Pressable } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import palette from '@/theme/palette';

type Props = {
    icon?: ComponentType<{ color: string; size: number }>;
    children: string;
    /** Sits at the right of the row: a check, a hint, a badge. */
    trailing?: ReactNode;
    tone?: 'default' | 'destructive' | 'quiet';
    selected?: boolean;
    disabled?: boolean;
    onPress?: () => void;
};

/**
 * One choice inside a sheet.
 */
export function SheetAction({
    icon: Icon,
    children,
    trailing,
    tone = 'default',
    selected = false,
    disabled = false,
    onPress,
}: Props) {
    const { colorScheme } = useColorScheme();
    const colours = palette[colorScheme ?? 'light'];

    const ink =
        tone === 'destructive'
            ? colours.destructive
            : selected
              ? colours.brand
              : colours['muted-foreground'];

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected, disabled }}
            disabled={disabled || !onPress}
            onPress={onPress}
            className={cn(
                'flex-row items-center gap-3 rounded-xl px-3 py-3',
                tone === 'quiet' ? 'bg-transparent' : 'bg-muted',
                selected && 'bg-brand-subtle',
                disabled && 'opacity-40',
            )}
        >
            {Icon ? <Icon color={ink} size={18} /> : null}

            <Text
                className={cn(
                    'flex-1 text-sm font-semibold',
                    tone === 'destructive' && 'text-destructive',
                    selected && 'text-brand',
                    tone === 'quiet' && 'text-muted-foreground text-center',
                )}
                numberOfLines={1}
            >
                {children}
            </Text>

            {trailing}
        </Pressable>
    );
}
