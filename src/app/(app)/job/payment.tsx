import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { FormMessage } from '@/components/form-message';
import { MediaPicker, type MediaItem } from '@/components/media-picker';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FieldError } from '@/components/ui/field-error';
import { Label } from '@/components/ui/label';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { destinationLine, isTransfer } from '@/lib/billing';
import { peso } from '@/lib/money';
import { useSession } from '@/lib/session';
import type { Booking, Destination, PaymentMethod } from '@/lib/types';
import { useSubmit } from '@/lib/use-submit';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/lib/workspace';

/** How many photographs of a confirmation screen anybody needs. */
const RECEIPTS = 3;

/**
 * One way this client could have paid, as a button.
 *
 * Accounts rather than rails: a business may publish GCash and Maya at once, so
 * "E-wallet" would ask the crew to pick a category and then pick again. The
 * institution is what they recognise anyway.
 */
type Way = {
    key: string;
    label: string;
    method: PaymentMethod['value'];
    institution: string | null;
    destination: Destination | null;
};

/**
 * Record that the client paid.
 *
 * A full screen and not a modal, following `finish.tsx` for the same reasons.
 *
 * **This is an attestation, not a proof.** On this rail the money never touches
 * Paayo, so the record is somebody's word -- which is why a transfer has to
 * carry the confirmation screen it left behind, and why the client is shown who
 * said it rather than asked to approve it.
 */
export default function RecordPayment() {
    const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
    const session = useSession();
    const { staff } = useWorkspace();
    const { busy, message, errorFor, submit } = useSubmit();
    const [booking, setBooking] = useState<Booking | null>(null);
    const [failure, setFailure] = useState<string | null>(null);
    const [chosen, setChosen] = useState('cash');
    const [receipts, setReceipts] = useState<MediaItem[]>([]);
    const [recording, setRecording] = useState(false);

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;
    const provider = staff?.provider.id ?? null;

    // Read once, not on every focus: a refetch behind the crew would drop the
    // receipt they had already attached.
    useEffect(() => {
        if (!authenticatedRequest || !provider) {
            return;
        }

        void authenticatedRequest<{ data: Booking }>(`/providers/${provider}/jobs/${id}`)
            .then(({ data }) => setBooking(data))
            .catch(() => setFailure('Could not reach Paayo. Try again.'));
    }, [authenticatedRequest, provider, id]);

    const invoice = booking?.invoice ?? null;

    // Read defensively: an older server omits the key, and a fresh [] every
    // render would re-derive the offered methods on every tap.
    const published = useMemo(() => booking?.provider.destinations ?? [], [booking]);

    // Cash always, then one button per published account. Offering a rail the
    // business published nothing on is offering a refusal.
    const ways = useMemo<Way[]>(
        () => [
            { key: 'cash', label: 'Cash', method: 'cash', institution: null, destination: null },
            ...published.map((entry) => ({
                key: `${entry.method.value}:${entry.institution}`,
                label: entry.institution,
                method: entry.method.value as PaymentMethod['value'],
                institution: entry.institution,
                destination: entry,
            })),
        ],
        [published],
    );

    const way = ways.find((option) => option.key === chosen) ?? ways[0];
    const destination = way?.destination ?? null;

    const attached = receipts.filter((item) => item.id !== null).map((item) => item.id as string);
    const settling = receipts.some((item) => item.progress !== null);
    const wanted = isTransfer(way?.method ?? 'cash');

    if (!staff || session.status !== 'authenticated') {
        return <Redirect href="/" />;
    }

    const record = () =>
        submit(async () => {
            if (session.status !== 'authenticated' || !provider || !invoice) {
                return;
            }

            await session.authenticatedRequest(
                `/providers/${provider}/invoices/${invoice.id}/payments`,
                {
                    method: 'POST',
                    body: {
                        method: way?.method ?? 'cash',
                        // The rail alone no longer says where it went: a business
                        // may publish GCash and Maya at once.
                        institution: way?.institution ?? null,
                        amount: invoice.total,
                        attachments: attached,
                    },
                },
            );

            router.back();
        });

    return (
        <SafeAreaView className="bg-background flex-1">
            <ScrollView contentContainerClassName="gap-5 p-6">
                <BackButton label={name ?? 'Job'} />
                <ScreenHeader eyebrow="Getting paid" title="How did they pay?" />

                <FormMessage
                    message={message ?? failure ?? errorFor('amount') ?? errorFor('method') ?? null}
                />

                {booking === null && failure === null ? (
                    <Card className="gap-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-12 w-full" />
                    </Card>
                ) : null}

                {invoice !== null ? (
                    <Card className="gap-1">
                        <Label>What they owe</Label>
                        <Text className="text-brand text-3xl font-bold">{peso(invoice.total)}</Text>
                        <Text className="text-muted-foreground text-sm">
                            Record the whole amount. Part payments are not agreed on this job.
                        </Text>
                    </Card>
                ) : null}

                {invoice !== null && invoice.is_settled ? (
                    <Card className="gap-2">
                        <Text className="font-semibold">This is already paid</Text>
                        <Text className="text-muted-foreground text-sm">
                            Somebody recorded it already, so there is nothing to add.
                        </Text>
                    </Card>
                ) : null}

                {invoice !== null && !invoice.is_settled ? (
                    <>
                        <Card className="gap-3">
                            <Label>They paid by</Label>
                            <View className="flex-row flex-wrap gap-2">
                                {ways.map((option) => (
                                    <Pressable
                                        key={option.key}
                                        accessibilityRole="button"
                                        accessibilityLabel={option.label}
                                        accessibilityState={{ selected: chosen === option.key }}
                                        disabled={busy}
                                        onPress={() => {
                                            setChosen(option.key);
                                            setReceipts([]);
                                        }}
                                        className={cn(
                                            'rounded-xl border px-4 py-2.5',
                                            chosen === option.key
                                                ? 'border-brand bg-brand/10'
                                                : 'border-border bg-card',
                                        )}
                                    >
                                        <Text
                                            className={cn(
                                                'text-sm font-semibold',
                                                chosen === option.key ? 'text-brand' : undefined,
                                            )}
                                        >
                                            {option.label}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>

                            {destination !== null ? (
                                <View className="gap-0.5">
                                    <Text className="text-sm font-semibold">
                                        {destinationLine(destination)}
                                    </Text>
                                    <Text className="text-muted-foreground font-mono text-xs">
                                        {destination.handle}
                                    </Text>
                                </View>
                            ) : null}
                        </Card>

                        {wanted ? (
                            <Card className="gap-3">
                                <Label>Photo of the confirmation</Label>
                                {/* Cash leaves nothing to photograph; a transfer
                                    leaves a screen, and that screen is the only
                                    evidence this rail ever has. */}
                                <Text className="text-muted-foreground text-sm">
                                    {`Attach the ${way?.label ?? ''} confirmation so the client can see it too.`}
                                </Text>
                                <MediaPicker
                                    send={session.authenticatedRequest}
                                    items={receipts}
                                    onChange={setReceipts}
                                    disabled={busy}
                                    invalid={errorFor('attachments') !== null}
                                    photosOnly
                                    limit={RECEIPTS}
                                />
                                <FieldError message={errorFor('attachments')} />
                            </Card>
                        ) : null}

                        <Button
                            variant="brand"
                            busy={busy}
                            disabled={settling || (wanted && attached.length === 0)}
                            onPress={() => setRecording(true)}
                        >
                            Record payment
                        </Button>
                    </>
                ) : null}

                <ConfirmDialog
                    open={recording}
                    title="Record this payment?"
                    body={
                        invoice === null
                            ? ''
                            : `${peso(invoice.total)} ${way?.method === 'cash' ? 'in cash' : `by ${way?.label}`}. The client sees this, and your name against it.`
                    }
                    confirm="Record it"
                    dismiss="Not yet"
                    busy={busy}
                    onConfirm={() => {
                        setRecording(false);
                        void record();
                    }}
                    onDismiss={() => setRecording(false)}
                />
            </ScrollView>
        </SafeAreaView>
    );
}
