import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import { peso, rateLine, workings } from '@/lib/money';
import type { Quotation } from '@/lib/types';

/**
 * Word the validity the way a person would say it.
 *
 * A raw date makes the reader count days; the number of days is the thing they
 * are actually deciding on.
 */
function validity(quotation: Quotation): string {
    if (quotation.has_lapsed) {
        return 'This price has run out.';
    }

    if (quotation.days_left === 0) {
        return 'Good until the end of today.';
    }

    if (quotation.days_left === 1) {
        return 'Good until tomorrow.';
    }

    return `Good for ${quotation.days_left} more days.`;
}

/**
 * A provider's price, read as a document rather than a form.
 *
 * The figure leads, the lines itemise beneath it, and the two actions are
 * weighted -- accepting books the work and turning it down does not, so they are
 * not equal choices and are not drawn as though they were.
 */
export function QuotationCard({
    quotation,
    busy = false,
    onAccept,
    onDecline,
}: {
    quotation: Quotation;
    busy?: boolean;
    onAccept?: () => void;
    onDecline?: () => void;
}) {
    const answerable = quotation.is_answerable && onAccept !== undefined;

    return (
        <Card className="gap-4">
            <View className="flex-row items-start justify-between gap-3">
                <View className="min-w-0 flex-1 gap-1">
                    <Text className="text-muted-foreground text-xs font-bold uppercase">
                        {quotation.provider.name}
                    </Text>
                    <Text className="text-3xl font-bold tabular-nums">
                        {quotation.total === null ? 'By the hour' : peso(quotation.total)}
                    </Text>
                </View>
                <StatusPill tone={quotation.status.tone}>{quotation.status.wording}</StatusPill>
            </View>

            {/* A replacement price says why before it says what. Somebody asked
                to pay more than they were told is owed the reason first. */}
            {quotation.note ? (
                <View className="border-warning/40 bg-warning-subtle rounded-lg border p-3">
                    <Text className="text-sm">{quotation.note}</Text>
                </View>
            ) : null}

            <View className="gap-2">
                {quotation.lines.map((line, at) => (
                    <View key={`${line.label}-${at}`} className="flex-row items-baseline gap-2">
                        <Text className="flex-1 text-sm">{line.label}</Text>
                        <Text className="text-sm font-medium tabular-nums">
                            {workings(line, line.quantity) ?? rateLine(line)}
                        </Text>
                    </View>
                ))}
            </View>

            <Text className="text-muted-foreground text-sm">{quotation.basis.reason}</Text>

            <Text
                className={
                    quotation.has_lapsed
                        ? 'text-warning text-sm'
                        : 'text-muted-foreground text-sm'
                }
            >
                {validity(quotation)}
            </Text>

            {answerable ? (
                <View className="gap-2">
                    <Button variant="brand" onPress={onAccept} busy={busy}>
                        Accept and book
                    </Button>
                    {onDecline ? (
                        <Button variant="ghost" onPress={onDecline} disabled={busy}>
                            Turn it down
                        </Button>
                    ) : null}
                </View>
            ) : null}
        </Card>
    );
}
