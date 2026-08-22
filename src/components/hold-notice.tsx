import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { on } from '@/lib/dates';
import type { SuspensionNotice } from '@/lib/types';

/**
 * What a business is told about the sanction standing against it.
 *
 * The heading follows `punitive`, matching the console and the personal hold:
 * an investigation, a compromised account and a legal order attribute no fault,
 * and calling those a suspension accuses somebody of something.
 */
export function HoldNotice({ suspension }: { suspension: SuspensionNotice | null }) {
    if (!suspension) {
        return null;
    }

    return (
        <View className="border-warning bg-warning-subtle gap-1.5 rounded-xl border p-4">
            <Text className="text-warning font-semibold">
                {suspension.punitive
                    ? 'This business is suspended'
                    : 'This business is on hold'}
            </Text>

            <Text className="text-sm">{suspension.notice}</Text>

            <Text className="text-muted-foreground text-xs">
                {suspension.reason} &middot; since {on(suspension.starts_at)}
                {suspension.ends_at ? ` until ${on(suspension.ends_at)}` : ''}
            </Text>
        </View>
    );
}
