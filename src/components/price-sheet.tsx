import Plus from 'lucide-react-native/icons/plus';
import X from 'lucide-react-native/icons/x';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { PesoInput } from '@/components/peso-input';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { KeyboardAvoiding } from '@/components/ui/keyboard-avoiding';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { peso } from '@/lib/money';

/** Mirrors RateLine::HOUR on the server. */
const HOUR = 'hour';

/** One line being priced, with a key React can hold across a removal. */
type Row = {
    key: string;
    label: string;
    amount: number | null;
    unit: string | null;
    quantity: string;
};

export type PricedLine = {
    label: string;
    amount: number;
    unit: string | null;
    quantity: number | null;
};

function blank(): Row {
    return {
        key: `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
        label: '',
        amount: null,
        unit: null,
        quantity: '',
    };
}

/**
 * Put a price on one job.
 *
 * Deliberately the rate-row shape from the listing editor rather than a new
 * idiom: pricing one job should look like pricing a listing, because it is the
 * same act against a different subject. An hourly line agrees a **rate**, so the
 * total goes unstated rather than guessed.
 */
export function PriceSheet({
    open,
    title,
    revising,
    busy = false,
    errorFor,
    onSend,
    onDismiss,
}: {
    open: boolean;
    title: string;
    /** A price that replaces an earlier one has to say why. */
    revising: boolean;
    busy?: boolean;
    errorFor: (field: string) => string | undefined;
    onSend: (lines: PricedLine[], note: string | null) => void;
    onDismiss: () => void;
}) {
    const [rows, setRows] = useState<Row[]>(() => [blank()]);
    const [note, setNote] = useState('');

    const setRow = (key: string, patch: Partial<Row>) =>
        setRows((held) => held.map((row) => (row.key === key ? { ...row, ...patch } : row)));

    const priced = rows
        .filter((row) => row.label.trim() !== '' && row.amount !== null)
        .map((row) => ({
            label: row.label.trim(),
            amount: row.amount ?? 0,
            unit: row.unit,
            quantity: /^\d+$/.test(row.quantity) ? Number(row.quantity) : null,
        }));

    // Null whenever any line agrees a rate rather than a figure, the same rule
    // BookedLines::total() follows on the server.
    const total = priced.some((line) => line.unit === HOUR || (line.unit !== null && line.quantity === null))
        ? null
        : priced.reduce((sum, line) => sum + line.amount * (line.quantity ?? 1), 0);

    return (
        <Modal
            visible={open}
            transparent
            animationType="slide"
            statusBarTranslucent
            onRequestClose={onDismiss}
        >
            <View className="flex-1 justify-end bg-black/60">
                <KeyboardAvoiding>
                    <View className="bg-card border-border max-h-[85%] gap-4 rounded-t-2xl border p-6">
                        <View className="flex-row items-start justify-between gap-3">
                            <Text className="flex-1 text-lg font-bold">{title}</Text>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Close"
                                onPress={onDismiss}
                            >
                                <X size={20} />
                            </Pressable>
                        </View>

                        <ScrollView
                            contentContainerClassName="gap-4"
                            keyboardShouldPersistTaps="handled"
                        >
                            {rows.map((row, index) => (
                                <View key={row.key} className="border-border gap-2 rounded-xl border p-3">
                                    <View className="flex-row items-start gap-2">
                                        <View className="flex-1 gap-2">
                                            <Label>{`Line ${index + 1}`}</Label>
                                            <Input
                                                value={row.label}
                                                onChangeText={(label) => setRow(row.key, { label })}
                                                placeholder="The whole job"
                                                editable={!busy}
                                                accessibilityLabel={`What line ${index + 1} covers`}
                                            />
                                            <FieldError
                                                message={errorFor(`lines.${index}.label`)}
                                            />
                                        </View>
                                        {rows.length > 1 ? (
                                            <Pressable
                                                accessibilityRole="button"
                                                accessibilityLabel={`Remove line ${index + 1}`}
                                                disabled={busy}
                                                onPress={() =>
                                                    setRows((held) =>
                                                        held.filter((one) => one.key !== row.key),
                                                    )
                                                }
                                                className="pt-8"
                                            >
                                                <X size={18} />
                                            </Pressable>
                                        ) : null}
                                    </View>

                                    <PesoInput
                                        value={row.amount}
                                        onChange={(amount) => setRow(row.key, { amount })}
                                        disabled={busy}
                                        accessibilityLabel={`Price of line ${index + 1}`}
                                    />
                                    <FieldError message={errorFor(`lines.${index}.amount`)} />

                                    <View className="flex-row flex-wrap gap-2">
                                        {[null, HOUR].map((option) => (
                                            <Pressable
                                                key={option ?? 'flat'}
                                                accessibilityRole="button"
                                                accessibilityLabel={
                                                    option === null
                                                        ? `Line ${index + 1} is one price`
                                                        : `Line ${index + 1} is per hour`
                                                }
                                                disabled={busy}
                                                onPress={() => setRow(row.key, { unit: option })}
                                                className={
                                                    row.unit === option
                                                        ? 'border-brand bg-brand-subtle rounded-full border px-3 py-2'
                                                        : 'border-border bg-card rounded-full border px-3 py-2'
                                                }
                                            >
                                                <Text className="text-sm font-medium">
                                                    {option === null ? 'One price' : 'Per hour'}
                                                </Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                </View>
                            ))}

                            <Button
                                variant="outline"
                                disabled={busy}
                                icon={<Plus size={16} />}
                                onPress={() => setRows((held) => [...held, blank()])}
                            >
                                Add a line
                            </Button>

                            {revising ? (
                                <View className="gap-2">
                                    <Label>Why has the price changed?</Label>
                                    <Input
                                        value={note}
                                        onChangeText={setNote}
                                        placeholder="The roof needs scaffolding after all."
                                        multiline
                                        numberOfLines={3}
                                        className="h-20"
                                        editable={!busy}
                                        accessibilityLabel="Why the price changed"
                                    />
                                    <Text className="text-muted-foreground text-sm">
                                        The client is being asked for a different figure, so they
                                        are shown this above it.
                                    </Text>
                                    <FieldError message={errorFor('note')} />
                                </View>
                            ) : null}

                            <FieldError message={errorFor('lines')} />

                            <View className="border-border flex-row items-baseline gap-2 border-t pt-3">
                                <Text className="flex-1 font-medium">
                                    {total === null ? 'They agree a rate' : 'They agree'}
                                </Text>
                                <Text className="text-lg font-bold tabular-nums">
                                    {total === null ? '' : peso(total)}
                                </Text>
                            </View>
                        </ScrollView>

                        <Button
                            variant="brand"
                            busy={busy}
                            disabled={priced.length === 0}
                            onPress={() => onSend(priced, note.trim() || null)}
                        >
                            Send this price
                        </Button>
                    </View>
                </KeyboardAvoiding>
            </View>
        </Modal>
    );
}
