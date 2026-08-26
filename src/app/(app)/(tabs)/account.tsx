import * as ImagePicker from 'expo-image-picker';
import BadgeCheck from 'lucide-react-native/icons/badge-check';
import Briefcase from 'lucide-react-native/icons/briefcase';
import Camera from 'lucide-react-native/icons/camera';
import Link2 from 'lucide-react-native/icons/link-2';
import MapPin from 'lucide-react-native/icons/map-pin';
import Pencil from 'lucide-react-native/icons/pencil';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import Trash2 from 'lucide-react-native/icons/trash-2';
import { useColorScheme } from 'nativewind';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BusinessChip } from '@/components/business-chip';
import { FormMessage } from '@/components/form-message';
import { PictureSheet } from '@/components/picture-sheet';
import { SettingsList, type SettingsRow } from '@/components/settings-list';
import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import { AVATAR_SIZE, preparePicture } from '@/lib/picture';
import { useSession } from '@/lib/session';
import type { MessageResponse } from '@/lib/types';
import { useSubmit } from '@/lib/use-submit';
import palette from '@/theme/palette';

/**
 * One word each. "Provider" is deliberately not among them: in this codebase it
 * names a service company, never a way of signing in.
 */
const ROWS: SettingsRow[] = [
    { icon: Pencil, label: 'Profile', note: 'Nickname, email, phone', href: '/profile/edit' },
    { icon: MapPin, label: 'Address', note: 'Where you want work done', href: '/profile/addresses' },
    { icon: Link2, label: 'Sign-in', note: 'Google and the other ways in', href: '/profile/socials' },
    { icon: BadgeCheck, label: 'Identity', note: 'Verify who you are', href: '/profile/identification' },
    { icon: ShieldCheck, label: 'Security', note: 'Password, passkeys, two factor', href: '/security' },
    { icon: Briefcase, label: 'Business', note: 'Register one you own', href: '/profile/business' },
    { icon: Trash2, label: 'Close account', note: 'What goes, and what has to stay', href: '/profile/delete' },
];

/**
 * The account, as its owner sees it.
 */
export default function Account() {
    const session = useSession();
    const { colorScheme } = useColorScheme();
    const colours = palette[colorScheme ?? 'light'];
    const { busy, message, errorFor, submit } = useSubmit();
    const [picking, setPicking] = useState(false);

    if (session.status !== 'authenticated') {
        return null;
    }

    const { user } = session;

    const upload = async (asset: { uri: string; width: number }) => {
        const part = await preparePicture(asset, AVATAR_SIZE, 'avatar.jpg');
        const body = new FormData();

        body.append('avatar', part as unknown as Blob);

        await session.authenticatedRequest<MessageResponse>('/profile/avatar', {
            method: 'POST',
            body,
        });

        setPicking(false);

        await session.reload();
    };

    const fromLibrary = () =>
        void submit(async () => {
            const picked = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.85,
            });

            if (picked.canceled) {
                return;
            }

            await upload(picked.assets[0]);
        });

    const fromCamera = () =>
        void submit(async () => {
            const allowed = await ImagePicker.requestCameraPermissionsAsync();

            if (!allowed.granted) {
                throw new Error('camera-denied');
            }

            const taken = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.85,
            });

            if (taken.canceled) {
                return;
            }

            await upload(taken.assets[0]);
        });

    const remove = () =>
        void submit(async () => {
            await session.authenticatedRequest<void>('/profile/avatar', { method: 'DELETE' });

            setPicking(false);

            await session.reload();
        });

    return (
        <SafeAreaView className="bg-background flex-1" edges={['top']}>
            <ScrollView contentContainerClassName="gap-5 p-6">
                <ScreenHeader title="Account">
                    <BusinessChip />
                </ScreenHeader>

                <FormMessage message={message ?? errorFor('avatar') ?? null} />

                <View className="flex-row items-center gap-4">
                    <View>
                        <Avatar nickname={user.nickname} url={user.avatar_url} size={64} />

                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Change your picture"
                            hitSlop={12}
                            onPress={() => setPicking(true)}
                            className="bg-foreground border-card absolute -bottom-0.5 -right-0.5 size-7 items-center justify-center rounded-full border-2"
                        >
                            <Camera color={colours.background} size={13} />
                        </Pressable>
                    </View>

                    <View className="min-w-0 flex-1 gap-1">
                        <Text className="text-lg font-semibold" numberOfLines={1}>
                            {user.nickname}
                        </Text>
                        {user.fullname ? (
                            <Text className="text-muted-foreground text-sm" numberOfLines={1}>
                                {user.fullname}
                            </Text>
                        ) : null}
                        <Text className="text-muted-foreground text-sm" numberOfLines={1}>
                            {user.email}
                        </Text>
                    </View>

                    <StatusPill tone={user.identification_verified ? 'success' : 'neutral'}>
                        {user.identification_verified ? 'verified' : 'not verified'}
                    </StatusPill>
                </View>

                <SettingsList rows={ROWS} />

                <Button variant="ghost" onPress={() => void session.logout()}>
                    Log out
                </Button>
            </ScrollView>

            <PictureSheet
                open={picking}
                has={user.avatar}
                busy={busy}
                onLibrary={fromLibrary}
                onCamera={fromCamera}
                onRemove={remove}
                onDismiss={() => setPicking(false)}
            />
        </SafeAreaView>
    );
}
