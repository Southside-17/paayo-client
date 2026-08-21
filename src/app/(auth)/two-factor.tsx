import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AuthScreen } from '@/components/auth-screen';
import { FormMessage } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useSession } from '@/lib/session';
import { useSubmit } from '@/lib/use-submit';

export default function TwoFactor() {
    const { challenge } = useLocalSearchParams<{ challenge: string }>();
    const { completeTwoFactor } = useSession();
    const { busy, message, errorFor, submit } = useSubmit();
    const [code, setCode] = useState('');
    const [usingRecoveryCode, setUsingRecoveryCode] = useState(false);

    const confirm = () =>
        submit(async () => {
            await completeTwoFactor(
                challenge,
                usingRecoveryCode ? '' : code.trim(),
                usingRecoveryCode ? code.trim() : undefined,
            );
        });

    return (
        <AuthScreen
            title="Two factor authentication"
            subtitle={
                usingRecoveryCode
                    ? 'Enter one of the recovery codes you saved.'
                    : 'Enter the code from your authenticator app.'
            }
        >
            <View className="gap-4">
                <FormMessage message={message} />

                <View>
                    <Label>{usingRecoveryCode ? 'Recovery code' : 'Authentication code'}</Label>
                    <Input
                        value={code}
                        onChangeText={setCode}
                        autoCapitalize="none"
                        autoFocus
                        keyboardType={usingRecoveryCode ? 'default' : 'number-pad'}
                        placeholder={usingRecoveryCode ? 'xxxxxxxx-xxxxxxxx' : '123456'}
                        invalid={Boolean(errorFor('code') ?? errorFor('recovery_code'))}
                    />
                    <FieldError message={errorFor('code') ?? errorFor('recovery_code')} />
                    <FieldError message={errorFor('challenge_token')} />
                </View>

                <Button onPress={confirm} busy={busy}>
                    Continue
                </Button>

                <Pressable
                    onPress={() => {
                        setUsingRecoveryCode((previous) => !previous);
                        setCode('');
                    }}
                >
                    <Text className="text-brand text-center text-sm font-medium">
                        {usingRecoveryCode ? 'Use an authentication code' : 'Use a recovery code'}
                    </Text>
                </Pressable>
            </View>
        </AuthScreen>
    );
}
