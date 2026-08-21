import { Link, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { FormMessage } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useSession } from '@/lib/session';
import type { MessageResponse } from '@/lib/types';
import { useSubmit } from '@/lib/use-submit';

/**
 * The account, as its owner sees it.
 */
export default function Profile() {
    const session = useSession();
    const { busy, message, submit } = useSubmit();
    const [version, setVersion] = useState(0);

    if (session.status !== 'authenticated') {
        return null;
    }

    const { user } = session;

    const choosePicture = () =>
        submit(async () => {
            const picked = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.85,
            });

            if (picked.canceled) {
                return;
            }

            const asset = picked.assets[0];
            const body = new FormData();

            body.append('avatar', {
                uri: asset.uri,
                name: asset.fileName ?? 'avatar.jpg',
                type: asset.mimeType ?? 'image/jpeg',
            } as unknown as Blob);

            await session.authenticatedRequest<MessageResponse>('/profile/avatar', {
                method: 'POST',
                body,
            });

            await session.reload();
            setVersion((seen) => seen + 1);
        });

    const removePicture = () =>
        submit(async () => {
            await session.authenticatedRequest<void>('/profile/avatar', { method: 'DELETE' });

            await session.reload();
            setVersion((seen) => seen + 1);
        });

    return (
        <SafeAreaView className="bg-background flex-1">
            <ScrollView contentContainerClassName="gap-6 p-6">
                <View className="flex-row items-center justify-between">
                    <Text className="text-2xl font-bold">Profile</Text>
                    <Button variant="ghost" onPress={() => router.back()}>
                        Done
                    </Button>
                </View>

                <FormMessage message={message} />

                <Card className="items-center gap-3">
                    <Avatar nickname={user.nickname} token={session.token} version={version} />

                    <View className="items-center">
                        <Text className="text-lg font-semibold">{user.nickname}</Text>
                        {user.fullname ? (
                            <Text className="text-muted-foreground text-sm">{user.fullname}</Text>
                        ) : null}
                    </View>

                    <View className="flex-row gap-2">
                        <Button variant="outline" onPress={choosePicture} busy={busy}>
                            {user.avatar ? 'Change picture' : 'Add a picture'}
                        </Button>
                        {user.avatar ? (
                            <Button variant="ghost" onPress={removePicture} busy={busy}>
                                Remove
                            </Button>
                        ) : null}
                    </View>
                </Card>

                <Card className="gap-3">
                    <Text className="font-semibold">Details</Text>
                    <Detail label="Email" value={user.email} />
                    <Detail label="Phone" value={user.phone ?? 'Not given'} />
                    <Detail
                        label="Identity"
                        value={user.identification_verified ? 'Verified' : 'Not verified'}
                        tone={user.identification_verified ? 'success' : 'muted'}
                    />

                    <Link href="/profile/edit" asChild>
                        <Button variant="outline">Edit details</Button>
                    </Link>
                </Card>

                <Card className="gap-3">
                    <Text className="font-semibold">Addresses</Text>
                    <Text className="text-muted-foreground text-sm">
                        Where you want work done. Add as many as you need and pick a default.
                    </Text>
                    <Link href="/profile/addresses" asChild>
                        <Button variant="outline">Manage addresses</Button>
                    </Link>
                </Card>

                <Card className="gap-3">
                    <Text className="font-semibold">Sign in</Text>
                    <Link href="/profile/socials" asChild>
                        <Button variant="outline">Linked accounts</Button>
                    </Link>
                    <Link href="/security" asChild>
                        <Button variant="outline">Password and two factor</Button>
                    </Link>
                </Card>

                <Button variant="ghost" onPress={() => void session.logout()}>
                    Log out
                </Button>
            </ScrollView>
        </SafeAreaView>
    );
}

function Detail({
    label,
    value,
    tone = 'default',
}: {
    label: string;
    value: string;
    tone?: 'default' | 'success' | 'muted';
}) {
    const colour = {
        default: 'text-foreground',
        success: 'text-success',
        muted: 'text-muted-foreground',
    }[tone];

    return (
        <View className="flex-row items-center justify-between">
            <Text className="text-muted-foreground text-sm">{label}</Text>
            <Text className={`text-sm font-medium ${colour}`}>{value}</Text>
        </View>
    );
}
