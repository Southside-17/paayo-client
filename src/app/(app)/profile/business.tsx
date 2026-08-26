import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { FormMessage } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { KeyboardAvoiding } from '@/components/ui/keyboard-avoiding';
import { Label } from '@/components/ui/label';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { useSession } from '@/lib/session';
import type { Staff } from '@/lib/types';
import { useSubmit } from '@/lib/use-submit';

/**
 * Opening a business, with the account that opened it as its first owner.
 */
export default function RegisterBusiness() {
    const session = useSession();
    const { busy, message, errorFor, submit } = useSubmit();
    const [name, setName] = useState('');

    if (session.status !== 'authenticated') {
        return null;
    }

    const verified = session.user.identification_verified;

    const open = () =>
        submit(async () => {
            await session.authenticatedRequest<{ data: Staff }>('/providers', {
                method: 'POST',
                body: { name: name.trim() },
            });

            await session.reload();

            router.back();
        });

    return (
        <SafeAreaView className="bg-background flex-1">
            <KeyboardAvoiding className="flex-1">
                <ScrollView
                    contentContainerClassName="gap-6 p-6"
                    keyboardShouldPersistTaps="handled"
                >
                    <BackButton label="Account" />
                    <ScreenHeader title="Register a business" />

                    <FormMessage message={message} />

                    {verified ? null : (
                        <Card className="border-warning/40 bg-warning-subtle gap-1">
                            <Text className="font-semibold">Verify your identity first</Text>
                            <Text className="text-muted-foreground text-sm leading-5">
                                A business takes money and sends people into homes, so the person
                                behind it has to be somebody we have checked.
                            </Text>
                            <Button
                                variant="outline"
                                className="mt-2"
                                onPress={() => router.push('/profile/identification')}
                            >
                                Verify my identity
                            </Button>
                        </Card>
                    )}

                    <Card className="gap-3">
                        <Text className="font-medium">Trading name</Text>
                        <Text className="text-muted-foreground text-sm leading-5">
                            What clients see. The registered name goes on the papers afterwards, and
                            the two are often not the same.
                        </Text>

                        <View>
                            <Label>Name</Label>
                            <Input
                                value={name}
                                onChangeText={setName}
                                placeholder="Santos Electrical"
                                invalid={Boolean(errorFor('name'))}
                            />
                            <FieldError message={errorFor('name')} />
                        </View>
                    </Card>

                    <Text className="text-muted-foreground text-sm leading-5">
                        You will be its owner. Nothing can be booked until Paayo puts it in a market
                        and its papers are checked.
                    </Text>

                    <Button onPress={open} busy={busy} disabled={!verified}>
                        Register the business
                    </Button>
                </ScrollView>
            </KeyboardAvoiding>
        </SafeAreaView>
    );
}
