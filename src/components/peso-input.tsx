import { View } from 'react-native';

import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

type Props = {
    /** Centavos, or null when the field is empty. */
    value: number | null;
    onChange: (value: number | null) => void;
    disabled?: boolean;
    invalid?: boolean;
    accessibilityLabel: string;
    placeholder?: string;
};

/**
 * Money in, as pesos on screen and centavos in state.
 *
 * inputMode rather than a numeric keyboard type, and no min or step: the same
 * rule the console's form-constraint test enforces, so a stubborn keyboard
 * cannot leave somebody unable to type their own price.
 */
export function PesoInput({
    value,
    onChange,
    disabled = false,
    invalid = false,
    accessibilityLabel,
    placeholder = '0',
}: Props) {
    const shown = value === null ? '' : String(value / 100);

    return (
        <View className="relative justify-center">
            <Text
                className={cn(
                    'text-muted-foreground absolute left-3.5 z-10 text-base',
                    disabled && 'opacity-50',
                )}
            >
                ₱
            </Text>
            <Input
                value={shown}
                onChangeText={(text) => {
                    const digits = text.replace(/[^0-9]/g, '');

                    onChange(digits === '' ? null : Number(digits) * 100);
                }}
                inputMode="numeric"
                editable={!disabled}
                invalid={invalid}
                placeholder={placeholder}
                accessibilityLabel={accessibilityLabel}
                className="pl-8"
            />
        </View>
    );
}
