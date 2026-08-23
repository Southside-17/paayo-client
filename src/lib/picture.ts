import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** The longest side a picture is stored at. */
export const AVATAR_SIZE = 512;

/** The shape React Native's FormData wants for a local file. */
export type Upload = { uri: string; name: string; type: string };

type Picked = { uri: string; width: number };

/**
 * Shrink a picked image to something worth uploading.
 */
export async function preparePicture(
    asset: Picked,
    longestSide: number,
    name: string,
): Promise<Upload> {
    let context = ImageManipulator.manipulate(asset.uri);

    // Resizing up would cost bytes to add blur. Only ever come down.
    if (asset.width > longestSide) {
        context = context.resize({ width: longestSide });
    }

    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });

    return { uri: saved.uri, name, type: 'image/jpeg' };
}
