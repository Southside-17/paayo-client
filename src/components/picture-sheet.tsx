import Camera from 'lucide-react-native/icons/camera';
import ImageIcon from 'lucide-react-native/icons/image';
import Trash2 from 'lucide-react-native/icons/trash-2';

import { Sheet } from '@/components/ui/sheet';
import { SheetAction } from '@/components/ui/sheet-action';
import { Text } from '@/components/ui/text';

type Props = {
    open: boolean;
    /** Whether there is a picture to take away. */
    has: boolean;
    busy?: boolean;
    onLibrary: () => void;
    onCamera: () => void;
    onRemove: () => void;
    onDismiss: () => void;
};

/**
 * The three things you can do to a profile picture.
 *
 * Remove is only in the list when there is one -- an action that cannot happen
 * has no business being offered.
 */
export function PictureSheet({
    open,
    has,
    busy = false,
    onLibrary,
    onCamera,
    onRemove,
    onDismiss,
}: Props) {
    return (
        <Sheet open={open} onDismiss={onDismiss} label="Profile picture">
            <Text className="text-base font-bold">Profile picture</Text>

            <SheetAction icon={ImageIcon} disabled={busy} onPress={onLibrary}>
                Choose from library
            </SheetAction>

            <SheetAction icon={Camera} disabled={busy} onPress={onCamera}>
                Take a photo
            </SheetAction>

            {has ? (
                <SheetAction icon={Trash2} tone="destructive" disabled={busy} onPress={onRemove}>
                    Remove photo
                </SheetAction>
            ) : null}

            <SheetAction tone="quiet" onPress={onDismiss}>
                Cancel
            </SheetAction>
        </Sheet>
    );
}
