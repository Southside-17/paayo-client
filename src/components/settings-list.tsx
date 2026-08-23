import { Link, type Href } from 'expo-router';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { useColorScheme } from 'nativewind';
import type { ComponentType } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import palette from '@/theme/palette';

type Glyph = ComponentType<{ color: string; size: number }>;

export type SettingsRow = { icon: Glyph; label: string; note?: string; href: Href };

type Props = { rows: SettingsRow[]; className?: string };

/**
 * The account's sections as one hairline-divided card of rows.
 */
export function SettingsList({ rows, className }: Props) {
    const { colorScheme } = useColorScheme();
    const colours = palette[colorScheme ?? 'light'];

    return (
        <View className={cn('bg-card border-border overflow-hidden rounded-xl border', className)}>
            {rows.map((row, at) => (
                <Link key={row.label} href={row.href} asChild>
                    <Pressable
                        accessibilityRole="button"
                        className={cn(
                            'flex-row items-center gap-3.5 px-4 py-3.5',
                            at > 0 && 'border-border border-t',
                        )}
                    >
                        <row.icon color={colours.brand} size={19} />
                        <View className="flex-1 gap-0.5">
                            <Text className="text-[15px] font-medium">{row.label}</Text>
                            {row.note ? (
                                <Text className="text-muted-foreground text-xs">{row.note}</Text>
                            ) : null}
                        </View>
                        <ChevronRight color={colours['muted-foreground']} size={17} />
                    </Pressable>
                </Link>
            ))}
        </View>
    );
}
