import { Modal, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

type Props = {
    open: boolean;
    title: string;
    body: string;
    /** Says what happens, not "OK". */
    confirm: string;
    /** The way out. Never the word the confirming button uses. */
    dismiss: string;
    destructive?: boolean;
    busy?: boolean;
    onConfirm: () => void;
    onDismiss: () => void;
};

/**
 * Asks before something that commits or cannot be undone.
 *
 * Ours rather than the platform's: React Native's Alert draws in the operating
 * system's own colours and typeface, which in this app reads as a dialog from
 * another application.
 */
export function ConfirmDialog({
    open,
    title,
    body,
    confirm,
    dismiss,
    destructive = false,
    busy = false,
    onConfirm,
    onDismiss,
}: Props) {
    return (
        <Modal
            visible={open}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onDismiss}
        >
            {/* The backdrop dismisses, which is what tapping outside a dialog
                means everywhere else on the platform. */}
            <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss"
                onPress={onDismiss}
                className="flex-1 justify-center bg-black/60 px-8"
            >
                <Pressable
                    className="bg-card border-border gap-4 rounded-2xl border p-6"
                    onPress={() => undefined}
                >
                    <View className="gap-2">
                        <Text className="text-lg font-bold">{title}</Text>
                        <Text className="text-muted-foreground text-sm">{body}</Text>
                    </View>

                    <View className="gap-2">
                        <Button
                            variant={destructive ? 'destructive' : 'brand'}
                            onPress={onConfirm}
                            busy={busy}
                        >
                            {confirm}
                        </Button>
                        <Button variant="ghost" onPress={onDismiss}>
                            {dismiss}
                        </Button>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}
