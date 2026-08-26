import DateTimePicker from '@react-native-community/datetimepicker';
import Calendar from 'lucide-react-native/icons/calendar';
import { useColorScheme } from 'nativewind';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import palette from '@/theme/palette';

type Props = {
    /** The date as the server takes it: YYYY-MM-DD, or empty when unset. */
    value: string;
    onChange: (value: string) => void;
    /** What an unset field shows. Defaults to the format the picker fills in. */
    placeholder?: string;
    minimumDate?: Date;
    maximumDate?: Date;
    disabled?: boolean;
    invalid?: boolean;
};

/**
 * A date, chosen from the platform's own picker rather than typed.
 *
 * Held as YYYY-MM-DD because that is what the server takes, and built from the
 * local date parts rather than `toISOString()`, which converts to UTC and moves
 * a Manila date back a day for anything before 08:00.
 *
 * iOS keeps its wheel in a Sheet, like every other choice in this app. Left
 * inline it renders inside whatever ScrollView it happens to be in, where its
 * own height is not guaranteed and it can arrive with none at all. Android
 * ignores the sheet: its picker is already a system dialog, and putting one
 * inside a modal stacks two.
 */
export function DateField({
    value,
    onChange,
    placeholder = 'DD Month YYYY',
    minimumDate,
    maximumDate,
    disabled = false,
    invalid = false,
}: Props) {
    const [open, setOpen] = useState(false);
    const { colorScheme } = useColorScheme();
    const colours = palette[colorScheme ?? 'light'];

    const held = parse(value);
    const opensAt = held ?? maximumDate ?? new Date();

    // The wheel reports every turn; on iOS nothing is written until Done, so a
    // half-scrolled year is not committed and Cancel has something to undo to.
    const [pending, setPending] = useState(opensAt);

    const show = () => {
        setPending(held ?? maximumDate ?? new Date());
        setOpen(true);
    };

    const picker = (inSheet: boolean) => (
        <DateTimePicker
            value={inSheet ? pending : opensAt}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            themeVariant={colorScheme ?? 'light'}
            onChange={(event, picked) => {
                if (inSheet) {
                    if (picked) {
                        setPending(picked);
                    }

                    return;
                }

                // Android's dialog closes itself and reports the dismissal.
                setOpen(false);

                if (event.type === 'dismissed' || !picked) {
                    return;
                }

                onChange(stamp(picked));
            }}
        />
    );

    return (
        <View>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                    value === '' ? placeholder : `Change the date, currently ${readable(held)}`
                }
                disabled={disabled}
                onPress={show}
                className={cn(
                    'border-input bg-card h-12 flex-row items-center gap-2.5 rounded-lg border px-3',
                    invalid && 'border-destructive',
                    disabled && 'opacity-50',
                )}
            >
                <Calendar color={colours['muted-foreground']} size={18} />
                <Text className={cn('text-base', value === '' && 'text-muted-foreground')}>
                    {value === '' ? placeholder : readable(held)}
                </Text>
            </Pressable>

            {Platform.OS === 'ios' ? (
                <Sheet open={open} onDismiss={() => setOpen(false)} label="Choose a date">
                    <Text className="text-base font-bold">Choose a date</Text>

                    {open ? picker(true) : null}

                    <Button
                        onPress={() => {
                            onChange(stamp(pending));
                            setOpen(false);
                        }}
                    >
                        Done
                    </Button>

                    <Button variant="ghost" onPress={() => setOpen(false)}>
                        Cancel
                    </Button>
                </Sheet>
            ) : (
                open ? picker(false) : null
            )}
        </View>
    );
}

/** Read a stored YYYY-MM-DD back, or null when there is nothing to read. */
function parse(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return null;
    }

    const [year, month, day] = value.split('-').map(Number);
    const held = new Date(year, month - 1, day);

    return Number.isNaN(held.getTime()) ? null : held;
}

/** Write a date as the server takes it, in local time. */
function stamp(date: Date): string {
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');

    return `${date.getFullYear()}-${month}-${day}`;
}

/** Say a date the way the rest of the app says one. */
function readable(date: Date | null): string {
    return date === null
        ? ''
        : date.toLocaleDateString('en-PH', { day: 'numeric', month: 'long', year: 'numeric' });
}
