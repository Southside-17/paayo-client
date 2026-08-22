import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** The longest side a picture is stored at. */
export const AVATAR_SIZE = 512;

/** The shape React Native's FormData wants for a local file. */
export type Upload = { uri: string; name: string; type: string };

type Picked = { uri: string; width: number };

/**
 * Shrink a picked image to something worth uploading.
 *
 * The picker's crop settles the shape, never the resolution -- allowsEditing
 * and aspect are geometry, and quality is only JPEG compression. A square crop
 * of a full-size camera photo comes back at the source's own pixels, which is
 * megabytes to draw a picture the app never renders above 72pt.
 *
 * Everything is re-saved as JPEG whatever it arrived as, so the part carries a
 * name and a type the server can match against `mimes` rather than whatever
 * the picker happened to report.
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
