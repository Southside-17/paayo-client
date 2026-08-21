import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { Text } from '@/components/ui/text';

type Props = { title: string; subtitle?: string; children: ReactNode };

/** The shared shell for every signed-out screen: brand mark, heading, form. */
export function AuthScreen({ title, subtitle, children }: Props) {
    return (
        <KeyboardAvoidingView
            className="bg-background flex-1"
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView
                contentContainerClassName="grow justify-center px-6 py-16"
                keyboardShouldPersistTaps="handled"
            >
                <View className="mx-auto w-full max-w-sm gap-6">
                    <View className="items-center gap-3">
                        <View className="bg-brand-subtle size-14 items-center justify-center rounded-2xl">
                            <Text className="text-brand text-2xl font-bold">P</Text>
                        </View>
                        <View className="gap-1">
                            <Text className="text-center text-2xl font-bold">{title}</Text>
                            {subtitle ? (
                                <Text className="text-muted-foreground text-center text-sm">
                                    {subtitle}
                                </Text>
                            ) : null}
                        </View>
                    </View>

                    {children}
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
