import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormMessage } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useSession } from '@/lib/session';
import type { MessageResponse } from '@/lib/types';
import { useSubmit } from '@/lib/use-submit';

/**
 * Edit the three things a person is allowed to type about themselves.
 */
export default function EditProfile() {
    const session = useSession();
    const { busy, message, errorFor, submit } = useSubmit();

    const current = session.status === 'authenticated' ? session.user : null;
    const [nickname, setNickname] = useState(current?.nickname ?? '');
    const [email, setEmail] = useState(current?.email ?? '');
    const [phone, setPhone] = useState(current?.phone ?? '');

    if (session.status !== 'authenticated') {
        return null;
    }

    const save = () =>
        submit(async () => {
            await session.authenticatedRequest<MessageResponse>('/auth/profile', {
                method: 'PUT',
                body: {
                    nickname: nickname.trim(),
                    email: email.trim(),
                    phone: phone.trim() === '' ? null : phone.trim(),
                },
            });

            await session.reload();
            router.back();
        });

    return (
        <SafeAreaView className="bg-background flex-1">
            <KeyboardAvoidingView
                className="flex-1"
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView contentContainerClassName="gap-6 p-6" keyboardShouldPersistTaps="handled">
                    <View className="flex-row items-center justify-between">
                        <Text className="text-2xl font-bold">Edit details</Text>
                        <Button variant="ghost" onPress={() => router.back()}>
                            Cancel
                        </Button>
                    </View>

                    <FormMessage message={message} />

                    <Card className="gap-3">
                        <View>
                            <Label>Nickname</Label>
                            <Input
                                value={nickname}
                                onChangeText={setNickname}
                                autoComplete="nickname"
                                placeholder="What you go by"
                                invalid={Boolean(errorFor('nickname'))}
                            />
                            <FieldError message={errorFor('nickname')} />
                        </View>

                        {session.user.fullname ? (
                            <View>
                                <Label>Legal name</Label>
                                <Text className="text-sm">{session.user.fullname}</Text>
                                <Text className="text-muted-foreground mt-1.5 text-sm">
                                    Your legal name comes from a verified identification and cannot
                                    be typed here.
                                </Text>
                            </View>
                        ) : null}

                        <View>
                            <Label>Email address</Label>
                            <Input
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                autoComplete="email"
                                keyboardType="email-address"
                                invalid={Boolean(errorFor('email'))}
                            />
                            <FieldError message={errorFor('email')} />
                            <Text className="text-muted-foreground mt-1.5 text-sm">
                                Changing this clears the confirmation and sends a new email.
                            </Text>
                        </View>

                        <View>
                            <Label>Phone</Label>
                            <Input
                                value={phone}
                                onChangeText={setPhone}
                                autoComplete="tel"
                                keyboardType="phone-pad"
                                placeholder="+63 917 555 0101"
                                invalid={Boolean(errorFor('phone'))}
                            />
                            <FieldError message={errorFor('phone')} />
                        </View>

                        <Button onPress={save} busy={busy}>
                            Save changes
                        </Button>
                    </Card>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
