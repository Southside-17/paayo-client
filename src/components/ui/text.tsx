import { Text as RNText, type TextProps } from 'react-native';

import { cn } from '@/lib/utils';

/**
 * Every piece of text in the app. React Native does not inherit a family, so
 * this is where Urbanist reaches the screen, and tabular figures with it --
 * the console sets the same on body.
 */
export function Text({ className, style, ...props }: TextProps & { className?: string }) {
    return (
        <RNText
            className={cn('text-foreground font-sans text-base', className)}
            style={[{ fontVariant: ['tabular-nums'] }, style]}
            {...props}
        />
    );
}
