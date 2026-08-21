import { Link } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useSession } from '@/lib/session';

export default function Home() {
    const session = useSession();

    if (session.status !== 'authenticated') {
        return null;
    }

    const { user } = session;

    return (
        <SafeAreaView className="bg-background flex-1">
            <View className="gap-6 p-6">
                <View className="gap-1">
                    <Text className="text-muted-foreground text-sm">Signed in as</Text>
                    <Text className="text-2xl font-bold">{user.nickname}</Text>
                    {user.fullname ? (
                        <Text className="text-muted-foreground text-sm">{user.fullname}</Text>
                    ) : null}
                </View>

                <Card className="gap-3">
                    <View className="flex-row items-center justify-between">
                        <Text className="text-sm">Email</Text>
                        <Text className="text-success text-sm font-medium">Confirmed</Text>
                    </View>
                    <View className="flex-row items-center justify-between">
                        <Text className="text-sm">Identification</Text>
                        <Text
                            className={
                                user.identification_verified
                                    ? 'text-success text-sm font-medium'
                                    : 'text-muted-foreground text-sm font-medium'
                            }
                        >
                            {user.identification_verified ? 'Verified' : 'Not verified'}
                        </Text>
                    </View>
                </Card>

                <Link href="/profile" asChild>
                    <Button variant="outline">Profile</Button>
                </Link>

                <Button variant="ghost" onPress={() => void session.logout()}>
                    Log out
                </Button>
            </View>
        </SafeAreaView>
    );
}
