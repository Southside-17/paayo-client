import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormMessage } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useSession } from '@/lib/session';
import type { Address } from '@/lib/types';
import { useSubmit } from '@/lib/use-submit';

/**
 * The fields, in the order the console's address dialog fixes them.
 */
const FIELDS = [
    { key: 'unit', label: 'Unit / floor', required: false },
    { key: 'street', label: 'House no. & street', required: true },
    { key: 'subdivision', label: 'Subdivision', required: false },
    { key: 'barangay', label: 'Barangay', required: true },
    { key: 'city', label: 'City / municipality', required: true },
    { key: 'province', label: 'Province', required: true },
    { key: 'region', label: 'Region', required: false },
    { key: 'postal_code', label: 'Postal code', required: false },
] as const;

type Field = (typeof FIELDS)[number]['key'];

/**
 * Add or edit one address.
 */
export default function EditAddress() {
    const session = useSession();
    const { busy, message, errorFor, submit } = useSubmit();
    const { id } = useLocalSearchParams<{ id?: string }>();

    const [label, setLabel] = useState('');
    const [landmark, setLandmark] = useState('');
    const [fields, setFields] = useState<Record<Field, string>>({
        unit: '',
        street: '',
        subdivision: '',
        barangay: '',
        city: '',
        province: '',
        region: '',
        postal_code: '',
    });
    const [isDefault, setIsDefault] = useState(false);

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;

    const load = useCallback(async () => {
        if (!authenticatedRequest || id === undefined) {
            return;
        }

        const { data } = await authenticatedRequest<{ data: Address[] }>('/addresses');
        const address = data.find((candidate) => candidate.id === id);

        if (address === undefined) {
            return;
        }

        setLabel(address.label);
        setLandmark(address.landmark ?? '');
        setIsDefault(address.is_default);
        setFields({
            unit: address.unit ?? '',
            street: address.street,
            subdivision: address.subdivision ?? '',
            barangay: address.barangay,
            city: address.city,
            province: address.province,
            region: address.region ?? '',
            postal_code: address.postal_code ?? '',
        });
    }, [authenticatedRequest, id]);

    useEffect(() => {
        void submit(load);
    }, [load, submit]);

    if (session.status !== 'authenticated') {
        return null;
    }

    const save = () =>
        submit(async () => {
            const body = {
                label: label.trim(),
                landmark: landmark.trim() === '' ? null : landmark.trim(),
                is_default: isDefault,
                ...Object.fromEntries(
                    FIELDS.map(({ key }) => [key, fields[key].trim() === '' ? null : fields[key].trim()]),
                ),
            };

            await session.authenticatedRequest<unknown>(
                id === undefined ? '/addresses' : `/addresses/${id}`,
                { method: id === undefined ? 'POST' : 'PUT', body },
            );

            router.back();
        });

    return (
        <SafeAreaView className="bg-background flex-1">
            <KeyboardAvoidingView
                className="flex-1"
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView contentContainerClassName="gap-6 p-6" keyboardShouldPersistTaps="handled">
                    <View className="flex-row items-center justify-between">
                        <Text className="text-2xl font-bold">
                            {id === undefined ? 'Add address' : 'Edit address'}
                        </Text>
                        <Button variant="ghost" onPress={() => router.back()}>
                            Cancel
                        </Button>
                    </View>

                    <Text className="text-muted-foreground text-sm">
                        Where work should happen. This is separate from the address on a verified ID.
                    </Text>

                    <FormMessage message={message} />

                    <Card className="gap-3">
                        <View>
                            <Label>Label</Label>
                            <Input
                                value={label}
                                onChangeText={setLabel}
                                placeholder="Home, Work, Condo"
                                invalid={Boolean(errorFor('label'))}
                            />
                            <FieldError message={errorFor('label')} />
                        </View>

                        {FIELDS.map(({ key, label: fieldLabel }) => (
                            <View key={key}>
                                <Label>{fieldLabel}</Label>
                                <Input
                                    value={fields[key]}
                                    onChangeText={(value) =>
                                        setFields((held) => ({ ...held, [key]: value }))
                                    }
                                    keyboardType={key === 'postal_code' ? 'number-pad' : 'default'}
                                    invalid={Boolean(errorFor(key))}
                                />
                                <FieldError message={errorFor(key)} />
                            </View>
                        ))}

                        <View>
                            <Label>Landmark</Label>
                            <Input
                                value={landmark}
                                onChangeText={setLandmark}
                                placeholder="Beside the covered court"
                                invalid={Boolean(errorFor('landmark'))}
                            />
                            <FieldError message={errorFor('landmark')} />
                        </View>

                        <Button
                            variant={isDefault ? 'brand' : 'outline'}
                            onPress={() => setIsDefault((held) => !held)}
                        >
                            {isDefault ? 'This is the default address' : 'Make this the default'}
                        </Button>

                        <Button onPress={save} busy={busy}>
                            {id === undefined ? 'Add address' : 'Save changes'}
                        </Button>
                    </Card>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
