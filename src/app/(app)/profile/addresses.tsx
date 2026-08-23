import { BackButton } from '@/components/back-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormMessage } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useAddresses } from '@/lib/addresses';
import { useSession } from '@/lib/session';
import type { Address } from '@/lib/types';
import { useSubmit } from '@/lib/use-submit';

/**
 * The addresses on the account, default first.
 */
export default function Addresses() {
    const { from } = useLocalSearchParams<{ from?: string }>();
    const session = useSession();
    const { busy, message, submit } = useSubmit();
    const { addresses, address: selected, ready, reload } = useAddresses();

    useFocusEffect(
        useCallback(() => {
            void submit(reload);
        }, [reload, submit]),
    );

    if (session.status !== 'authenticated') {
        return null;
    }

    const remove = (address: Address) =>
        submit(async () => {
            await session.authenticatedRequest<void>(`/addresses/${address.id}`, {
                method: 'DELETE',
            });

            await reload();
        });

    return (
        <SafeAreaView className="bg-background flex-1">
            <ScrollView contentContainerClassName="gap-4 p-6">
                <BackButton label={from ?? 'Account'} />
                <ScreenHeader title="Addresses" />

                <Text className="text-muted-foreground text-sm">
                    Where you want work done. This is separate from the address on a verified ID.
                </Text>

                <FormMessage message={message} />

                <Button variant="brand" onPress={() => router.push('/profile/address')}>
                    Add an address
                </Button>

                {ready && addresses.length === 0 ? (
                    <Card>
                        <Text className="text-muted-foreground text-sm">
                            No addresses saved yet.
                        </Text>
                    </Card>
                ) : null}

                {addresses.map((address) => (
                    <Card key={address.id} className="gap-2">
                        <View className="flex-row items-center gap-2">
                            <Text className="font-semibold">{address.label}</Text>
                            {address.id === selected?.id ? (
                                <Text className="text-brand text-xs font-medium">Selected</Text>
                            ) : null}
                            {address.is_default ? (
                                <Text className="text-muted-foreground text-xs font-medium">
                                    Default
                                </Text>
                            ) : null}
                            {address.latitude !== null ? (
                                <Text className="text-success text-xs font-medium">Pinned</Text>
                            ) : null}
                        </View>

                        <Text className="text-muted-foreground text-sm">{address.line}</Text>

                        {address.latitude === null ? (
                            <Text className="text-warning text-sm">
                                Without a pin, no provider can be matched to this address.
                            </Text>
                        ) : null}

                        <View className="flex-row gap-2">
                            <Button
                                variant="outline"
                                onPress={() =>
                                    router.push({
                                        pathname: '/profile/address',
                                        params: { id: address.id },
                                    })
                                }
                            >
                                Edit
                            </Button>
                            <Button variant="ghost" onPress={() => remove(address)} busy={busy}>
                                Remove
                            </Button>
                        </View>
                    </Card>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}
