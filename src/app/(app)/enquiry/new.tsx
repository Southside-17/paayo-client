import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { WhereCard, WhoCard } from '@/components/booking-facts';
import { FormMessage } from '@/components/form-message';
import { MediaPicker, readyIds, stillSending, type MediaItem } from '@/components/media-picker';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { KeyboardAvoiding } from '@/components/ui/keyboard-avoiding';
import { Label } from '@/components/ui/label';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useSession } from '@/lib/session';
import type { Enquiry } from '@/lib/types';
import { useSelectedAddress } from '@/lib/use-selected-address';
import { useSubmit } from '@/lib/use-submit';

/** The fields this screen refuses on its own, before the server is asked. */
type Missing = { description?: string; attachments?: string; address?: string };

/**
 * Ask what the work would cost, committing to nothing.
 *
 * No day and no hour, which is the whole difference from `book.tsx`: nothing is
 * being scheduled, so there is nothing to schedule. The instruction leads
 * instead of trailing, because it is the thing that gets priced.
 */
export default function NewEnquiry() {
    const { listing, service, trade, provider } = useLocalSearchParams<{
        listing: string;
        service?: string;
        trade?: string;
        provider?: string;
    }>();
    const session = useSession();
    const { address, ready } = useSelectedAddress();
    const { busy, message, errorFor, submit } = useSubmit();
    const [description, setDescription] = useState('');
    const [media, setMedia] = useState<MediaItem[]>([]);
    const [missing, setMissing] = useState<Missing>({});

    if (session.status !== 'authenticated') {
        return null;
    }

    const send = () =>
        submit(async () => {
            const { data } = await session.authenticatedRequest<{ data: Enquiry }>('/enquiries', {
                method: 'POST',
                body: {
                    listing_id: listing,
                    address_id: address?.id,
                    description,
                    attachments: readyIds(media),
                },
            });

            if (router.canDismiss()) {
                router.dismissAll();
            }

            router.replace('/bookings');
            router.push({
                pathname: '/enquiry/[id]',
                params: { id: data.id, name: data.service.name },
            });
        });

    /** Everything the server would refuse, said before it is asked. */
    const ask = () => {
        const found: Missing = {};

        if (readyIds(media).length === 0) {
            found.attachments = stillSending(media)
                ? 'Wait for the upload to finish.'
                : 'Add a photo or a video so they can price it.';
        }

        if (description.trim() === '') {
            found.description = 'Say what you need priced.';
        }

        if (!address) {
            found.address = ready
                ? 'Add an address with a pin before asking.'
                : 'Still reading your address.';
        }

        setMissing(found);

        if (Object.keys(found).length === 0) {
            void send();
        }
    };

    const wrong = (field: keyof Missing) => missing[field] ?? errorFor(field);

    const answered = (field: keyof Missing) =>
        setMissing((held) => ({ ...held, [field]: undefined }));

    return (
        <SafeAreaView className="bg-background flex-1">
            <KeyboardAvoiding className="flex-1">
                <ScrollView
                    contentContainerClassName="gap-5 p-6"
                    keyboardShouldPersistTaps="handled"
                >
                    <BackButton label={trade || service || 'Back'} />
                    <ScreenHeader eyebrow={service} title="Ask for a price" />

                    <FormMessage message={message ?? errorFor('listing_id') ?? null} />

                    {provider ? (
                        <WhoCard
                            provider={provider}
                            note="They will send you a price. Nothing is booked until you accept it."
                        />
                    ) : null}

                    <Card className="gap-2">
                        <Label>What needs doing?</Label>
                        <Input
                            value={description}
                            onChangeText={(value) => {
                                setDescription(value);
                                answered('description');
                            }}
                            placeholder="Two aircons, one is not cooling at all."
                            multiline
                            numberOfLines={5}
                            className="h-28"
                            invalid={Boolean(wrong('description'))}
                        />
                        <Text className="text-muted-foreground text-sm">
                            This is what they price, so the more you say the closer the price
                            will be.
                        </Text>
                        <FieldError message={wrong('description')} />
                    </Card>

                    <Card className="gap-2">
                        <Label>What does it look like?</Label>
                        <MediaPicker
                            send={session.authenticatedRequest}
                            items={media}
                            onChange={(update) => {
                                setMedia(update);
                                answered('attachments');
                            }}
                            disabled={busy}
                            invalid={Boolean(wrong('attachments'))}
                        />
                        <Text className="text-muted-foreground text-sm">
                            They are pricing work they have not seen, so a photo does most of
                            the talking.
                        </Text>
                        <FieldError message={wrong('attachments')} />
                    </Card>

                    {!ready ? (
                        <Card className="gap-2">
                            <Skeleton className="h-5 w-24" />
                            <Skeleton className="h-4 w-3/4" />
                        </Card>
                    ) : null}

                    {ready && address ? <WhereCard place={address} /> : null}

                    {ready && !address ? (
                        <Card className="gap-2">
                            <Label>Where is the work?</Label>
                            <Text className="text-warning text-sm">
                                No address on this account, so nobody can judge the trip.
                            </Text>
                        </Card>
                    ) : null}

                    <FieldError message={missing.address ?? errorFor('address_id')} />

                    {/* No confirm dialog, unlike placing a booking: an enquiry
                        commits to nothing and can be taken back. */}
                    <Button variant="brand" onPress={ask} busy={busy}>
                        Send enquiry
                    </Button>

                    <Text className="text-muted-foreground text-center text-sm">
                        You are not booking anything yet. Pick a day once you have their price.
                    </Text>
                </ScrollView>
            </KeyboardAvoiding>
        </SafeAreaView>
    );
}
