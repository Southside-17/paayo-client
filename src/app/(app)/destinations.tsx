import { router, useFocusEffect } from 'expo-router';
import Trash2 from 'lucide-react-native/icons/trash-2';
import { useColorScheme } from 'nativewind';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useSession } from '@/lib/session';
import type { Destination } from '@/lib/types';
import { useSubmit } from '@/lib/use-submit';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/lib/workspace';
import palette from '@/theme/palette';

/** The accounts a business may publish, and what each is called. */
const KINDS = [
    { value: 'gcash', label: 'GCash', bank: false },
    { value: 'maya', label: 'Maya', bank: false },
    { value: 'bank', label: 'Bank account', bank: true },
] as const;

/** One row being edited, before it is anything the server would accept. */
type Draft = {
    method: (typeof KINDS)[number]['value'];
    handle: string;
    name: string;
    institution: string;
};

/**
 * Where clients send money.
 *
 * Owner only, because changing the account a client pays into is how a taken-over
 * staff account turns into cash. Every owner is told when this changes, including
 * whoever changed it -- that is deliberate and not a bug.
 *
 * The account name is the part that matters. A client handed a bare number or a
 * QR has no way to tell whose it is, so the name is what lets them check before
 * they send anything.
 */
export default function Destinations() {
    const session = useSession();
    const { staff } = useWorkspace();
    const { colorScheme } = useColorScheme();
    const colours = palette[colorScheme ?? 'light'];
    const { busy, message, errorFor, submit } = useSubmit();
    const [drafts, setDrafts] = useState<Draft[] | null>(null);

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;
    const provider = staff?.provider.id ?? null;

    useFocusEffect(
        useCallback(() => {
            if (!authenticatedRequest || !provider || drafts !== null) {
                return;
            }

            void authenticatedRequest<{ data: Destination[] }>(
                `/providers/${provider}/destinations`,
            )
                .then(({ data }) =>
                    setDrafts(
                        data.map((entry) => ({
                            method: entry.method.value as Draft['method'],
                            handle: entry.handle,
                            name: entry.name,
                            institution: entry.institution ?? '',
                        })),
                    ),
                )
                .catch(() => setDrafts([]));
        }, [authenticatedRequest, provider, drafts]),
    );

    if (!staff || !staff.permissions.includes('provider:update')) {
        return null;
    }

    const held = drafts ?? [];
    const spare = KINDS.filter((kind) => !held.some((entry) => entry.method === kind.value));

    const add = (method: Draft['method']) =>
        setDrafts([...held, { method, handle: '', name: '', institution: '' }]);

    const change = (at: number, patch: Partial<Draft>) =>
        setDrafts(held.map((entry, index) => (index === at ? { ...entry, ...patch } : entry)));

    const drop = (at: number) => setDrafts(held.filter((_, index) => index !== at));

    const save = () =>
        submit(async () => {
            if (session.status !== 'authenticated' || !provider) {
                return;
            }

            await session.authenticatedRequest(`/providers/${provider}/destinations`, {
                method: 'PUT',
                body: {
                    destinations: held.map((entry) => ({
                        method: entry.method,
                        handle: entry.handle.trim(),
                        name: entry.name.trim(),
                        institution: entry.method === 'bank' ? entry.institution.trim() : null,
                    })),
                },
            });

            router.back();
        });

    return (
        <SafeAreaView className="bg-background flex-1">
            <KeyboardAvoiding className="flex-1">
                <ScrollView contentContainerClassName="gap-5 p-6" keyboardShouldPersistTaps="handled">
                    <BackButton label="Business" />
                    <ScreenHeader
                        eyebrow="Getting paid"
                        title="Where clients send money"
                    />

                    <FormMessage message={message ?? errorFor('destinations') ?? null} />

                    <Text className="text-muted-foreground text-sm">
                        A client sees these once they have accepted, never before. Every owner is
                        told when they change.
                    </Text>

                    {drafts === null ? (
                        <Card className="gap-2">
                            <Skeleton className="h-5 w-24" />
                            <Skeleton className="h-12 w-full" />
                        </Card>
                    ) : null}

                    {held.map((entry, at) => {
                        const kind = KINDS.find((option) => option.value === entry.method);

                        return (
                            <Card key={entry.method} className="gap-3">
                                <View className="flex-row items-center gap-2">
                                    <Label>{kind?.label ?? entry.method}</Label>
                                    <View className="flex-1" />
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={`Remove ${kind?.label ?? entry.method}`}
                                        disabled={busy}
                                        onPress={() => drop(at)}
                                        hitSlop={8}
                                    >
                                        <Trash2 color={colours['muted-foreground']} size={17} />
                                    </Pressable>
                                </View>

                                {kind?.bank ? (
                                    <View className="gap-1.5">
                                        <Label>Which bank</Label>
                                        <Input
                                            value={entry.institution}
                                            onChangeText={(typed) =>
                                                change(at, { institution: typed })
                                            }
                                            editable={!busy}
                                            placeholder="BPI"
                                            accessibilityLabel="Which bank"
                                        />
                                    </View>
                                ) : null}

                                <View className="gap-1.5">
                                    <Label>{kind?.bank ? 'Account number' : 'Mobile number'}</Label>
                                    <Input
                                        value={entry.handle}
                                        onChangeText={(typed) => change(at, { handle: typed })}
                                        editable={!busy}
                                        keyboardType={kind?.bank ? 'default' : 'phone-pad'}
                                        placeholder={kind?.bank ? '1234567890' : '09171234567'}
                                        accessibilityLabel={
                                            kind?.bank ? 'Account number' : 'Mobile number'
                                        }
                                    />
                                    <FieldError
                                        message={errorFor(`destinations.${at}.handle`)}
                                    />
                                </View>

                                <View className="gap-1.5">
                                    <Label>Account name</Label>
                                    <Input
                                        value={entry.name}
                                        onChangeText={(typed) => change(at, { name: typed })}
                                        editable={!busy}
                                        placeholder="Juan Dela Cruz"
                                        accessibilityLabel="Account name"
                                    />
                                    {/* Not a nicety. This is the only thing that
                                        lets a client check they are sending to
                                        the right person. */}
                                    <Text className="text-muted-foreground text-xs">
                                        Exactly as it shows in the app, so a client can check it.
                                    </Text>
                                    <FieldError message={errorFor(`destinations.${at}.name`)} />
                                </View>
                            </Card>
                        );
                    })}

                    {drafts !== null && held.length === 0 ? (
                        <Card className="gap-2">
                            <Text className="font-semibold">Cash only, for now</Text>
                            <Text className="text-muted-foreground text-sm">
                                Add an account and clients can send you money before you get there.
                            </Text>
                        </Card>
                    ) : null}

                    {spare.length > 0 && drafts !== null ? (
                        <View className="flex-row flex-wrap gap-2">
                            {spare.map((kind) => (
                                <Pressable
                                    key={kind.value}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Add ${kind.label}`}
                                    disabled={busy}
                                    onPress={() => add(kind.value)}
                                    className={cn(
                                        'border-border rounded-xl border border-dashed px-4 py-2.5',
                                    )}
                                >
                                    <Text className="text-sm font-semibold">{`Add ${kind.label}`}</Text>
                                </Pressable>
                            ))}
                        </View>
                    ) : null}

                    <Button
                        variant="brand"
                        busy={busy}
                        disabled={drafts === null}
                        onPress={() => void save()}
                    >
                        Save
                    </Button>
                </ScrollView>
            </KeyboardAvoiding>
        </SafeAreaView>
    );
}
