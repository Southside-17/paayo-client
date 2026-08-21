import { forwardRef } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

import { cn } from '@/lib/utils';

type Props = TextInputProps & { className?: string; invalid?: boolean };

export const Input = forwardRef<TextInput, Props>(function Input(
    { className, invalid, ...props },
    ref,
) {
    return (
        <TextInput
            ref={ref}
            className={cn(
                'bg-card text-foreground placeholder:text-muted-foreground h-12 rounded-lg border px-3.5 text-base',
                invalid ? 'border-destructive' : 'border-input',
                className,
            )}
            {...props}
        />
    );
});
