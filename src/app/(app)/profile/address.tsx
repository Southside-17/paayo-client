import { BackButton } from '@/components/back-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KeyboardAvoiding } from '@/components/ui/keyboard-avoiding';

import { FormMessage } from '@/components/form-message';
import { PinMap, type Pin } from '@/components/pin-map';
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
    { key: 'unit', label: 'Unit', required: false },
    { key: 'street', label: 'Street', required: true },
    { key: 'subdivision', label: 'Subdivision', required: false },
    { key: 'barangay', label: 'Barangay', required: true },
    { key: 'town', label: 'Town', required: true },
    { key: 'province', label: 'Province', required: true },
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
        town: '',
        province: '',
        postal_code: '',
    });
    const [isDefault, setIsDefault] = useState(false);
    const [pin, setPin] = useState<Pin | null>(null);
    // Separate from the pin: this is what the map should look at, and it is set
    // only where a jump is wanted, never when a tap moves the pin.
    const [focus, setFocus] = useState<Pin | null>(null);
    const [locationNotice, setLocationNotice] = useState<string | null>(null);

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

        if (address.latitude !== null && address.longitude !== null) {
            const saved = { latitude: address.latitude, longitude: address.longitude };

            setPin(saved);
            setFocus(saved);
        }

        setFields({
            unit: address.unit ?? '',
            street: address.street,
            subdivision: address.subdivision ?? '',
            barangay: address.barangay,
            town: address.town,
            province: address.province,
            postal_code: address.postal_code ?? '',
        });
    }, [authenticatedRequest, id]);

    useEffect(() => {
        void submit(load);
    }, [load, submit]);

    if (session.status !== 'authenticated') {
        return null;
    }

    const useMyLocation = () =>
        submit(async () => {
            setLocationNotice(null);

            const { granted } = await Location.requestForegroundPermissionsAsync();

            if (!granted) {
                setLocationNotice('Paayo cannot read this location. Tap the map to place the pin.');

                return;
            }

            const { coords } = await Location.getCurrentPositionAsync({});
            const here = { latitude: coords.latitude, longitude: coords.longitude };

            setPin(here);
            setFocus(here);
        });

    const save = () =>
        submit(async () => {
            const body = {
                label: label.trim(),
                landmark: landmark.trim() === '' ? null : landmark.trim(),
                is_default: isDefault,
                latitude: pin?.latitude ?? null,
                longitude: pin?.longitude ?? null,
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
            <KeyboardAvoiding
                className="flex-1"
            >
                <ScrollView contentContainerClassName="gap-6 p-6" keyboardShouldPersistTaps="handled">
                    <BackButton label="Addresses" />
                    <ScreenHeader title={id === undefined ? 'Add address' : 'Edit address'} />

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

                        <View className="gap-2">
                            <Label>Pin</Label>
                            <Text className="text-muted-foreground text-sm">
                                Tap the map where the work happens.
                            </Text>

                            <PinMap pin={pin} focus={focus} onMove={setPin} />

                            <Button variant="outline" onPress={useMyLocation} busy={busy}>
                                Use my location
                            </Button>

                            <FieldError message={locationNotice ?? undefined} />

                            {pin === null ? (
                                <Text className="text-warning text-sm">
                                    Without a pin, no provider can be matched to this address.
                                </Text>
                            ) : null}

                            <FieldError message={errorFor('latitude') ?? errorFor('longitude')} />
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
            </KeyboardAvoiding>
        </SafeAreaView>
    );
}
