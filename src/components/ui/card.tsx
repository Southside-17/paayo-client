import type { ReactNode } from 'react';
import { View } from 'react-native';

import { cn } from '@/lib/utils';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <View className={cn('bg-card border-border rounded-xl border p-4', className)}>
            {children}
        </View>
    );
}
