import { IconCheck } from '@tabler/icons-react-native';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { API_URL } from '@/lib/api';
import { cn } from '@/lib/utils';

type Props = {
    value: boolean;
    onValueChange: (value: boolean) => void;
    disabled?: boolean;
};

/** Open a published document without leaving the app. */
export function openDocument(path: string) {
    return WebBrowser.openBrowserAsync(`${API_URL}${path}`);
}

/**
 * The two published documents, and the tick that records agreeing to them.
 */
export function LegalConsent({ value, onValueChange, disabled = false }: Props) {
    const toggle = () => onValueChange(!value);

    return (
        <View className="flex-row items-start gap-3">
            <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel="Accept the privacy policy and the user agreement"
                accessibilityState={{ checked: value, disabled }}
                disabled={disabled}
                onPress={toggle}
                hitSlop={8}
                className={cn(
                    'mt-0.5 size-6 items-center justify-center rounded-md border',
                    value ? 'bg-brand border-brand' : 'border-input bg-card',
                    disabled && 'opacity-50',
                )}
            >
                {value ? <IconCheck size={16} color="white" /> : null}
            </Pressable>

            <Pressable className="flex-1" disabled={disabled} onPress={toggle}>
                <Text className="text-muted-foreground text-sm leading-5">
                    I have read and accept the{' '}
                    <Text className="text-brand text-sm underline" onPress={() => openDocument('/privacy-policy')}>
                        Privacy Policy
                    </Text>{' '}
                    and the{' '}
                    <Text className="text-brand text-sm underline" onPress={() => openDocument('/user-agreement')}>
                        User Agreement
                    </Text>
                    .
                </Text>
            </Pressable>
        </View>
    );
}
