import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { FormMessage } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FieldError } from '@/components/ui/field-error';
import { Text } from '@/components/ui/text';
import { DEVICE_NAME } from '@/lib/api';
import { passkeyAttestation, passkeysAreSupported } from '@/lib/passkey';
import { useSession } from '@/lib/session';
import type { Passkey } from '@/lib/types';
import { useSubmit } from '@/lib/use-submit';

/**
 * The passkeys on the account, and the two things you can do to them.
 */
export function PasskeyCard() {
    const session = useSession();
    const { busy, message, errorFor, submit } = useSubmit();
    const [passkeys, setPasskeys] = useState<Passkey[] | null>(null);

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;

    const load = useCallback(async () => {
        if (!authenticatedRequest) {
            return;
        }

        const { data } = await authenticatedRequest<{ data: Passkey[] }>('/auth/passkeys');

        setPasskeys(data);
    }, [authenticatedRequest]);

    useEffect(() => {
        void submit(load);
    }, [load, submit]);

    if (session.status !== 'authenticated' || !passkeysAreSupported()) {
        return null;
    }

    const add = () =>
        submit(async () => {
            const answered = await passkeyAttestation(session.authenticatedRequest);

            // Dismissing the sheet is a decision, not a failure.
            if (answered === null) {
                return;
            }

            await session.authenticatedRequest<unknown>('/auth/passkeys', {
                method: 'POST',
                body: { ...answered, name: DEVICE_NAME },
            });

            await load();
        });

    const remove = (passkey: Passkey) =>
        submit(async () => {
            await session.authenticatedRequest<void>(`/auth/passkeys/${passkey.id}`, {
                method: 'DELETE',
            });

            await load();
        });

    return (
        <Card className="gap-3">
            <Text className="font-semibold">Passkeys</Text>
            <Text className="text-muted-foreground text-sm">
                Sign in with the face, fingerprint or screen lock this phone already uses.
            </Text>

            <FormMessage message={message} />
            <FieldError message={errorFor('credential')} />

            {passkeys?.length === 0 ? (
                <Text className="text-muted-foreground text-sm">No passkeys on this account.</Text>
            ) : null}

            {passkeys?.map((passkey) => (
                <View key={passkey.id} className="flex-row items-center justify-between gap-3">
                    <View className="flex-1">
                        <Text>{passkey.name}</Text>
                        <Text className="text-muted-foreground text-xs">
                            {passkey.last_used_at === null ? 'Never used' : 'Used before'}
                        </Text>
                    </View>
                    <Button variant="ghost" onPress={() => remove(passkey)} busy={busy}>
                        Remove
                    </Button>
                </View>
            ))}

            <Button variant="outline" onPress={add} busy={busy}>
                Add a passkey
            </Button>
        </Card>
    );
}
