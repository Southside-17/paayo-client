import { BackButton } from '@/components/back-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormMessage } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useSession } from '@/lib/session';
import type { Address } from '@/lib/types';
import { useSubmit } from '@/lib/use-submit';

/**
 * The addresses on the account, default first.
 */
export default function Addresses() {
    // Reached from Account and from Home's address line, so the screen it
    // returns to is carried rather than assumed.
    const { from } = useLocalSearchParams<{ from?: string }>();
    const session = useSession();
    const { busy, message, submit } = useSubmit();
    const [addresses, setAddresses] = useState<Address[] | null>(null);

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;

    const load = useCallback(async () => {
        if (!authenticatedRequest) {
            return;
        }

        const { data } = await authenticatedRequest<{ data: Address[] }>('/addresses');

        setAddresses(data);
    }, [authenticatedRequest]);

    // Re-read on focus: the form is a separate screen, so returning from it is
    // the only signal that the list has changed.
    useFocusEffect(
        useCallback(() => {
            void submit(load);
        }, [load, submit]),
    );

    if (session.status !== 'authenticated') {
        return null;
    }

    const remove = (address: Address) =>
        submit(async () => {
            await session.authenticatedRequest<void>(`/addresses/${address.id}`, {
                method: 'DELETE',
            });

            await load();
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

                {addresses?.length === 0 ? (
                    <Card>
                        <Text className="text-muted-foreground text-sm">
                            No addresses saved yet.
                        </Text>
                    </Card>
                ) : null}

                {addresses?.map((address) => (
                    <Card key={address.id} className="gap-2">
                        <View className="flex-row items-center gap-2">
                            <Text className="font-semibold">{address.label}</Text>
                            {address.is_default ? (
                                <Text className="text-brand text-xs font-medium">Default</Text>
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
