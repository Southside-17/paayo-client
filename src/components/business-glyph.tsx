import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

/**
 * A business's initials, standing in for a logo nobody has uploaded.
 */
export function BusinessGlyph({ name, size = 30 }: { name: string; size?: number }) {
    const initials = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0])
        .join('')
        .toUpperCase();

    return (
        <View
            className={cn('bg-brand-subtle items-center justify-center rounded-lg')}
            style={{ width: size, height: size, borderRadius: Math.round(size / 3.4) }}
        >
            <Text className="text-brand font-bold" style={{ fontSize: Math.round(size / 2.6) }}>
                {initials}
            </Text>
        </View>
    );
}
