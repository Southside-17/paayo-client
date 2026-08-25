import { router, useLocalSearchParams } from 'expo-router';
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
import { ApiError, DisplayableError } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { MessageResponse, User } from '@/lib/types';
import { useSubmit } from '@/lib/use-submit';

/**
 * Prove that the contact number on the account can be reached.
 */
export default function ConfirmPhone() {
    const { from } = useLocalSearchParams<{ from?: string }>();
    const session = useSession();
    const { busy, message, errorFor, submit } = useSubmit();
    const [asked, setAsked] = useState(false);
    const [sent, setSent] = useState<string | null>(null);
    const [code, setCode] = useState('');

    if (session.status !== 'authenticated') {
        return null;
    }

    const { user } = session;

    const ask = () =>
        submit(async () => {
            setSent(null);
            setCode('');

            try {
                const answer = await session.authenticatedRequest<MessageResponse>(
                    '/profile/phone/verification',
                    { method: 'POST' },
                );

                setAsked(true);
                setSent(answer.message);
            } catch (error) {
                if (error instanceof ApiError && error.isThrottled) {
                    throw new DisplayableError(
                        'That is as many codes as we can text in an hour. Try again later.',
                    );
                }

                throw error;
            }
        });

    const confirm = () =>
        submit(async () => {
            setSent(null);

            await session.authenticatedRequest<{ data: User; message: string }>(
                '/profile/phone/verification',
                { method: 'PUT', body: { code: code.trim() } },
            );

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
                    <BackButton label={from ?? 'Profile'} />
                    <ScreenHeader title="Confirm your number" />

                    {/* A refusal about the number itself has no input on this
                        screen to sit under, so the banner reads it or nobody
                        does. See .ai/rules/api.md. */}
                    <FormMessage message={message ?? errorFor('phone') ?? null} />
                    <FormMessage message={sent} tone="success" />

                    {user.phone === null ? (
                        <Card className="gap-3">
                            <Text className="text-sm">
                                There is no number on your account yet.
                            </Text>
                            <Button
                                onPress={() =>
                                    router.push({
                                        pathname: '/profile/edit',
                                        params: { from: from ?? 'Profile' },
                                    })
                                }
                            >
                                Add a number
                            </Button>
                        </Card>
                    ) : (
                        <Card className="gap-3">
                            <View>
                                <Label>Your number</Label>
                                <Text className="text-sm">{user.phone}</Text>
                            </View>

                            {user.phone_verified ? (
                                <Text className="text-muted-foreground text-sm">
                                    This number is confirmed. We can text you when a crew is at
                                    your door.
                                </Text>
                            ) : null}

                            {!user.phone_verified && !asked ? (
                                <>
                                    <Text className="text-muted-foreground text-sm">
                                        We will text a six digit code to this number. It stands for
                                        ten minutes.
                                    </Text>
                                    <Button onPress={ask} busy={busy}>
                                        Text me a code
                                    </Button>
                                </>
                            ) : null}

                            {!user.phone_verified && asked ? (
                                <>
                                    <View>
                                        <Label>Code from the text</Label>
                                        <Input
                                            value={code}
                                            onChangeText={setCode}
                                            autoFocus
                                            keyboardType="number-pad"
                                            maxLength={6}
                                            placeholder="123456"
                                            // The cross-platform value: React
                                            // Native maps it to Android's
                                            // sms-otp and iOS's oneTimeCode, so
                                            // the code is offered out of the
                                            // message itself.
                                            autoComplete="one-time-code"
                                            invalid={Boolean(errorFor('code'))}
                                        />
                                        <FieldError message={errorFor('code')} />
                                    </View>

                                    <Button onPress={confirm} busy={busy}>
                                        Confirm number
                                    </Button>

                                    <Button variant="outline" onPress={ask} busy={busy}>
                                        Send another code
                                    </Button>
                                </>
                            ) : null}
                        </Card>
                    )}
                </ScrollView>
            </KeyboardAvoiding>
        </SafeAreaView>
    );
}
