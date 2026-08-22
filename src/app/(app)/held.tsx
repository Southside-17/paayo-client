import { useState } from 'react';
import { View } from 'react-native';

import { AuthScreen } from '@/components/auth-screen';
import { FormMessage } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useSession } from '@/lib/session';
import type { MessageResponse, SuspensionNotice } from '@/lib/types';
import { useSubmit } from '@/lib/use-submit';

/** Philippine ordering, the same call every other date in the app goes through. */
function on(date: string): string {
    return new Date(date).toLocaleDateString('en-PH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

/**
 * The four facts about a hold, in the order they are asked about.
 */
function Notice({ suspension }: { suspension: SuspensionNotice }) {
    const rows: [string, string][] = [
        ['Reason', suspension.reason],
        ['Since', on(suspension.starts_at)],
        ['Until', suspension.ends_at === null ? 'it is lifted' : on(suspension.ends_at)],
    ];

    return (
        <View className="border-border gap-2.5 rounded-xl border p-4">
            {rows.map(([term, value]) => (
                <View key={term} className="flex-row justify-between gap-4">
                    <Text className="text-muted-foreground text-sm">{term}</Text>
                    <Text className="text-sm font-semibold">{value}</Text>
                </View>
            ))}
        </View>
    );
}

/**
 * The gate a suspended account sits behind.
 *
 * An Access suspension never reaches here -- the API deletes the token and the
 * session ends -- so everything on this screen is an Activity hold, which is
 * the one that can still sign in and is held out of everything afterwards.
 */
export default function Held() {
    const session = useSession();
    const { busy, message, errorFor, submit } = useSubmit();
    const [note, setNote] = useState('');

    if (session.status !== 'authenticated' || !session.user.suspension) {
        return null;
    }

    const { suspension } = session.user;

    const ask = () =>
        submit(async () => {
            await session.authenticatedRequest<MessageResponse>('/auth/suspension/appeal', {
                method: 'POST',
                body: { appeal_note: note.trim() },
            });

            await session.reload();
        });

    return (
        <AuthScreen
            title={
                suspension.punitive ? 'Your account is suspended' : 'Your account is on hold'
            }
            subtitle={suspension.notice}
        >
            <View className="gap-4">
                <FormMessage message={message} />

                <Notice suspension={suspension} />

                {suspension.appealed_at === null ? (
                    <View className="gap-2">
                        <Label>Ask for this to be reviewed</Label>
                        <Input
                            value={note}
                            onChangeText={setNote}
                            multiline
                            textAlignVertical="top"
                            className="h-24 py-3"
                            placeholder="Anything we should know."
                            invalid={Boolean(errorFor('appeal_note'))}
                        />
                        <FieldError message={errorFor('appeal_note')} />

                        <Button onPress={ask} busy={busy}>
                            Send
                        </Button>

                        <Text className="text-muted-foreground text-center text-xs">
                            You can send this once.
                        </Text>
                    </View>
                ) : (
                    <Text className="text-muted-foreground border-border rounded-xl border border-dashed p-4 text-center text-sm">
                        You asked for this to be reviewed on {on(suspension.appealed_at)}. Someone
                        will be in touch.
                    </Text>
                )}

                <Button onPress={() => void session.logout()} variant="ghost">
                    Log out
                </Button>
            </View>
        </AuthScreen>
    );
}
