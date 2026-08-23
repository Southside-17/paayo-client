import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import type { Address } from '@/lib/types';
import { cn } from '@/lib/utils';

type Props = {
    open: boolean;
    addresses: Address[];
    selected: Address | null;
    onSelect: (address: Address) => void;
    onDismiss: () => void;
};

/**
 * Which of the saved addresses work should be sent to.
 */
export function AddressSheet({ open, addresses, selected, onSelect, onDismiss }: Props) {
    const manage = () => {
        onDismiss();
        router.push({ pathname: '/profile/addresses', params: { from: 'Home' } });
    };

    return (
        <Sheet open={open} onDismiss={onDismiss} label="Where should work happen?">
            <Text className="text-lg font-bold">Where should work happen?</Text>

            <ScrollView contentContainerClassName="gap-2">
                {addresses.length === 0 ? (
                    <Text className="text-muted-foreground text-sm">No addresses saved yet.</Text>
                ) : null}

                {addresses.map((address) => (
                    <AddressRow
                        key={address.id}
                        address={address}
                        selected={address.id === selected?.id}
                        onSelect={onSelect}
                    />
                ))}
            </ScrollView>

            <Pressable
                accessibilityRole="button"
                onPress={manage}
                className="border-border flex-row items-center justify-between border-t pt-4"
            >
                <Text className="font-medium">Manage addresses</Text>
                <Text className="text-brand text-sm font-semibold">Open</Text>
            </Pressable>
        </Sheet>
    );
}

/**
 * One address to choose, or one that cannot be chosen yet.
 */
function AddressRow({
    address,
    selected,
    onSelect,
}: {
    address: Address;
    selected: boolean;
    onSelect: (address: Address) => void;
}) {
    const pinned = address.latitude !== null;

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected, disabled: !pinned }}
            disabled={!pinned}
            onPress={() => onSelect(address)}
            className={cn(
                'flex-row items-start gap-3 rounded-xl border p-4',
                selected ? 'border-brand bg-brand-subtle' : 'border-border',
                !pinned && 'opacity-50',
            )}
        >
            <View
                className={cn(
                    'mt-0.5 size-4 rounded-full border-2',
                    selected ? 'border-brand bg-brand' : 'border-border',
                )}
            />

            <View className="flex-1 gap-1">
                <View className="flex-row items-center gap-2">
                    <Text className="font-semibold">{address.label}</Text>
                    {address.is_default ? <Badge>Default</Badge> : null}
                </View>

                <Text className="text-muted-foreground text-sm">{address.line}</Text>

                {pinned ? null : (
                    <Text className="text-warning text-sm">
                        Needs a pin before anyone can be sent to it.
                    </Text>
                )}
            </View>
        </Pressable>
    );
}
