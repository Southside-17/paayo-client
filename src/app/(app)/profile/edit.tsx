import { BackButton } from '@/components/back-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KeyboardAvoiding } from '@/components/ui/keyboard-avoiding';

import { FormMessage } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import { useSession } from '@/lib/session';
import type { MessageResponse } from '@/lib/types';
import { useSubmit } from '@/lib/use-submit';

/**
 * Edit the three things a person is allowed to type about themselves.
 */
export default function EditProfile() {
    const { from } = useLocalSearchParams<{ from?: string }>();
    const session = useSession();
    const { busy, message, errorFor, submit } = useSubmit();

    const current = session.status === 'authenticated' ? session.user : null;
    const held = current?.phone ?? '';
    const [nickname, setNickname] = useState(current?.nickname ?? '');
    const [email, setEmail] = useState(current?.email ?? '');
    const [phone, setPhone] = useState(held);

    if (session.status !== 'authenticated') {
        return null;
    }

    const save = () =>
        submit(async () => {
            const typed = phone.trim();

            await session.authenticatedRequest<MessageResponse>('/profile', {
                method: 'PUT',
                body: {
                    nickname: nickname.trim(),
                    email: email.trim(),
                    phone: typed === '' ? null : typed,
                },
            });

            await session.reload();

            // A number that changed has lost its confirmation, so the next step
            // is in front of them rather than two screens away. Replace, not
            // push: this form is finished with, and back belongs where this
            // screen was opened from.
            if (typed !== '' && typed !== held) {
                router.replace({
                    pathname: '/profile/phone',
                    params: { from: from ?? 'Account' },
                });

                return;
            }

            router.back();
        });

    return (
        <SafeAreaView className="bg-background flex-1">
            <KeyboardAvoiding
                className="flex-1"
            >
                <ScrollView contentContainerClassName="gap-6 p-6" keyboardShouldPersistTaps="handled">
                    <BackButton label={from ?? 'Account'} />
                    <ScreenHeader title="Edit details" />

                    <FormMessage message={message} />

                    <Card className="gap-3">
                        <View>
                            <Label>Nickname</Label>
                            <Input
                                value={nickname}
                                onChangeText={setNickname}
                                autoComplete="nickname"
                                placeholder="What you go by"
                                maxLength={12}
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
                            <Text className="text-muted-foreground mt-1.5 text-sm">
                                Changing this clears the confirmation and we text a new code.
                            </Text>

                            {held === '' ? null : (
                                <View className="mt-2 flex-row items-center gap-3">
                                    <StatusPill
                                        tone={session.user.phone_verified ? 'success' : 'neutral'}
                                    >
                                        {session.user.phone_verified ? 'confirmed' : 'not confirmed'}
                                    </StatusPill>

                                    {session.user.phone_verified ? null : (
                                        <Pressable
                                            accessibilityRole="button"
                                            onPress={() =>
                                                router.push({
                                                    pathname: '/profile/phone',
                                                    params: { from: 'Profile' },
                                                })
                                            }
                                        >
                                            <Text className="text-brand text-sm font-medium">
                                                Confirm this number
                                            </Text>
                                        </Pressable>
                                    )}
                                </View>
                            )}
                        </View>

                        <Button onPress={save} busy={busy}>
                            Save changes
                        </Button>
                    </Card>
                </ScrollView>
            </KeyboardAvoiding>
        </SafeAreaView>
    );
}
