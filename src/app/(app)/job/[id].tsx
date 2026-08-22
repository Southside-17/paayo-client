import { Redirect, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { WhenCard, WhereCard } from '@/components/booking-facts';
import { MediaThumb } from '@/components/media-thumb';
import { MediaViewer, type Viewable } from '@/components/media-viewer';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import { peso, priceRange } from '@/lib/money';
import { useSession } from '@/lib/session';
import type { Booking } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';

/**
 * One job, as the business sees it: who asked, where, when and what for.
 */
export default function Job() {
    const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
    const session = useSession();
    const { staff } = useWorkspace();
    const [job, setJob] = useState<Booking | null>(null);
    const [viewing, setViewing] = useState<Viewable | null>(null);

    const authenticatedRequest =
        session.status === 'authenticated' ? session.authenticatedRequest : null;
    const provider = staff?.provider.id ?? null;

    useFocusEffect(
        useCallback(() => {
            if (!authenticatedRequest || !provider) {
                return;
            }

            void authenticatedRequest<{ data: Booking }>(`/providers/${provider}/bookings/${id}`)
                .then(({ data }) => setJob(data))
                .catch(() => setJob(null));
        }, [authenticatedRequest, id, provider]),
    );

    // A sibling of both tab groups, so `(provider)/_layout.tsx` does not cover
    // it: a deep link here from the personal side would otherwise hold on a
    // skeleton that never fills.
    if (!staff) {
        return <Redirect href="/" />;
    }

    return (
        <SafeAreaView className="bg-background flex-1">
            <ScrollView contentContainerClassName="gap-5 p-6">
                <BackButton label="Jobs" />

                <ScreenHeader
                    eyebrow={job?.client?.nickname}
                    title={name ?? job?.service.name ?? 'Job'}
                >
                    {job ? (
                        <View className="max-w-[45%] items-end">
                            <Text className="text-brand text-right text-lg font-bold">
                                {priceRange(job.price_min, job.price_max, job.service.pricing_unit)}
                            </Text>
                            {job.surcharge ? (
                                <Text className="text-muted-foreground text-right text-[11px]">
                                    plus {peso(job.surcharge)} trip charge
                                </Text>
                            ) : null}
                        </View>
                    ) : null}
                </ScreenHeader>

                {job === null ? (
                    <>
                        <Skeleton className="h-7 w-40 rounded-full" />
                        <Card className="gap-3">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/4" />
                        </Card>
                        <Card className="gap-2">
                            <Skeleton className="h-5 w-36" />
                            <Skeleton className="h-4 w-full" />
                        </Card>
                    </>
                ) : null}

                {job ? (
                    <>
                        <StatusPill tone={job.status.tone}>{job.status.wording}</StatusPill>

                        <Card className="gap-1">
                            <Label>Who asked?</Label>
                            <Text className="text-lg font-semibold">
                                {job.client?.nickname ?? 'A client'}
                            </Text>
                            {job.client?.phone ? (
                                <Text className="text-muted-foreground text-sm">
                                    {job.client.phone}
                                </Text>
                            ) : (
                                <Text className="text-muted-foreground text-sm">
                                    No phone number on this account.
                                </Text>
                            )}
                        </Card>

                        <WhereCard
                            place={{
                                label: job.address.label,
                                line: job.address.line,
                                landmark: job.address.landmark,
                                latitude: job.latitude,
                                longitude: job.longitude,
                            }}
                        />

                        <WhenCard scheduled={job.scheduled_at} />

                        <Card className="gap-2">
                            <Label>What does it look like?</Label>

                            {job.attachments?.length ? (
                                <View className="flex-row flex-wrap gap-2">
                                    {job.attachments.map((attachment) => {
                                        const video = attachment.mime.startsWith('video/');
                                        const uri = attachment.url;

                                        if (!uri) {
                                            return null;
                                        }

                                        return (
                                            <Pressable
                                                key={attachment.id}
                                                accessibilityRole="button"
                                                accessibilityLabel={
                                                    video ? 'Play video' : 'View photo'
                                                }
                                                onPress={() => setViewing({ uri, video })}
                                            >
                                                <MediaThumb uri={uri} video={video} />
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            ) : (
                                <Text className="text-muted-foreground text-sm">
                                    Nothing was attached to this booking.
                                </Text>
                            )}
                        </Card>

                        <Card className="gap-2">
                            <Label>Why do they need you?</Label>
                            <Text className="text-sm">{job.description}</Text>
                        </Card>

                        {/* Said plainly rather than drawn as a disabled button:
                            accepting is not built, and a greyed-out control
                            reads as something that is temporarily unavailable. */}
                        {job.status.is_open ? (
                            <Text className="text-muted-foreground text-center text-sm">
                                Taking and turning down work is not here yet.
                            </Text>
                        ) : null}
                    </>
                ) : null}

                <MediaViewer item={viewing} onClose={() => setViewing(null)} />
            </ScrollView>
        </SafeAreaView>
    );
}
