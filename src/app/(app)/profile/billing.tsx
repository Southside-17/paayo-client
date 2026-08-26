import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
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
import { Text } from '@/components/ui/text';
import { useSession } from '@/lib/session';
import { useSubmit } from '@/lib/use-submit';

/**
 * The address fields, in the order every other address form fixes them.
 */
const FIELDS = [
    { key: 'unit', label: 'Unit' },
    { key: 'street', label: 'Street' },
    { key: 'subdivision', label: 'Subdivision' },
    { key: 'barangay', label: 'Barangay' },
    { key: 'town', label: 'Town' },
    { key: 'province', label: 'Province' },
    { key: 'postal_code', label: 'Postal code' },
] as const;

type Field = (typeof FIELDS)[number]['key'];

const BLANK: Record<Field, string> = {
    unit: '',
    street: '',
    subdivision: '',
    barangay: '',
    town: '',
    province: '',
    postal_code: '',
};

/**
 * Who invoices are made out to.
 *
 * Saved once and read every time an invoice is raised afterwards. It cannot
 * change an invoice already issued -- tax law keeps one as issued -- so the
 * screen says that rather than letting somebody edit and wonder why nothing
 * moved.
 */
export default function Billing() {
    const session = useSession();
    const { busy, message, errorFor, submit } = useSubmit();

    const held = session.status === 'authenticated' ? session.user.billing : null;

    const [name, setName] = useState(held?.name ?? '');
    const [businessStyle, setBusinessStyle] = useState(held?.business_style ?? '');
    const [tin, setTin] = useState(held?.tin ?? '');
    const [fields, setFields] = useState<Record<Field, string>>({
        ...BLANK,
        ...Object.fromEntries(
            FIELDS.map(({ key }) => [key, held?.address?.[key] ?? '']),
        ),
    });

    if (session.status !== 'authenticated') {
        return null;
    }

    const typed = FIELDS.some(({ key }) => fields[key].trim() !== '');

    const save = () =>
        submit(async () => {
            await session.authenticatedRequest('/profile/billing', {
                method: 'PUT',
                body: {
                    name: name.trim(),
                    business_style: businessStyle.trim() || null,
                    tin: tin.trim() || null,
                    address: typed
                        ? Object.fromEntries(
                              FIELDS.map(({ key }) => [key, fields[key].trim() || null]),
                          )
                        : null,
                },
            });

            await session.reload();

            router.back();
        });

    const clear = () =>
        submit(async () => {
            await session.authenticatedRequest('/profile/billing', { method: 'DELETE' });

            await session.reload();

            router.back();
        });

    return (
        <SafeAreaView className="bg-background flex-1">
            <KeyboardAvoiding className="flex-1">
                <ScrollView
                    contentContainerClassName="gap-6 p-6"
                    keyboardShouldPersistTaps="handled"
                >
                    <BackButton label="Account" />
                    <ScreenHeader title="Billing" />

                    <Text className="text-muted-foreground text-sm leading-5">
                        Who your invoices are made out to. Leave this empty and they carry the name
                        on your account and the address the work was done at.
                    </Text>

                    <FormMessage message={message} />

                    <Card className="gap-3">
                        <Text className="font-medium">Billed to</Text>

                        <View>
                            <Label>Name</Label>
                            <Input
                                value={name}
                                onChangeText={setName}
                                placeholder="Reyes Trading"
                                invalid={Boolean(errorFor('name'))}
                            />
                            <FieldError message={errorFor('name')} />
                        </View>

                        <View>
                            <Label>Business style</Label>
                            <Input
                                value={businessStyle}
                                onChangeText={setBusinessStyle}
                                placeholder="Reyes Hardware"
                                invalid={Boolean(errorFor('business_style'))}
                            />
                            <FieldError message={errorFor('business_style')} />
                        </View>

                        <View>
                            <Label>TIN</Label>
                            <Input
                                value={tin}
                                onChangeText={setTin}
                                placeholder="123-456-789-000"
                                keyboardType="numbers-and-punctuation"
                                invalid={Boolean(errorFor('tin'))}
                            />
                            <FieldError message={errorFor('tin')} />
                        </View>
                    </Card>

                    <Card className="gap-3">
                        <Text className="font-medium">Billing address</Text>
                        <Text className="text-muted-foreground text-sm leading-5">
                            Optional. Fill any of it and street, barangay, town and province are
                            needed.
                        </Text>

                        {FIELDS.map(({ key, label }) => (
                            <View key={key}>
                                <Label>{label}</Label>
                                <Input
                                    value={fields[key]}
                                    onChangeText={(value) =>
                                        setFields((current) => ({ ...current, [key]: value }))
                                    }
                                    keyboardType={key === 'postal_code' ? 'number-pad' : 'default'}
                                    invalid={Boolean(errorFor(`address.${key}`))}
                                />
                                <FieldError message={errorFor(`address.${key}`)} />
                            </View>
                        ))}
                    </Card>

                    <Text className="text-muted-foreground text-sm leading-5">
                        These details appear on invoices raised after you save them. An invoice
                        already issued keeps what it was issued with — the law does not allow one to
                        be edited.
                    </Text>

                    <Button onPress={save} busy={busy}>
                        Save billing details
                    </Button>

                    {held ? (
                        <Button variant="ghost" onPress={clear} busy={busy}>
                            Remove them
                        </Button>
                    ) : null}
                </ScrollView>
            </KeyboardAvoiding>
        </SafeAreaView>
    );
}
