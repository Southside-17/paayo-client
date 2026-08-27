import { useColorScheme } from 'nativewind';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { BrandIcon } from '@/components/brand-icon';
import { Card } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import type { SocialProvider } from '@/lib/providers';
import type { Social } from '@/lib/types';
import palette from '@/theme/palette';

type Props = { provider: SocialProvider; social: Social | null; children?: ReactNode };

/**
 * One way in, and whether this account uses it.
 */
export function SocialCard({ provider, social, children }: Props) {
    const { colorScheme } = useColorScheme();
    const colours = palette[colorScheme ?? 'light'];

    return (
        <Card className="gap-3">
            <View className="flex-row items-center gap-3">
                <BrandIcon brand={provider.brand} color={colours.foreground} size={20} />

                <View className="flex-1">
                    <Text className="font-medium">{provider.label}</Text>
                    {social?.email ? (
                        <Text className="text-muted-foreground text-xs">{social.email}</Text>
                    ) : null}
                </View>

                <StatusPill tone={social ? 'success' : 'neutral'}>
                    {social ? 'linked' : 'not linked'}
                </StatusPill>
            </View>

            {children}
        </Card>
    );
}
