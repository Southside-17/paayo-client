import { Directory, File, FileMode, Paths, UploadType } from 'expo-file-system';

import type { Attachment } from '@/lib/types';

/**
 * How many parts are in the air at once.
 */
const LANES = 3;

/**
 * How much of a part is moved between files at a time.
 */
const CARVE = 1024 * 1024;

/** What the picker hands back for a photo or a video. */
export type Picked = {
    uri: string;
    mimeType?: string | null;
    fileName?: string | null;
};

/** Somewhere to put one part, and whether it is already there. */
type Part = {
    number: number;
    offset: number;
    size: number;
    uploaded: boolean;
    url: string;
};

type Grant = { part_size: number; parts: Part[] };

type Opened = { data: Attachment; upload: Grant };

type Send = <T>(
    path: string,
    options?: {
        method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
        body?: unknown;
    },
) => Promise<T>;

/** A name to file it under, from whatever the picker chose to tell us. */
function nameFor(asset: Picked, mime: string): string {
    if (asset.fileName) {
        return asset.fileName;
    }

    return mime.startsWith('video/') ? 'video.mp4' : 'photo.jpg';
}

/**
 * Copy one part of the source onto disk of its own.
 */
function carve(source: File, part: Part, into: Directory): File {
    const slice = new File(into, `part-${part.number}`);

    if (slice.exists) {
        slice.delete();
    }

    slice.create();

    const reader = source.open(FileMode.ReadOnly);
    const writer = slice.open(FileMode.WriteOnly);

    try {
        reader.offset = part.offset;

        for (let done = 0; done < part.size; ) {
            const piece = reader.readBytes(Math.min(CARVE, part.size - done));

            if (piece.length === 0) {
                break;
            }

            writer.writeBytes(piece);
            done += piece.length;
        }
    } finally {
        reader.close();
        writer.close();
    }

    return slice;
}

/**
 * Put one part where the server said to put it.
 */
async function putPart(part: Part, body: File, onMoved: (bytes: number) => void): Promise<boolean> {
    const task = body.createUploadTask(part.url, {
        httpMethod: 'PUT',
        uploadType: UploadType.BINARY_CONTENT,
        sessionType: 'foreground',
        onProgress: ({ bytesSent }) => onMoved(Math.min(bytesSent, part.size)),
    });

    try {
        const landed = await task.uploadAsync();

        // A refusal is not a throw: a part that did not land is one to send
        // again under a fresh signature, which the caller does in a batch.
        onMoved(landed.status >= 200 && landed.status < 300 ? part.size : 0);

        return landed.status >= 200 && landed.status < 300;
    } catch {
        onMoved(0);

        return false;
    }
}

/** Work through the queue with a fixed number of parts in the air. */
async function inLanes(parts: Part[], work: (part: Part) => Promise<void>): Promise<void> {
    const queue = [...parts];

    await Promise.all(
        Array.from({ length: Math.min(LANES, queue.length) }, async () => {
            for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
                await work(next);
            }
        }),
    );
}

/**
 * Send one file to the store, a part at a time and several parts at once.
 */
export async function uploadAttachment(
    send: Send,
    asset: Picked,
    onProgress?: (fraction: number) => void,
): Promise<Attachment> {
    const source = new File(asset.uri);
    const size = source.size;
    const mime = asset.mimeType || source.type || 'application/octet-stream';

    const opened = await send<Opened>('/attachments', {
        method: 'POST',
        body: { name: nameFor(asset, mime), mime, size },
    });

    const id = opened.data.id;
    const scratch = new Directory(Paths.cache, 'uploads', id);
    const moved = new Map<number, number>();

    const report = () => {
        let sent = 0;

        for (const bytes of moved.values()) {
            sent += bytes;
        }

        onProgress?.(size === 0 ? 1 : sent / size);
    };

    const push = async (parts: Part[]): Promise<Part[]> => {
        const failed: Part[] = [];
        const pending = parts.filter((part) => !part.uploaded);

        // A file that fits in one part is sent as it lies. Every photo does,
        // and carving one would be copying it to send it.
        const whole = pending.length === 1 && pending[0].size === size;

        if (!whole && pending.length > 0) {
            scratch.create({ intermediates: true, overwrite: true });
        }

        await inLanes(pending, async (part) => {
            const body = whole ? source : carve(source, part, scratch);

            try {
                if (!(await putPart(part, body, (bytes) => {
                    moved.set(part.number, bytes);
                    report();
                }))) {
                    failed.push(part);
                }
            } finally {
                if (!whole) {
                    body.delete();
                }
            }
        });

        return failed;
    };

    for (const part of opened.upload.parts) {
        if (part.uploaded) {
            moved.set(part.number, part.size);
        }
    }

    report();

    try {
        if ((await push(opened.upload.parts)).length > 0) {
            const again = await send<Opened>(`/attachments/${id}/parts`);

            if ((await push(again.upload.parts)).length > 0) {
                throw new Error('Some of that file did not go up. Try again.');
            }
        }
    } finally {
        if (scratch.exists) {
            scratch.delete();
        }
    }

    const { data } = await send<{ data: Attachment }>(`/attachments/${id}/completion`, {
        method: 'POST',
    });

    return data;
}

/** Throw away an upload the person removed before booking. */
export async function discardAttachment(send: Send, id: string): Promise<void> {
    await send<void>(`/attachments/${id}`, { method: 'DELETE' });
}
