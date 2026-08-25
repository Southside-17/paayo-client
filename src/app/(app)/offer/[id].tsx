import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import ArrowDown from 'lucide-react-native/icons/arrow-down';
import ArrowUp from 'lucide-react-native/icons/arrow-up';
import Plus from 'lucide-react-native/icons/plus';
import X from 'lucide-react-native/icons/x';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { FormMessage } from '@/components/form-message';
import { PesoInput } from '@/components/peso-input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { KeyboardAvoiding } from '@/components/ui/keyboard-avoiding';
import { Label } from '@/components/ui/label';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useSession } from '@/lib/session';
import type { ProviderListing, RateLine } from '@/lib/types';
import { useSubmit } from '@/lib/use-submit';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/lib/workspace';

/**
 * The four ways to charge. Mirrors PricingMethod on the server; change both.
 */
const METHODS = [
    { value: 'per_job', label: 'Per job', hint: 'One price for the whole job.' },
    { value: 'per_unit', label: 'Per unit', hint: 'A price for each of something you count.' },
    { value: 'per_hour', label: 'Per hour', hint: 'A rate, and you count the hours at the end.' },
    { value: 'on_request', label: 'On request', hint: 'No published price. You quote each job.' },
] as const;

/** Mirrors RateLine::HOUR on the server. */
const HOUR = 'hour';

/**
 * How minutes worked become hours charged. Mirrors App\Enums\HourRounding.
 *
 * Rounding up to the whole hour is the trade convention, so it leads and it is
 * the default; the other two are for a business that would rather bill closer to
 * the truth.
 */
const ROUNDINGS: { value: 'minute' | 'half_hour' | 'hour'; label: string; hint: string }[] = [
    { value: 'hour', label: 'To the hour', hint: '3h 10m on site bills as 4 hours.' },
    { value: 'half_hour', label: 'To the half hour', hint: '3h 10m on site bills as 3½ hours.' },
    { value: 'minute', label: 'To the minute', hint: '3h 10m on site bills as 3h 10m.' },
];

/**
 * Offered when a trade names no vocabulary of its own. Every trade counts in
 * something, so this is the floor rather than a default worth curating.
 */
const FALLBACK = ['unit'];

type Row = RateLine & { key: string };

function blankRow(method: string): Row {
    const hourly = method === 'per_hour';

    return {
        key: `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
        label: '',
        amount: 0,
        unit: hourly ? HOUR : method === 'per_unit' ? 'unit' : null,
        estimated_minutes: hourly ? 120 : null,
        maximum_minutes: hourly ? 240 : null,
        is_active: true,
    };
}

/** Give a method the unit and minutes it demands, so a switch stays valid. */
function refit(row: Row, method: string): Row {
    const hourly = method === 'per_hour';

    return {
        ...row,
        unit: hourly ? HOUR : method === 'per_unit' ? (row.unit === HOUR ? 'unit' : row.unit ?? 'unit') : null,
        estimated_minutes: hourly ? (row.estimated_minutes ?? 120) : null,
        maximum_minutes: hourly ? (row.maximum_minutes ?? 240) : null,
    };
}

/**
 * What this business charges for one service, and what it asks a client first.
 */
export default function ProviderListingEdit() {
    const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
    const session = useSession();
    const { staff } = useWorkspace();
    const { busy, message, errorFor, submit } = useSubmit();
    const [listing, setListing] = useState<ProviderListing | null>(null);
    const [failure, setFailure] = useState<string | null>(null);
    const [method, setMethod] = useState('per_job');
    const [many, setMany] = useState(false);
    // The trade convention, and the default the server carries too.
    const [rounding, setRounding] = useState<'minute' | 'half_hour' | 'hour'>('hour');
    const [rows, setRows] = useState<Row[]>([]);
    const [questions, setQuestions] = useState<{ key: string; text: string }[]>([]);
    const [pausing, setPausing] = useState(false);
    const [loaded, setLoaded] = useState(false);

    const mayEdit = staff?.permissions.includes('listing:edit') ?? false;
    const provider = staff?.provider.id;

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;

    useFocusEffect(
        useCallback(() => {
            if (!authenticatedRequest || !provider || loaded) {
                return;
            }

            void authenticatedRequest<{ data: ProviderListing[] }>(
                `/providers/${provider}/listings`,
            )
                .then(({ data }) => {
                    const found = data.find((one) => one.id === id) ?? null;

                    if (found === null) {
                        setFailure('That offer is no longer on this business.');

                        return;
                    }

                    setListing(found);
                    setMethod(found.pricing_method.value);
                    setMany(found.allows_many_lines);
                    // Read defensively, the way user.suspension is: the app
                    // ships on its own schedule, and an older server that omits
                    // the field must not take the whole editor down.
                    setRounding(found.hour_rounding?.value ?? 'hour');
                    setRows(found.rates.map((line, at) => ({ ...line, key: `r${at}` })));
                    setQuestions(found.intake.map((text, at) => ({ text, key: `q${at}` })));
                    setLoaded(true);
                })
                .catch(() => setFailure('Could not reach Paayo. Try again.'));
        }, [authenticatedRequest, provider, id, loaded]),
    );

    const onRequest = method === 'on_request';
    const hourly = method === 'per_hour';
    const trade = listing?.service.trade;
    const suggested = trade !== undefined && trade.units.length > 0 ? trade.units : FALLBACK;
    const paused = listing?.paused_at !== null && listing?.paused_at !== undefined;

    const setRow = (key: string, patch: Partial<Row>) =>
        setRows((held) => held.map((row) => (row.key === key ? { ...row, ...patch } : row)));

    const moveRow = (key: string, by: -1 | 1) =>
        setRows((held) => {
            const from = held.findIndex((row) => row.key === key);
            const to = from + by;

            if (from < 0 || to < 0 || to >= held.length) {
                return held;
            }

            const next = [...held];
            [next[from], next[to]] = [next[to], next[from]];

            return next;
        });

    const save = () =>
        submit(async () => {
            if (session.status !== 'authenticated' || !provider) {
                return;
            }

            const { data } = await session.authenticatedRequest<{ data: ProviderListing }>(
                `/providers/${provider}/listings/${id}`,
                {
                    method: 'PATCH',
                    body: {
                        pricing_method: method,
                        allows_many_lines: onRequest ? false : many,
                        hour_rounding: rounding,
                        description: listing?.description ?? null,
                        rates: onRequest
                            ? []
                            : rows.map(({ key, ...line }) => line),
                        intake: questions.map((one) => one.text),
                    },
                },
            );

            setListing(data);
            router.back();
        });

    const hold = (resume: boolean) =>
        submit(async () => {
            if (session.status !== 'authenticated' || !provider) {
                return;
            }

            const { data } = await session.authenticatedRequest<{ data: ProviderListing }>(
                `/providers/${provider}/listings/${id}/pause`,
                { method: resume ? 'DELETE' : 'POST' },
            );

            setListing(data);
            setPausing(false);
        });

    // This screen sits on the app stack rather than in the business tab group,
    // so it holds the gate that group's layout would otherwise hold for it.
    if (!staff) {
        return <Redirect href="/" />;
    }

    return (
        <SafeAreaView className="bg-background flex-1">
            <KeyboardAvoiding className="flex-1">
                <ScrollView
                    contentContainerClassName="gap-5 p-6"
                    keyboardShouldPersistTaps="handled"
                >
                    <BackButton label="Services" />
                    <ScreenHeader
                        eyebrow={listing?.service.trade?.name}
                        title={name ?? listing?.service.name ?? 'Offer'}
                    />

                    <FormMessage message={message ?? failure} />

                    {listing === null && failure === null ? (
                        <>
                            <Card className="gap-3">
                                <Skeleton className="h-5 w-40" />
                                <Skeleton className="h-12 w-full" />
                            </Card>
                            <Card className="gap-3">
                                <Skeleton className="h-12 w-full" />
                            </Card>
                        </>
                    ) : null}

                    {listing && !mayEdit ? (
                        <Card className="gap-2">
                            <Label>Only an owner can change prices</Label>
                            <Text className="text-muted-foreground text-sm">
                                You can see what the business charges. Ask an owner to change
                                it.
                            </Text>
                        </Card>
                    ) : null}

                    {listing ? (
                        <>
                            <Card className="gap-3">
                                <Label>How do you charge for this?</Label>
                                <View className="flex-row flex-wrap gap-2">
                                    {METHODS.map((option) => (
                                        <Pressable
                                            key={option.value}
                                            accessibilityRole="button"
                                            accessibilityState={{ selected: method === option.value }}
                                            disabled={!mayEdit || busy}
                                            onPress={() => {
                                                setMethod(option.value);
                                                setRows((held) =>
                                                    option.value === 'on_request'
                                                        ? []
                                                        : held.map((row) => refit(row, option.value)),
                                                );

                                                if (option.value === 'on_request') {
                                                    setMany(false);
                                                }
                                            }}
                                            className={cn(
                                                'rounded-full border px-3 py-2',
                                                method === option.value
                                                    ? 'border-brand bg-brand-subtle'
                                                    : 'border-border bg-card',
                                            )}
                                        >
                                            <Text
                                                className={cn(
                                                    'text-sm font-medium',
                                                    method === option.value && 'text-brand',
                                                )}
                                            >
                                                {option.label}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                                <Text className="text-muted-foreground text-sm">
                                    {METHODS.find((one) => one.value === method)?.hint}
                                </Text>
                                <FieldError message={errorFor('pricing_method')} />
                            </Card>

                            {onRequest ? null : (
                                <Card className="gap-3">
                                    <View className="flex-row items-start justify-between gap-4">
                                        <View className="flex-1 gap-1">
                                            <Label>Can a client pick more than one?</Label>
                                            <Text className="text-muted-foreground text-sm">
                                                {many
                                                    ? 'A menu. They order several of these in one visit, with a count on each.'
                                                    : 'Alternatives. They choose the one that describes the work.'}
                                            </Text>
                                        </View>
                                        <Switch
                                            value={many}
                                            onValueChange={setMany}
                                            disabled={!mayEdit || busy}
                                            accessibilityLabel="Can a client pick more than one?"
                                        />
                                    </View>
                                    <FieldError message={errorFor('allows_many_lines')} />
                                </Card>
                            )}

                            {hourly ? (
                                <Card className="gap-3">
                                    <Label>How do you round the hours?</Label>
                                    <Text className="text-muted-foreground text-sm">
                                        Always rounded up, and settled when the job is done. This
                                        is fixed onto each booking as it is placed, so changing it
                                        never re-prices work already agreed.
                                    </Text>
                                    <View className="gap-2">
                                        {ROUNDINGS.map((option) => (
                                            <Pressable
                                                key={option.value}
                                                accessibilityRole="radio"
                                                accessibilityState={{
                                                    checked: rounding === option.value,
                                                }}
                                                disabled={!mayEdit || busy}
                                                onPress={() => setRounding(option.value)}
                                                className={cn(
                                                    'rounded-lg border p-3',
                                                    rounding === option.value
                                                        ? 'border-brand bg-brand-subtle'
                                                        : 'border-border',
                                                )}
                                            >
                                                <Text className="text-sm font-semibold">
                                                    {option.label}
                                                </Text>
                                                <Text className="text-muted-foreground text-xs">
                                                    {option.hint}
                                                </Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                    <FieldError message={errorFor('hour_rounding')} />
                                </Card>
                            ) : null}

                            {onRequest ? null : (
                                <Card className="gap-4">
                                    <Label>What do you charge?</Label>

                                    {rows.length === 0 ? (
                                        <Text className="text-muted-foreground text-sm">
                                            No prices yet, so clients cannot see this offer.
                                        </Text>
                                    ) : null}

                                    {rows.map((row, index) => (
                                        <View
                                            key={row.key}
                                            className={cn(
                                                'gap-2 rounded-lg border p-3',
                                                row.is_active
                                                    ? 'border-border'
                                                    : 'border-border border-dashed opacity-60',
                                            )}
                                        >
                                            <Input
                                                value={row.label}
                                                onChangeText={(label) => setRow(row.key, { label })}
                                                editable={mayEdit && !busy}
                                                placeholder="Split type, up to 2.5HP"
                                                accessibilityLabel={`What line ${index + 1} covers`}
                                            />
                                            <FieldError message={errorFor(`rates.${index}.label`)} />

                                            <PesoInput
                                                value={row.amount}
                                                onChange={(amount) =>
                                                    setRow(row.key, { amount: amount ?? 0 })
                                                }
                                                disabled={!mayEdit || busy}
                                                invalid={Boolean(errorFor(`rates.${index}.amount`))}
                                                accessibilityLabel={`Price of line ${index + 1}`}
                                            />
                                            <FieldError message={errorFor(`rates.${index}.amount`)} />

                                            {method === 'per_unit' ? (
                                                <>
                                                    <Input
                                                        value={row.unit ?? ''}
                                                        onChangeText={(unit) =>
                                                            setRow(row.key, { unit: unit || null })
                                                        }
                                                        editable={mayEdit && !busy}
                                                        placeholder="unit"
                                                        accessibilityLabel={`What line ${index + 1} is charged per`}
                                                    />
                                                    <View className="flex-row flex-wrap gap-2">
                                                        {suggested.map((noun) => (
                                                            <Pressable
                                                                key={noun}
                                                                accessibilityRole="button"
                                                                disabled={!mayEdit || busy}
                                                                onPress={() =>
                                                                    setRow(row.key, { unit: noun })
                                                                }
                                                                className="border-border bg-card rounded-full border px-3 py-1"
                                                            >
                                                                <Text className="text-sm">
                                                                    {noun}
                                                                </Text>
                                                            </Pressable>
                                                        ))}
                                                    </View>
                                                    <FieldError
                                                        message={errorFor(`rates.${index}.unit`)}
                                                    />
                                                </>
                                            ) : null}

                                            {hourly ? (
                                                <View className="flex-row gap-2">
                                                    <View className="flex-1 gap-1">
                                                        <Text className="text-muted-foreground text-sm">
                                                            Usually takes (minutes)
                                                        </Text>
                                                        <Input
                                                            value={
                                                                row.estimated_minutes === null
                                                                    ? ''
                                                                    : String(row.estimated_minutes)
                                                            }
                                                            onChangeText={(text) =>
                                                                setRow(row.key, {
                                                                    estimated_minutes:
                                                                        text.replace(/[^0-9]/g, '') === ''
                                                                            ? null
                                                                            : Number(
                                                                                  text.replace(/[^0-9]/g, ''),
                                                                              ),
                                                                })
                                                            }
                                                            inputMode="numeric"
                                                            editable={mayEdit && !busy}
                                                            accessibilityLabel={`Usual minutes for line ${index + 1}`}
                                                        />
                                                    </View>
                                                    <View className="flex-1 gap-1">
                                                        <Text className="text-muted-foreground text-sm">
                                                            Stops at (minutes)
                                                        </Text>
                                                        <Input
                                                            value={
                                                                row.maximum_minutes === null
                                                                    ? ''
                                                                    : String(row.maximum_minutes)
                                                            }
                                                            onChangeText={(text) =>
                                                                setRow(row.key, {
                                                                    maximum_minutes:
                                                                        text.replace(/[^0-9]/g, '') === ''
                                                                            ? null
                                                                            : Number(
                                                                                  text.replace(/[^0-9]/g, ''),
                                                                              ),
                                                                })
                                                            }
                                                            inputMode="numeric"
                                                            editable={mayEdit && !busy}
                                                            accessibilityLabel={`Longest minutes for line ${index + 1}`}
                                                        />
                                                    </View>
                                                </View>
                                            ) : null}

                                            {hourly ? (
                                                <>
                                                    <FieldError
                                                        message={errorFor(
                                                            `rates.${index}.estimated_minutes`,
                                                        )}
                                                    />
                                                    <FieldError
                                                        message={errorFor(
                                                            `rates.${index}.maximum_minutes`,
                                                        )}
                                                    />
                                                </>
                                            ) : null}

                                            <View className="flex-row items-center justify-between gap-2 pt-1">
                                                <View className="flex-row items-center gap-2">
                                                    <Switch
                                                        value={row.is_active}
                                                        onValueChange={(is_active) =>
                                                            setRow(row.key, { is_active })
                                                        }
                                                        disabled={!mayEdit || busy}
                                                        accessibilityLabel={`Offer line ${index + 1}`}
                                                    />
                                                    <Text className="text-muted-foreground text-sm">
                                                        {row.is_active ? 'Offered' : 'Not offered'}
                                                    </Text>
                                                </View>
                                                <View className="flex-row items-center gap-1">
                                                    <Pressable
                                                        accessibilityRole="button"
                                                        accessibilityLabel={`Move line ${index + 1} up`}
                                                        disabled={!mayEdit || busy || index === 0}
                                                        onPress={() => moveRow(row.key, -1)}
                                                        className="p-2"
                                                    >
                                                        <ArrowUp size={16} />
                                                    </Pressable>
                                                    <Pressable
                                                        accessibilityRole="button"
                                                        accessibilityLabel={`Move line ${index + 1} down`}
                                                        disabled={
                                                            !mayEdit || busy || index === rows.length - 1
                                                        }
                                                        onPress={() => moveRow(row.key, 1)}
                                                        className="p-2"
                                                    >
                                                        <ArrowDown size={16} />
                                                    </Pressable>
                                                    <Pressable
                                                        accessibilityRole="button"
                                                        accessibilityLabel={`Remove line ${index + 1}`}
                                                        disabled={!mayEdit || busy}
                                                        onPress={() =>
                                                            setRows((held) =>
                                                                held.filter(
                                                                    (one) => one.key !== row.key,
                                                                ),
                                                            )
                                                        }
                                                        className="p-2"
                                                    >
                                                        <X size={16} />
                                                    </Pressable>
                                                </View>
                                            </View>
                                        </View>
                                    ))}

                                    <FieldError message={errorFor('rates')} />

                                    {mayEdit ? (
                                        <Button
                                            variant="outline"
                                            disabled={busy || rows.length >= 25}
                                            icon={<Plus size={16} />}
                                            onPress={() =>
                                                setRows((held) => [...held, blankRow(method)])
                                            }
                                        >
                                            Add a price
                                        </Button>
                                    ) : null}
                                </Card>
                            )}

                            <Card className="gap-3">
                                <View className="gap-1">
                                    <Label>What should a client be asked?</Label>
                                    <Text className="text-muted-foreground text-sm">
                                        Ask for what you need to know, not for what you charge
                                        for. Anything that changes the price belongs on a price
                                        above.
                                    </Text>
                                </View>

                                {questions.map((one, index) => (
                                    <View key={one.key} className="flex-row items-start gap-2">
                                        <View className="flex-1">
                                            <Input
                                                value={one.text}
                                                onChangeText={(text) =>
                                                    setQuestions((held) =>
                                                        held.map((q) =>
                                                            q.key === one.key ? { ...q, text } : q,
                                                        ),
                                                    )
                                                }
                                                editable={mayEdit && !busy}
                                                placeholder="Which floor is the unit on?"
                                                accessibilityLabel={`Question ${index + 1}`}
                                            />
                                        </View>
                                        <Pressable
                                            accessibilityRole="button"
                                            accessibilityLabel={`Remove question ${index + 1}`}
                                            disabled={!mayEdit || busy}
                                            onPress={() =>
                                                setQuestions((held) =>
                                                    held.filter((q) => q.key !== one.key),
                                                )
                                            }
                                            className="p-2"
                                        >
                                            <X size={16} />
                                        </Pressable>
                                    </View>
                                ))}

                                <FieldError message={errorFor('intake')} />

                                {mayEdit ? (
                                    <Button
                                        variant="outline"
                                        disabled={busy || questions.length >= 10}
                                        icon={<Plus size={16} />}
                                        onPress={() =>
                                            setQuestions((held) => [
                                                ...held,
                                                { key: `n${held.length}-${Date.now()}`, text: '' },
                                            ])
                                        }
                                    >
                                        Add a question
                                    </Button>
                                ) : null}
                            </Card>

                            {mayEdit ? (
                                <View className="gap-2">
                                    <Button onPress={save} busy={busy}>
                                        Save
                                    </Button>
                                    <Button
                                        variant="outline"
                                        disabled={busy}
                                        onPress={() => (paused ? void hold(true) : setPausing(true))}
                                    >
                                        {paused ? 'Start taking work again' : 'Stop taking work'}
                                    </Button>
                                </View>
                            ) : null}
                        </>
                    ) : null}
                </ScrollView>
            </KeyboardAvoiding>

            <ConfirmDialog
                open={pausing}
                title="Stop taking work on this?"
                body="Clients will not see it until you start it again. Your prices and the areas you cover stay as they are."
                confirm="Stop taking work"
                dismiss="Keep it live"
                busy={busy}
                onConfirm={() => void hold(false)}
                onDismiss={() => setPausing(false)}
            />
        </SafeAreaView>
    );
}
