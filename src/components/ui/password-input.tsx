import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import { useColorScheme } from 'nativewind';
import { forwardRef, useState } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { cn } from '@/lib/utils';
import palette from '@/theme/palette';
import { Input } from './input';

type Props = Omit<TextInputProps, 'secureTextEntry' | 'autoCorrect' | 'spellCheck'> & {
    className?: string;
    invalid?: boolean;
};

/** A password field with a reveal toggle, for typing a long password on a phone. */
export const PasswordInput = forwardRef<TextInput, Props>(function PasswordInput(
    { className, ...props },
    ref,
) {
    const { colorScheme } = useColorScheme();
    const [revealed, setRevealed] = useState(false);
    const Icon = revealed ? EyeOff : Eye;

    return (
        <View>
            <Input
                ref={ref}
                secureTextEntry={!revealed}
                autoCorrect={false}
                spellCheck={false}
                className={cn('pr-12', className)}
                {...props}
            />
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
                hitSlop={8}
                onPress={() => setRevealed((shown) => !shown)}
                className="absolute bottom-0 right-0 top-0 justify-center px-3.5"
            >
                <Icon
                    size={20}
                    color={palette[colorScheme === 'dark' ? 'dark' : 'light']['muted-foreground']}
                />
            </Pressable>
        </View>
    );
});
