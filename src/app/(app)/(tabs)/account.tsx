import * as ImagePicker from 'expo-image-picker';
import Link2 from 'lucide-react-native/icons/link-2';
import MapPin from 'lucide-react-native/icons/map-pin';
import Pencil from 'lucide-react-native/icons/pencil';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BusinessSwitch } from '@/components/business-switch';
import { FormMessage } from '@/components/form-message';
import { SettingsList, type SettingsRow } from '@/components/settings-list';
import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import { AVATAR_SIZE, preparePicture } from '@/lib/picture';
import { useSession } from '@/lib/session';
import type { MessageResponse } from '@/lib/types';
import { useSubmit } from '@/lib/use-submit';

/**
 * One word each. "Provider" is deliberately not among them: in this codebase it
 * names a service company, never a way of signing in.
 */
const ROWS: SettingsRow[] = [
    { icon: Pencil, label: 'Profile', note: 'Nickname, email, phone', href: '/profile/edit' },
    { icon: MapPin, label: 'Address', note: 'Where you want work done', href: '/profile/addresses' },
    { icon: Link2, label: 'Sign-in', note: 'Google and the other ways in', href: '/profile/socials' },
    { icon: ShieldCheck, label: 'Security', note: 'Password, passkeys, two factor', href: '/security' },
];

/**
 * The account, as its owner sees it.
 */
export default function Account() {
    const session = useSession();
    const { busy, message, errorFor, submit } = useSubmit();
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

            const part = await preparePicture(picked.assets[0], AVATAR_SIZE, 'avatar.jpg');
            const body = new FormData();

            body.append('avatar', part as unknown as Blob);

            await session.authenticatedRequest<MessageResponse>('/profile/avatar', {
                method: 'POST',
                body,
            });

            await session.reload();
        });

    const removePicture = () =>
        submit(async () => {
            await session.authenticatedRequest<void>('/profile/avatar', { method: 'DELETE' });

            await session.reload();
        });

    return (
        <SafeAreaView className="bg-background flex-1" edges={['top']}>
            <ScrollView contentContainerClassName="gap-5 p-6">
                <ScreenHeader title="Account" />

                {/* The picture has no input to sit under, so its field error
                    belongs in the whole-form message. Without this a refused
                    upload -- too large, wrong dimensions -- says nothing at
                    all: useSubmit files it under the field and moves on. */}
                <FormMessage message={message ?? errorFor('avatar') ?? null} />

                <View className="flex-row items-center gap-4">
                    <Avatar nickname={user.nickname} url={user.avatar_url} size={64} />

                    <View className="flex-1 gap-1">
                        <Text className="text-lg font-semibold">{user.nickname}</Text>
                        {user.fullname ? (
                            <Text className="text-muted-foreground text-sm">{user.fullname}</Text>
                        ) : null}
                        <Text className="text-muted-foreground text-sm">{user.email}</Text>
                        <StatusPill tone={user.identification_verified ? 'success' : 'neutral'}>
                            {user.identification_verified ? 'verified' : 'not verified'}
                        </StatusPill>
                    </View>
                </View>

                <BusinessSwitch businesses={user.staffs ?? []} />

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

                <SettingsList rows={ROWS} />

                <Button variant="ghost" onPress={() => void session.logout()}>
                    Log out
                </Button>
            </ScrollView>
        </SafeAreaView>
    );
}
