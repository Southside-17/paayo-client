import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import type { DocumentType, Registration, RegistrationIndex } from '@/lib/types';
import { useSubmit } from '@/lib/use-submit';
import { useWorkspace } from '@/lib/workspace';

/** One paper on the way to being sent. */
type Paper = {
    type: DocumentType | null;
    number: string;
    issuedBy: string;
    expiresAt: string;
    scan: Upload | null;
};

const STATUS_TONE = {
    pending: 'warning',
    approved: 'success',
    rejected: 'neutral',
} as const;

const BLANK: Paper = { type: null, number: '', issuedBy: '', expiresAt: '', scan: null };

/**
 * The papers that say what a business legally is.
 */
export default function BusinessRegistration() {
    const session = useSession();
    const { staff } = useWorkspace();
    const { busy, message, errorFor, submit, reset } = useSubmit();

    const [types, setTypes] = useState<DocumentType[]>([]);
    const [standing, setStanding] = useState<Registration | null>(null);
    const [ready, setReady] = useState(false);

    const [name, setName] = useState('');
    const [registeredAt, setRegisteredAt] = useState('');
    const [tin, setTin] = useState('');
    const [street, setStreet] = useState('');
    const [barangay, setBarangay] = useState('');
    const [town, setTown] = useState('');
    const [province, setProvince] = useState('');

    const [papers, setPapers] = useState<Paper[]>([BLANK]);
    const [choosing, setChoosing] = useState<number | null>(null);
    const [consent, setConsent] = useState(false);

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;
    const provider = staff?.provider.id ?? null;

    const load = useCallback(async () => {
        if (!authenticatedRequest || !provider) {
            return;
        }

        const answer = await authenticatedRequest<RegistrationIndex>(
            `/providers/${provider}/registrations`,
        );

        setTypes(answer.types);
        setStanding(answer.data[0] ?? null);
        setReady(true);
    }, [authenticatedRequest, provider]);

    useEffect(() => {
        void submit(load);
    }, [load, submit]);

    if (session.status !== 'authenticated' || !staff) {
        return null;
    }

    const change = (at: number, patch: Partial<Paper>) =>
        setPapers((held) => held.map((paper, index) => (index === at ? { ...paper, ...patch } : paper)));

    const send = () =>
        submit(async () => {
            const body = new FormData();

            body.append('registered_name', name.trim());
            body.append('registered_at', registeredAt.trim());
            body.append('registered_address[street]', street.trim());
            body.append('registered_address[barangay]', barangay.trim());
            body.append('registered_address[town]', town.trim());
            body.append('registered_address[province]', province.trim());
            body.append('tin', tin.trim());

            papers.forEach((paper, at) => {
                body.append(`documents[${at}][type]`, paper.type?.value ?? '');
                body.append(`documents[${at}][number]`, paper.number.trim());

                if (paper.type?.requires_issuer) {
                    body.append(`documents[${at}][issued_by]`, paper.issuedBy.trim());
                }

                if (paper.type?.requires_expiry) {
                    body.append(`documents[${at}][expires_at]`, paper.expiresAt.trim());
                }

                if (paper.scan) {
                    body.append(`documents[${at}][files][scan]`, paper.scan as unknown as Blob);
                }
            });

            body.append('consent', consent ? '1' : '0');

            await session.authenticatedRequest<{ data: Registration }>(
                `/providers/${provider}/registrations`,
                { method: 'POST', body },
            );

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
                    <BackButton label="Business" />
                    <ScreenHeader title="Business papers" />

                    <FormMessage message={message} />
                    <FieldError message={errorFor('documents')} />

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
                                    ? 'A person is looking at them. We will tell you once they are reviewed.'
                                    : 'You can send another set of papers below.'}
                            </Text>
                        </Card>
                    ) : null}

                    {ready && !waiting ? (
                        <>
                            <Card className="gap-3">
                                <Text className="font-medium">Registered name</Text>
                                <Text className="text-muted-foreground text-sm leading-5">
                                    The name on the registration, which is often not the name you
                                    trade under.
                                </Text>

                                <View>
                                    <Input
                                        value={name}
                                        onChangeText={setName}
                                        placeholder="Santos Electrical Services"
                                        invalid={Boolean(errorFor('registered_name'))}
                                    />
                                    <FieldError message={errorFor('registered_name')} />
                                </View>
                            </Card>

                            <Card className="gap-3">
                                <Text className="font-medium">Registered on</Text>

                                <View>
                                    <DateField
                                        value={registeredAt}
                                        onChange={setRegisteredAt}
                                        maximumDate={new Date()}
                                        disabled={busy}
                                        invalid={Boolean(errorFor('registered_at'))}
                                    />
                                    <FieldError message={errorFor('registered_at')} />
                                </View>
                            </Card>

                            <Card className="gap-3">
                                <Text className="font-medium">TIN</Text>
                                <Text className="text-muted-foreground text-sm leading-5">
                                    On the BIR 2303. It is printed on every invoice you issue, so
                                    leave it blank if the business is not registered with the BIR.
                                </Text>

                                <View>
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
                                <Text className="font-medium">Registered address</Text>

                                <View>
                                    <Label>Street</Label>
                                    <Input
                                        value={street}
                                        onChangeText={setStreet}
                                        placeholder="12 Mabini Street"
                                        invalid={Boolean(errorFor('registered_address.street'))}
                                    />
                                    <FieldError message={errorFor('registered_address.street')} />
                                </View>

                                <View>
                                    <Label>Barangay</Label>
                                    <Input
                                        value={barangay}
                                        onChangeText={setBarangay}
                                        placeholder="Barangay 5"
                                        invalid={Boolean(errorFor('registered_address.barangay'))}
                                    />
                                    <FieldError message={errorFor('registered_address.barangay')} />
                                </View>

                                <View>
                                    <Label>Town</Label>
                                    <Input
                                        value={town}
                                        onChangeText={setTown}
                                        placeholder="Davao City"
                                        invalid={Boolean(errorFor('registered_address.town'))}
                                    />
                                    <FieldError message={errorFor('registered_address.town')} />
                                </View>

                                <View>
                                    <Label>Province</Label>
                                    <Input
                                        value={province}
                                        onChangeText={setProvince}
                                        placeholder="Davao del Sur"
                                        invalid={Boolean(errorFor('registered_address.province'))}
                                    />
                                    <FieldError message={errorFor('registered_address.province')} />
                                </View>
                            </Card>

                            {papers.map((paper, at) => (
                                <Card key={at} className="gap-3">
                                    <View className="flex-row items-center justify-between">
                                        <Text className="font-medium">
                                            {papers.length > 1 ? `Paper ${at + 1}` : 'The paper'}
                                        </Text>

                                        {papers.length > 1 ? (
                                            <Text
                                                className="text-muted-foreground text-sm"
                                                onPress={() =>
                                                    setPapers((held) =>
                                                        held.filter((_, index) => index !== at),
                                                    )
                                                }
                                            >
                                                Remove
                                            </Text>
                                        ) : null}
                                    </View>

                                    <View>
                                        <Label>Type</Label>
                                        <Button
                                            variant="outline"
                                            onPress={() => setChoosing(at)}
                                            disabled={busy}
                                        >
                                            {paper.type?.label ?? 'Choose one'}
                                        </Button>
                                        <FieldError message={errorFor(`documents.${at}.type`)} />
                                    </View>

                                    <View>
                                        <Label>Number</Label>
                                        <Input
                                            value={paper.number}
                                            onChangeText={(number) => change(at, { number })}
                                            placeholder="As printed on it"
                                            invalid={Boolean(errorFor(`documents.${at}.number`))}
                                        />
                                        <FieldError message={errorFor(`documents.${at}.number`)} />
                                    </View>

                                    {paper.type?.requires_issuer ? (
                                        <View>
                                            <Label>Issued by</Label>
                                            <Input
                                                value={paper.issuedBy}
                                                onChangeText={(issuedBy) => change(at, { issuedBy })}
                                                placeholder="The office named on it"
                                                invalid={Boolean(
                                                    errorFor(`documents.${at}.issued_by`),
                                                )}
                                            />
                                            <FieldError
                                                message={errorFor(`documents.${at}.issued_by`)}
                                            />
                                        </View>
                                    ) : null}

                                    {paper.type?.requires_expiry ? (
                                        <View>
                                            <Label>Expires</Label>
                                            <DateField
                                                value={paper.expiresAt}
                                                onChange={(expiresAt) => change(at, { expiresAt })}
                                                disabled={busy}
                                                invalid={Boolean(
                                                    errorFor(`documents.${at}.expires_at`),
                                                )}
                                            />
                                            <FieldError
                                                message={errorFor(`documents.${at}.expires_at`)}
                                            />
                                        </View>
                                    ) : null}

                                    <CaptureCard
                                        label="Photo of the paper"
                                        hint="The whole page, readable"
                                        value={paper.scan}
                                        onChange={(scan) => change(at, { scan })}
                                        disabled={busy}
                                        invalid={Boolean(errorFor(`documents.${at}.files.scan`))}
                                    />
                                    <FieldError message={errorFor(`documents.${at}.files.scan`)} />
                                </Card>
                            ))}

                            {papers.length < 5 ? (
                                <Button
                                    variant="outline"
                                    onPress={() => setPapers((held) => [...held, BLANK])}
                                    disabled={busy}
                                >
                                    Add another paper
                                </Button>
                            ) : null}

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
                                        I am authorised to send these papers, and I agree to Paayo
                                        collecting and checking them as the{' '}
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

            <Sheet
                open={choosing !== null}
                onDismiss={() => setChoosing(null)}
                label="Type of paper"
            >
                <Text className="text-base font-bold">Type of paper</Text>

                {types.map((option) => (
                    <SheetAction
                        key={option.value}
                        onPress={() => {
                            if (choosing !== null) {
                                change(choosing, { type: option });
                            }

                            setChoosing(null);
                            reset();
                        }}
                    >
                        {option.label}
                    </SheetAction>
                ))}

                <SheetAction tone="quiet" onPress={() => setChoosing(null)}>
                    Cancel
                </SheetAction>
            </Sheet>
        </SafeAreaView>
    );
}
