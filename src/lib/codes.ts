import { Directory, File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

/**
 * Keeping and passing on the QR a business publishes.
 *
 * The link is signed and short-lived, so both of these fetch the bytes first --
 * handing the URL itself to a share sheet would pass on something that stops
 * working within the hour.
 */

/** Where a fetched code is put before it is saved or shared. */
function scratch(): Directory {
    const directory = new Directory(Paths.cache, 'codes');

    if (!directory.exists) {
        directory.create({ intermediates: true });
    }

    return directory;
}

/**
 * Fetch a code to a local file, answering with where it landed.
 */
async function fetchCode(url: string, name: string): Promise<File> {
    const held = new File(scratch(), name);

    if (held.exists) {
        held.delete();
    }

    return File.downloadFileAsync(url, held);
}

/**
 * Put a code in the phone's own photos.
 *
 * Answers false when permission was refused rather than throwing: somebody who
 * says no to the photo library has not hit an error, and the screen should say
 * so plainly instead of showing them a failure.
 */
export async function saveCode(url: string, name: string): Promise<boolean> {
    const granted = await MediaLibrary.requestPermissionsAsync(true);

    if (!granted.granted) {
        return false;
    }

    const file = await fetchCode(url, name);

    await MediaLibrary.saveToLibraryAsync(file.uri);

    return true;
}

/**
 * Hand a code to the share sheet, so it can be sent on or saved from there.
 *
 * Worth having beside saving: sending a client the code before the visit is what
 * a business actually wants, and it saves the crew showing a screen at the door.
 */
export async function shareCode(url: string, name: string): Promise<boolean> {
    if (!(await Sharing.isAvailableAsync())) {
        return false;
    }

    const file = await fetchCode(url, name);

    await Sharing.shareAsync(file.uri, {
        mimeType: 'image/png',
        dialogTitle: 'Send this QR',
        UTI: 'public.png',
    });

    return true;
}
