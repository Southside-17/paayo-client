import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { FormMessage } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { KeyboardAvoiding } from '@/components/ui/keyboard-avoiding';
import { Label } from '@/components/ui/label';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { type Accounted, runningTotal, span } from '@/lib/jobs';
import { peso, rateLine } from '@/lib/money';
import { useSession } from '@/lib/session';
import type { Booking } from '@/lib/types';
import { useSubmit } from '@/lib/use-submit';
import { useWorkspace } from '@/lib/workspace';

/** Read a typed count or span back as a whole number, or nothing. */
function whole(typed: string): number | null {
    const digits = typed.replace(/[^0-9]/g, '');

    return digits === '' ? null : Number(digits);
}

/**
 * What was actually done, and how long it took.
 *
 * A full screen and not a modal. `price-sheet.tsx` is the outlier here -- it
 * draws a `<Modal>` while `book.tsx` and `enquiry/new.tsx` are screens -- and
 * this is the same kind of form: several fields, a running figure, and a
 * keyboard that has to sit under all of it.
 *
 * **Nothing here can name a price.** Each row states a count or a span against
 * a line that was already agreed; the rate comes off the booking's own snapshot
 * on the server, so the crew cannot move an amount or add a charge.
 */
export default function FinishJob() {
    const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
    const session = useSession();
    const { staff } = useWorkspace();
    const { busy, message, errorFor, submit } = useSubmit();
    const [booking, setBooking] = useState<Booking | null>(null);
    const [failure, setFailure] = useState<string | null>(null);
    const [stated, setStated] = useState<Record<string, Accounted>>({});
    const [note, setNote] = useState('');
    const [finishing, setFinishing] = useState(false);

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;
    const provider = staff?.provider.id ?? null;

    // Read once, not on every focus: the crew are typing into this screen, and a
    // refetch behind them would wipe what they had entered.
    useEffect(() => {
        if (!authenticatedRequest || !provider) {
            return;
        }

        void authenticatedRequest<{ data: Booking }>(`/providers/${provider}/jobs/${id}`)
            .then(({ data }) => {
                setBooking(data);
                setStated(seed(data));
            })
            .catch(() => setFailure('Could not reach Paayo. Try again.'));
    }, [authenticatedRequest, provider, id]);

    const job = booking?.job ?? null;
    // Memoised, and read defensively: an older server that omits the field must
    // still let a crew finish a job, and a fresh object every render would make
    // the total below recompute on every keystroke.
    const rounding = useMemo(
        () => booking?.hour_rounding ?? { value: 'hour' as const, label: 'To the hour' },
        [booking],
    );

    // Memoised rather than defaulted inline: a fresh [] every render would make
    // the total below recompute on every keystroke of the note field.
    const lines = useMemo(() => booking?.lines ?? [], [booking]);

    const total = useMemo(() => runningTotal(lines, stated, rounding), [lines, stated, rounding]);

    if (!staff) {
        return <Redirect href="/" />;
    }

    const finish = () =>
        submit(async () => {
            if (session.status !== 'authenticated' || !provider) {
                return;
            }

            await session.authenticatedRequest(`/providers/${provider}/jobs/${id}/completion`, {
                method: 'POST',
                body: {
                    lines: lines.map((line) => ({
                        label: line.label,
                        quantity: stated[line.label]?.quantity ?? null,
                        minutes: stated[line.label]?.minutes ?? null,
                    })),
                    note: note.trim() || null,
                },
            });

            router.back();
        });

    const say = (label: string, patch: Partial<Accounted>) =>
        setStated((held) => ({
            ...held,
            [label]: {
                ...{ label, quantity: null, minutes: null },
                ...held[label],
                ...patch,
            },
        }));

    return (
        <SafeAreaView className="bg-background flex-1">
            <KeyboardAvoiding className="flex-1">
                <ScrollView
                    contentContainerClassName="gap-5 p-6"
                    keyboardShouldPersistTaps="handled"
                >
                    <BackButton label={name ?? 'Job'} />
                    <ScreenHeader eyebrow="Finishing up" title="What did you do?" />

                    <FormMessage
                        message={message ?? failure ?? errorFor('lines') ?? errorFor('status') ?? null}
                    />

                    {booking === null && failure === null ? (
                        <>
                            <Card className="gap-2">
                                <Skeleton className="h-5 w-32" />
                                <Skeleton className="h-12 w-full" />
                            </Card>
                            <Card className="gap-2">
                                <Skeleton className="h-5 w-24" />
                                <Skeleton className="h-12 w-full" />
                            </Card>
                        </>
                    ) : null}

                    {job !== null && job.elapsed_minutes !== null ? (
                        <Card className="gap-1">
                            <Label>On the clock</Label>
                            <Text className="text-lg font-semibold">
                                {span(job.elapsed_minutes)}
                            </Text>
                            {/* Measured from starting, never from arriving: the
                                wait at the gate is not the client's time. */}
                            <Text className="text-muted-foreground text-sm">
                                From when you started work. Change the hours below if that is not
                                what you actually worked.
                            </Text>
                        </Card>
                    ) : null}

                    {lines.map((line, at) => {
                        const hourly = line.unit === 'hour';
                        const said = stated[line.label];
                        const minutes = said?.minutes ?? null;
                        const over =
                            hourly &&
                            line.maximum_minutes !== null &&
                            minutes !== null &&
                            minutes > line.maximum_minutes;

                        return (
                            <Card key={line.label} className="gap-2">
                                <View className="flex-row items-baseline gap-2">
                                    <Label>{line.label}</Label>
                                    <Text className="text-muted-foreground flex-1 text-right text-xs">
                                        {rateLine(line)}
                                    </Text>
                                </View>

                                {hourly ? (
                                    <>
                                        <Input
                                            value={minutes === null ? '' : String(minutes)}
                                            onChangeText={(typed) =>
                                                say(line.label, { minutes: whole(typed) })
                                            }
                                            inputMode="numeric"
                                            editable={!busy}
                                            placeholder="Minutes worked"
                                            accessibilityLabel={`Minutes worked on ${line.label}`}
                                            invalid={Boolean(errorFor(`lines.${at}.minutes`))}
                                        />
                                        {minutes === null ? null : (
                                            <Text className="text-muted-foreground text-sm">
                                                {span(minutes)}
                                            </Text>
                                        )}
                                        {/* A warning, never a refusal: the client
                                            sees a line that ran past what the card
                                            promised, and the crew still get to
                                            report what happened. */}
                                        {over ? (
                                            <Text className="text-warning text-sm">
                                                {`Longer than the ${span(line.maximum_minutes as number)} this rate covers. They agreed to that ceiling, so say why below.`}
                                            </Text>
                                        ) : null}
                                        <FieldError
                                            message={errorFor(`lines.${at}.minutes`)}
                                        />
                                    </>
                                ) : null}

                                {!hourly && line.unit !== null ? (
                                    <>
                                        <Input
                                            value={
                                                said?.quantity === null ||
                                                said?.quantity === undefined
                                                    ? ''
                                                    : String(said.quantity)
                                            }
                                            onChangeText={(typed) =>
                                                say(line.label, { quantity: whole(typed) })
                                            }
                                            inputMode="numeric"
                                            editable={!busy}
                                            placeholder={`How many ${line.unit}?`}
                                            accessibilityLabel={`How many ${line.unit} for ${line.label}`}
                                            invalid={Boolean(errorFor(`lines.${at}.quantity`))}
                                        />
                                        <FieldError
                                            message={errorFor(`lines.${at}.quantity`)}
                                        />
                                    </>
                                ) : null}

                                {line.unit === null ? (
                                    <Text className="text-muted-foreground text-sm">
                                        One price for the whole job. Nothing to count.
                                    </Text>
                                ) : null}
                            </Card>
                        );
                    })}

                    <Card className="gap-2">
                        <Label>Anything to add?</Label>
                        <Input
                            value={note}
                            onChangeText={setNote}
                            multiline
                            textAlignVertical="top"
                            className="h-20 py-3"
                            editable={!busy}
                            placeholder="Replaced the capacitor as well."
                            accessibilityLabel="Anything to add"
                        />
                        <Text className="text-muted-foreground text-sm">
                            The client reads this with the finished job.
                        </Text>
                    </Card>

                    {booking !== null ? (
                        <Card className="gap-1">
                            <Label>What they are billed</Label>
                            <Text className="text-brand text-2xl font-bold">
                                {total === null ? 'Not yet' : peso(total)}
                            </Text>
                            {total === null ? (
                                <Text className="text-muted-foreground text-sm">
                                    Fill in every line above and the figure appears here.
                                </Text>
                            ) : (
                                <Text className="text-muted-foreground text-sm">
                                    {`Hours are rounded ${rounding.label.toLowerCase()}, the way this offer is priced.`}
                                </Text>
                            )}
                        </Card>
                    ) : null}

                    <Button
                        variant="brand"
                        busy={busy}
                        disabled={booking === null}
                        onPress={() => setFinishing(true)}
                    >
                        Finish this job
                    </Button>

                    <ConfirmDialog
                        open={finishing}
                        title="Finish this job?"
                        body={
                            total === null
                                ? 'Some lines are still unaccounted for, so no figure is settled yet. You cannot come back and change this.'
                                : `${booking?.client?.nickname ?? 'The client'} will be billed ${peso(total)}. You cannot come back and change this.`
                        }
                        confirm="Finish it"
                        dismiss="Not yet"
                        busy={busy}
                        onConfirm={() => {
                            setFinishing(false);
                            void finish();
                        }}
                        onDismiss={() => setFinishing(false)}
                    />
                </ScrollView>
            </KeyboardAvoiding>
        </SafeAreaView>
    );
}

/**
 * What every row opens holding.
 *
 * The counts the client already gave carry over, because a line they counted is
 * one nobody has to count again. The elapsed span pre-fills the hours **only
 * when there is exactly one hourly line** -- time on site cannot be split
 * across two of them, and a guess spread over both would be worse than a blank.
 */
function seed(booking: Booking): Record<string, Accounted> {
    const hourly = booking.job?.hourly_label ?? null;
    const elapsed = booking.job?.elapsed_minutes ?? null;

    return booking.lines.reduce<Record<string, Accounted>>((held, line) => {
        held[line.label] = {
            label: line.label,
            quantity: line.unit !== null && line.unit !== 'hour' ? line.quantity : null,
            minutes: line.label === hourly ? elapsed : null,
        };

        return held;
    }, {});
}
