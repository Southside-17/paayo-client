import { Pressable, View } from 'react-native';

import { cn } from '@/lib/utils';

type Props = {
    value: boolean;
    onValueChange: (value: boolean) => void;
    disabled?: boolean;
    accessibilityLabel: string;
};

/**
 * A two-state control, for a setting that reads as on or off.
 *
 * Built rather than borrowed because React Native's own Switch takes platform
 * colours and ignores the theme tokens every other control here honours.
 */
export function Switch({ value, onValueChange, disabled = false, accessibilityLabel }: Props) {
    return (
        <Pressable
            accessibilityRole="switch"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ checked: value, disabled }}
            disabled={disabled}
            onPress={() => onValueChange(!value)}
            className={cn(
                'h-7 w-12 justify-center rounded-full px-0.5',
                value ? 'bg-brand' : 'bg-input',
                disabled && 'opacity-50',
            )}
        >
            <View
                className={cn(
                    'bg-card size-6 rounded-full',
                    value ? 'self-end' : 'self-start',
                )}
            />
        </Pressable>
    );
}
