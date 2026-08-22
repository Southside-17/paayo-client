import type { Attachment } from '@/lib/types';

/** How much of a file one request carries. */
const PART = 4 * 1024 * 1024;

/** What the picker hands back for a photo or a video. */
export type Picked = {
    uri: string;
    mimeType?: string | null;
    fileName?: string | null;
};

type Send = <T>(
    path: string,
    options?: {
        method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
        body?: unknown;
        onProgress?: (sent: number, total: number) => void;
    },
) => Promise<T>;

/**
 * Read a local file as a blob.
 *
 * XHR rather than fetch: Expo's fetch does not read a file:// URI, and a blob
 * read this way can be sliced without copying anything.
 */
function readFile(uri: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();

        request.open('GET', uri);
        request.responseType = 'blob';
        request.onload = () => resolve(request.response as Blob);
        request.onerror = () => reject(new Error('That file could not be read.'));
        request.send();
    });
}

/** A name to file it under, from whatever the picker chose to tell us. */
function nameFor(asset: Picked, mime: string): string {
    if (asset.fileName) {
        return asset.fileName;
    }

    return mime.startsWith('video/') ? 'video.mp4' : 'photo.jpg';
}

/**
 * Send one file to the server a part at a time.
 *
 * Chunked because a whole request is buffered before any of it reaches the
 * application: one part is 4MB whatever the video weighs, and a connection that
 * drops resumes from the last part rather than starting the file again.
 *
 * `onProgress` is called with a fraction of the whole file, counting parts
 * already landed plus movement inside the one in flight.
 */
export async function uploadAttachment(
    send: Send,
    asset: Picked,
    onProgress?: (fraction: number) => void,
): Promise<Attachment> {
    // Reading the file is the one step that holds the whole thing at once, and
    // a phone video is tens of megabytes. If an upload dies without a JS error,
    // this is the line that says how far it got.
    if (__DEV__) {
        console.log('[upload] reading', asset.uri, asset.mimeType);
    }

    const blob = await readFile(asset.uri);
    const mime = asset.mimeType ?? blob.type ?? 'application/octet-stream';

    if (__DEV__) {
        console.log('[upload] read', blob.size, 'bytes as', mime);
    }

    const { data: opened } = await send<{ data: Attachment }>('/attachments', {
        method: 'POST',
        body: { name: nameFor(asset, mime), mime, size: blob.size },
    });

    let sent = 0;

    while (sent < blob.size) {
        const end = Math.min(sent + PART, blob.size);
        const landed = sent;

        await send<{ data: Attachment }>(`/attachments/${opened.id}?offset=${landed}`, {
            method: 'PATCH',
            body: blob.slice(landed, end),
            onProgress: (moved) => onProgress?.((landed + moved) / blob.size),
        });

        sent = end;
        onProgress?.(sent / blob.size);

        if (__DEV__) {
            console.log('[upload] part', sent, 'of', blob.size);
        }
    }

    const { data } = await send<{ data: Attachment }>(
        `/attachments/${opened.id}/completion`,
        { method: 'POST' },
    );

    return data;
}

/** Throw away an upload the person removed before booking. */
export async function discardAttachment(send: Send, id: string): Promise<void> {
    await send<void>(`/attachments/${id}`, { method: 'DELETE' });
}
