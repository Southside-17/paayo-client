import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { FormMessage } from '@/components/form-message';
import { openDocument } from '@/components/legal-consent';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FieldError } from '@/components/ui/field-error';
import { KeyboardAvoiding } from '@/components/ui/keyboard-avoiding';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { useSession } from '@/lib/session';
import type { MessageResponse } from '@/lib/types';
import { useSubmit } from '@/lib/use-submit';

const ERASED = [
    'Your name, email address and phone number',
    'Your picture, password, passkeys and two-factor codes',
    'Any identity documents you sent us, and the photographs behind them',
    'Your saved addresses, devices and the record of texts sent to you',
];

const KEPT = [
    'Work you booked, and the invoices and payments on it',
    'Photographs attached to a job, as evidence of what was done',
];

/**
 * Closing the account, and what that does and does not erase.
 */
export default function DeleteAccount() {
    const session = useSession();
    const { busy, message, errorFor, submit } = useSubmit();
    const [password, setPassword] = useState('');
    const [asking, setAsking] = useState(false);

    if (session.status !== 'authenticated') {
        return null;
    }

    const { user } = session;

    const close = () =>
        submit(async () => {
            setAsking(false);

            await session.authenticatedRequest<MessageResponse>('/profile', {
                method: 'DELETE',
                body: user.has_password ? { current_password: password } : {},
            });

            await session.logout();

            router.replace('/login');
        });

    return (
        <SafeAreaView className="bg-background flex-1">
            <KeyboardAvoiding className="flex-1">
                <ScrollView contentContainerClassName="gap-6 p-6" keyboardShouldPersistTaps="handled">
                    <BackButton label="Account" />
                    <ScreenHeader title="Close your account" />

                    <FormMessage message={message} />

                    <FieldError message={errorFor('account')} />

                    <Card className="gap-3">
                        <Text className="font-medium">Erased, with no way to get it back</Text>
                        {ERASED.map((line) => (
                            <Text key={line} className="text-muted-foreground text-sm leading-5">
                                {line}
                            </Text>
                        ))}
                    </Card>

                    <Card className="gap-3">
                        <Text className="font-medium">Kept, with your name taken off</Text>
                        {KEPT.map((line) => (
                            <Text key={line} className="text-muted-foreground text-sm leading-5">
                                {line}
                            </Text>
                        ))}
                        <Text className="text-muted-foreground text-sm leading-5">
                            Tax law requires these for ten years. The address on them is cut back to
                            your barangay, so nothing points at your door.
                        </Text>
                    </Card>

                    <Text className="text-muted-foreground text-sm leading-5">
                        If nothing on your account has to be kept, it is erased the moment you
                        confirm. Otherwise it closes now and the rest is erased within 30 days.{' '}
                        <Text
                            className="text-brand text-sm underline"
                            onPress={() => openDocument('/account-deletion')}
                        >
                            Read the full details
                        </Text>
                        .
                    </Text>

                    {user.has_password ? (
                        <View>
                            <Label>Confirm your password</Label>
                            <PasswordInput
                                value={password}
                                onChangeText={setPassword}
                                autoComplete="current-password"
                                placeholder="Password"
                                invalid={Boolean(errorFor('current_password'))}
                            />
                            <FieldError message={errorFor('current_password')} />
                        </View>
                    ) : null}

                    <Button variant="destructive" onPress={() => setAsking(true)} busy={busy}>
                        Close my account
                    </Button>
                </ScrollView>
            </KeyboardAvoiding>

            <ConfirmDialog
                open={asking}
                title="Close your account?"
                body="You are signed out of every device straight away and cannot sign in again. This cannot be undone once your details are erased."
                confirm="Close my account"
                dismiss="Keep my account"
                destructive
                busy={busy}
                onConfirm={close}
                onDismiss={() => setAsking(false)}
            />
        </SafeAreaView>
    );
}
