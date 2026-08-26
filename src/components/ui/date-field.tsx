import DateTimePicker from '@react-native-community/datetimepicker';
import Calendar from 'lucide-react-native/icons/calendar';
import { useColorScheme } from 'nativewind';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import palette from '@/theme/palette';

type Props = {
    /** The date as the server takes it: YYYY-MM-DD, or empty when unset. */
    value: string;
    onChange: (value: string) => void;
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
 */
export function DateField({
    value,
    onChange,
    placeholder = 'Choose a date',
    minimumDate,
    maximumDate,
    disabled = false,
    invalid = false,
}: Props) {
    const [open, setOpen] = useState(false);
    const { colorScheme } = useColorScheme();
    const colours = palette[colorScheme ?? 'light'];

    const held = parse(value);

    return (
        <View>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={value === '' ? placeholder : `Change the date, currently ${value}`}
                disabled={disabled}
                onPress={() => setOpen(true)}
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

            {open ? (
                <>
                    <DateTimePicker
                        value={held ?? maximumDate ?? new Date()}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        minimumDate={minimumDate}
                        maximumDate={maximumDate}
                        onChange={(event, picked) => {
                            // Android closes itself and reports dismissal; iOS
                            // stays up until its own Done is pressed.
                            if (Platform.OS !== 'ios') {
                                setOpen(false);
                            }

                            if (event.type === 'dismissed' || !picked) {
                                return;
                            }

                            onChange(stamp(picked));
                        }}
                    />

                    {Platform.OS === 'ios' ? (
                        <Button variant="outline" onPress={() => setOpen(false)}>
                            Done
                        </Button>
                    ) : null}
                </>
            ) : null}
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
