import { Link } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AuthScreen } from '@/components/auth-screen';
import { FormMessage } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Text } from '@/components/ui/text';
import { useSession } from '@/lib/session';
import { useSubmit } from '@/lib/use-submit';

export default function Register() {
    const { register } = useSession();
    const { busy, message, errorFor, submit } = useSubmit();
    const [nickname, setNickname] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');

    const create = () =>
        submit(async () => {
            await register({
                nickname: nickname.trim(),
                email: email.trim(),
                password,
                password_confirmation: confirmation,
            });
        });

    return (
        <AuthScreen title="Create your account" subtitle="A few details and you are in">
            <View className="gap-4">
                <FormMessage message={message} />

                <View>
                    <Label>Name</Label>
                    <Input
                        value={nickname}
                        onChangeText={setNickname}
                        autoComplete="name"
                        placeholder="How should we call you?"
                        invalid={Boolean(errorFor('nickname'))}
                    />
                    <FieldError message={errorFor('nickname')} />
                </View>

                <View>
                    <Label>Email address</Label>
                    <Input
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        autoComplete="email"
                        keyboardType="email-address"
                        placeholder="email@example.com"
                        invalid={Boolean(errorFor('email'))}
                    />
                    <FieldError message={errorFor('email')} />
                </View>

                <View>
                    <Label>Password</Label>
                    <PasswordInput
                        value={password}
                        onChangeText={setPassword}
                        autoComplete="new-password"
                        placeholder="Password"
                        invalid={Boolean(errorFor('password'))}
                    />
                    <FieldError message={errorFor('password')} />
                </View>

                <View>
                    <Label>Confirm password</Label>
                    <PasswordInput
                        value={confirmation}
                        onChangeText={setConfirmation}
                        autoComplete="new-password"
                        placeholder="Confirm password"
                    />
                </View>

                <Button onPress={create} busy={busy}>
                    Create account
                </Button>

                <View className="flex-row justify-center gap-1">
                    <Text className="text-muted-foreground text-sm">Already have an account?</Text>
                    <Link href="/login">
                        <Text className="text-brand text-sm font-medium">Log in</Text>
                    </Link>
                </View>
            </View>
        </AuthScreen>
    );
}
