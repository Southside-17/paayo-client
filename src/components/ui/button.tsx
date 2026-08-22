import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, type PressableProps } from 'react-native';

import { cn } from '@/lib/utils';
import { Text } from './text';

const button = cva('h-12 flex-row items-center justify-center gap-2 rounded-lg px-4', {
    variants: {
        variant: {
            primary: 'bg-primary',
            brand: 'bg-brand',
            outline: 'border-input bg-card border',
            ghost: 'bg-transparent',
            destructive: 'bg-destructive',
        },
    },
    defaultVariants: { variant: 'primary' },
});

const label = cva('text-base font-semibold', {
    variants: {
        variant: {
            primary: 'text-primary-foreground',
            brand: 'text-brand-foreground',
            outline: 'text-foreground',
            ghost: 'text-foreground',
            destructive: 'text-destructive-foreground',
        },
    },
    defaultVariants: { variant: 'primary' },
});

type Props = Omit<PressableProps, 'children'> &
    VariantProps<typeof button> & {
        children: string;
        className?: string;
        busy?: boolean;
        icon?: ReactNode;
    };

export function Button({ children, className, variant, busy, icon, disabled, ...props }: Props) {
    const inactive = disabled || busy;

    return (
        <Pressable
            accessibilityRole="button"
            disabled={inactive}
            className={cn(button({ variant }), inactive && 'opacity-60', className)}
            {...props}
        >
            {busy ? <ActivityIndicator size="small" /> : icon}
            <Text className={label({ variant })}>{children}</Text>
        </Pressable>
    );
}
