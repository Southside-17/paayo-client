import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { CaptureCard } from '@/components/capture-card';
import { FormMessage } from '@/components/form-message';
import { openDocument } from '@/components/legal-consent';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DateField } from '@/components/ui/date-field';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { KeyboardAvoiding } from '@/components/ui/keyboard-avoiding';
import { Label } from '@/components/ui/label';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Sheet } from '@/components/ui/sheet';
import { SheetAction } from '@/components/ui/sheet-action';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import type { Upload } from '@/lib/picture';
import { useSession } from '@/lib/session';
import type { DocumentType, Identification, IdentificationIndex } from '@/lib/types';
import { useSubmit } from '@/lib/use-submit';

type Captures = { front: Upload | null; back: Upload | null };

/** Nobody young enough to be refused should be offered a date at all. */
const OLDEST_BIRTHDATE = new Date(1900, 0, 1);

const STATUS_TONE = {
    pending: 'warning',
    approved: 'success',
    rejected: 'neutral',
} as const;

/**
 * Proving who you are: the details, the card, and the face beside it.
 */
export default function Identify() {
    const { from } = useLocalSearchParams<{ from?: string }>();
    const session = useSession();
    const { busy, message, errorFor, submit, reset } = useSubmit();

    const [types, setTypes] = useState<DocumentType[]>([]);
    const [standing, setStanding] = useState<Identification | null>(null);
    const [ready, setReady] = useState(false);
    const [minimumAge, setMinimumAge] = useState(18);

    const [first, setFirst] = useState('');
    const [middle, setMiddle] = useState('');
    const [last, setLast] = useState('');
    const [extension, setExtension] = useState('');
    const [birthdate, setBirthdate] = useState('');
    const [street, setStreet] = useState('');
    const [barangay, setBarangay] = useState('');
    const [town, setTown] = useState('');
    const [province, setProvince] = useState('');

    const [type, setType] = useState<DocumentType | null>(null);
    const [choosing, setChoosing] = useState(false);
    const [number, setNumber] = useState('');
    const [issuedBy, setIssuedBy] = useState('');
    const [expiresAt, setExpiresAt] = useState('');
    const [captures, setCaptures] = useState<Captures>({ front: null, back: null });
    const [selfie, setSelfie] = useState<Upload | null>(null);
    const [consent, setConsent] = useState(false);

    // The picker stops where the server's rule does, so an age it would refuse
    // cannot be chosen in the first place.
    const oldEnough = useMemo(() => {
        const date = new Date();
        date.setFullYear(date.getFullYear() - minimumAge);

        return date;
    }, [minimumAge]);

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;

    const load = useCallback(async () => {
        if (!authenticatedRequest) {
            return;
        }

        const answer = await authenticatedRequest<IdentificationIndex>('/identifications');

        setTypes(answer.types);
        setMinimumAge(answer.minimum_age);
        setType((held) => held ?? answer.types[0] ?? null);
        setStanding(answer.data[0] ?? null);
        setReady(true);
    }, [authenticatedRequest]);

    useEffect(() => {
        void submit(load);
    }, [load, submit]);

    if (session.status !== 'authenticated') {
        return null;
    }

    const send = () =>
        submit(async () => {
            const body = new FormData();

            body.append('name[first]', first.trim());
            body.append('name[middle]', middle.trim());
            body.append('name[last]', last.trim());
            body.append('name[extension]', extension.trim());
            body.append('birthdate', birthdate.trim());
            body.append('address[street]', street.trim());
            body.append('address[barangay]', barangay.trim());
            body.append('address[town]', town.trim());
            body.append('address[province]', province.trim());

            body.append('documents[0][type]', type?.value ?? '');
            body.append('documents[0][number]', number.trim());

            if (type?.requires_issuer) {
                body.append('documents[0][issued_by]', issuedBy.trim());
            }

            if (type?.requires_expiry) {
                body.append('documents[0][expires_at]', expiresAt.trim());
            }

            if (captures.front) {
                body.append('documents[0][files][front]', captures.front as unknown as Blob);
            }

            if (captures.back) {
                body.append('documents[0][files][back]', captures.back as unknown as Blob);
            }

            if (selfie) {
                body.append('selfie', selfie as unknown as Blob);
            }

            body.append('consent', consent ? '1' : '0');

            await session.authenticatedRequest<{ data: Identification }>('/identifications', {
                method: 'POST',
                body,
            });

            await session.reload();
            await load();

            router.back();
        });

    const waiting = standing?.status === 'pending';

    return (
        <SafeAreaView className="bg-background flex-1">
            <KeyboardAvoiding className="flex-1">
                <ScrollView
                    contentContainerClassName="gap-6 p-6"
                    keyboardShouldPersistTaps="handled"
                >
                    <BackButton label={from ?? 'Account'} />
                    <ScreenHeader title="Verify your identity" />

                    <FormMessage message={message} />

                    {standing ? (
                        <Card className="gap-3">
                            <View className="flex-row items-center justify-between">
                                <Text className="font-medium">Your last submission</Text>
                                <StatusPill tone={STATUS_TONE[standing.status]}>
                                    {standing.status_label}
                                </StatusPill>
                            </View>

                            {standing.rejection_reason ? (
                                <Text className="text-muted-foreground text-sm leading-5">
                                    {standing.rejection_reason}
                                </Text>
                            ) : null}

                            <Text className="text-muted-foreground text-sm leading-5">
                                {waiting
                                    ? 'A person is looking at it. We will tell you once it is reviewed.'
                                    : 'You can send another set of documents below.'}
                            </Text>
                        </Card>
                    ) : null}

                    {ready && !waiting ? (
                        <>
                            <Card className="gap-3">
                                <Text className="font-medium">Name</Text>
                                <Text className="text-muted-foreground text-sm leading-5">
                                    Exactly as it appears on the ID you are about to photograph.
                                </Text>

                                <View>
                                    <Label>Given</Label>
                                    <Input
                                        value={first}
                                        onChangeText={setFirst}
                                        autoComplete="given-name"
                                        placeholder="Juan"
                                        invalid={Boolean(errorFor('name.first'))}
                                    />
                                    <FieldError message={errorFor('name.first')} />
                                </View>

                                <View>
                                    <Label>Middle</Label>
                                    <Input
                                        value={middle}
                                        onChangeText={setMiddle}
                                        placeholder="Optional"
                                    />
                                </View>

                                <View>
                                    <Label>Family</Label>
                                    <Input
                                        value={last}
                                        onChangeText={setLast}
                                        autoComplete="family-name"
                                        placeholder="Santos"
                                        invalid={Boolean(errorFor('name.last'))}
                                    />
                                    <FieldError message={errorFor('name.last')} />
                                </View>

                                <View>
                                    <Label>Extension</Label>
                                    <Input
                                        value={extension}
                                        onChangeText={setExtension}
                                        placeholder="Jr., Sr., III — if you have one"
                                        invalid={Boolean(errorFor('name.extension'))}
                                    />
                                    <FieldError message={errorFor('name.extension')} />
                                </View>
                            </Card>

                            <Card className="gap-3">
                                <Text className="font-medium">Birthdate</Text>
                                <Text className="text-muted-foreground text-sm leading-5">
                                    As printed on the ID. Paayo is for people aged {minimumAge}
                                    and over.
                                </Text>

                                <View>
                                    <DateField
                                        value={birthdate}
                                        onChange={setBirthdate}
                                        placeholder="Choose your birthdate"
                                        minimumDate={OLDEST_BIRTHDATE}
                                        maximumDate={oldEnough}
                                        disabled={busy}
                                        invalid={Boolean(errorFor('birthdate'))}
                                    />
                                    <FieldError message={errorFor('birthdate')} />
                                </View>
                            </Card>

                            <Card className="gap-3">
                                <Text className="font-medium">Address</Text>
                                <Text className="text-muted-foreground text-sm leading-5">
                                    As printed on the ID, which is often not where you are now.
                                </Text>

                                <View>
                                    <Label>Street</Label>
                                    <Input
                                        value={street}
                                        onChangeText={setStreet}
                                        placeholder="12 Mabini Street"
                                        invalid={Boolean(errorFor('address.street'))}
                                    />
                                    <FieldError message={errorFor('address.street')} />
                                </View>

                                <View>
                                    <Label>Barangay</Label>
                                    <Input
                                        value={barangay}
                                        onChangeText={setBarangay}
                                        placeholder="Barangay 5"
                                        invalid={Boolean(errorFor('address.barangay'))}
                                    />
                                    <FieldError message={errorFor('address.barangay')} />
                                </View>

                                <View>
                                    <Label>Town</Label>
                                    <Input
                                        value={town}
                                        onChangeText={setTown}
                                        placeholder="Davao City"
                                        invalid={Boolean(errorFor('address.town'))}
                                    />
                                    <FieldError message={errorFor('address.town')} />
                                </View>

                                <View>
                                    <Label>Province</Label>
                                    <Input
                                        value={province}
                                        onChangeText={setProvince}
                                        placeholder="Davao del Sur"
                                        invalid={Boolean(errorFor('address.province'))}
                                    />
                                    <FieldError message={errorFor('address.province')} />
                                </View>
                            </Card>

                            <Card className="gap-3">
                                <Text className="font-medium">Your ID</Text>

                                <View>
                                    <Label>Type</Label>
                                    <Button
                                        variant="outline"
                                        onPress={() => setChoosing(true)}
                                        disabled={busy}
                                    >
                                        {type?.label ?? 'Choose one'}
                                    </Button>
                                    <FieldError message={errorFor('documents.0.type')} />
                                </View>

                                <View>
                                    <Label>Number</Label>
                                    <Input
                                        value={number}
                                        onChangeText={setNumber}
                                        placeholder="As printed on the card"
                                        invalid={Boolean(errorFor('documents.0.number'))}
                                    />
                                    <FieldError message={errorFor('documents.0.number')} />
                                </View>

                                {type?.requires_issuer ? (
                                    <View>
                                        <Label>Issued by</Label>
                                        <Input
                                            value={issuedBy}
                                            onChangeText={setIssuedBy}
                                            placeholder="The office named on it"
                                            invalid={Boolean(errorFor('documents.0.issued_by'))}
                                        />
                                        <FieldError message={errorFor('documents.0.issued_by')} />
                                    </View>
                                ) : null}

                                {type?.requires_expiry ? (
                                    <View>
                                        <Label>Expires</Label>
                                        <DateField
                                            value={expiresAt}
                                            onChange={setExpiresAt}
                                            placeholder="Choose the expiry"
                                            disabled={busy}
                                            invalid={Boolean(errorFor('documents.0.expires_at'))}
                                        />
                                        <FieldError message={errorFor('documents.0.expires_at')} />
                                    </View>
                                ) : null}

                                <CaptureCard
                                    label="Front of the ID"
                                    hint="All four corners in frame"
                                    value={captures.front}
                                    onChange={(front) => setCaptures((held) => ({ ...held, front }))}
                                    disabled={busy}
                                    invalid={Boolean(errorFor('documents.0.files.front'))}
                                />
                                <FieldError message={errorFor('documents.0.files.front')} />

                                <CaptureCard
                                    label="Back of the ID"
                                    hint="Only if it carries anything"
                                    value={captures.back}
                                    onChange={(back) => setCaptures((held) => ({ ...held, back }))}
                                    disabled={busy}
                                />
                            </Card>

                            <Card className="gap-3">
                                <Text className="font-medium">Your face</Text>
                                <Text className="text-muted-foreground text-sm leading-5">
                                    So the person on the ID and the person sending it can be
                                    compared. It is used for that and nothing else — we run no
                                    facial recognition and build no database of faces.
                                </Text>

                                <CaptureCard
                                    label="Photo of you"
                                    hint="Good light, no hat or sunglasses"
                                    value={selfie}
                                    onChange={setSelfie}
                                    face
                                    disabled={busy}
                                    invalid={Boolean(errorFor('selfie'))}
                                />
                                <FieldError message={errorFor('selfie')} />
                            </Card>

                            <View className="gap-2">
                                <View className="flex-row items-start gap-3">
                                    <Button
                                        variant={consent ? 'brand' : 'outline'}
                                        className="h-10 px-3"
                                        onPress={() => setConsent(!consent)}
                                        disabled={busy}
                                    >
                                        {consent ? 'Agreed' : 'Agree'}
                                    </Button>

                                    <Text className="text-muted-foreground flex-1 text-sm leading-5">
                                        I agree to Paayo collecting and checking these documents and
                                        my photograph, as the{' '}
                                        <Text
                                            className="text-brand text-sm underline"
                                            onPress={() => openDocument('/privacy-policy')}
                                        >
                                            Privacy Policy
                                        </Text>{' '}
                                        describes.
                                    </Text>
                                </View>
                                <FieldError message={errorFor('consent')} />
                            </View>

                            <Button onPress={send} busy={busy}>
                                Send for review
                            </Button>
                        </>
                    ) : null}
                </ScrollView>
            </KeyboardAvoiding>

            <Sheet open={choosing} onDismiss={() => setChoosing(false)} label="Type of ID">
                <Text className="text-base font-bold">Type of ID</Text>

                {types.map((option) => (
                    <SheetAction
                        key={option.value}
                        onPress={() => {
                            setType(option);
                            setChoosing(false);
                            reset();
                        }}
                    >
                        {option.label}
                    </SheetAction>
                ))}

                <SheetAction tone="quiet" onPress={() => setChoosing(false)}>
                    Cancel
                </SheetAction>
            </Sheet>
        </SafeAreaView>
    );
}
