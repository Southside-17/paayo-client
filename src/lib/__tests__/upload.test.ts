import { uploadAttachment } from '@/lib/upload';

/** A stand-in for the blob XHR hands back when reading a local file. */
function fakeBlob(size: number): Blob {
    const slices: [number, number][] = [];

    return {
        size,
        type: 'image/jpeg',
        slice: (start: number, end: number) => {
            slices.push([start, end]);

            return { size: end - start, type: '', __range: [start, end] } as unknown as Blob;
        },
        __slices: slices,
    } as unknown as Blob;
}

function readingFile(blob: Blob) {
    class MockXHR {
        response: unknown = blob;
        responseType = '';
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        open() {}
        send() {
            this.onload?.();
        }
    }

    (globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = MockXHR;
}

const FOUR_MB = 4 * 1024 * 1024;

it('opens the upload, sends the file in parts, then seals it', async () => {
    const blob = fakeBlob(FOUR_MB + 1024);

    readingFile(blob);

    const calls: { path: string; method?: string }[] = [];
    const send = jest.fn(async (path: string, options?: { method?: string }) => {
        calls.push({ path, method: options?.method });

        return { data: { id: 'att-1' } };
    });

    await uploadAttachment(send as never, {
        uri: 'file:///aircon.jpg',
        mimeType: 'image/jpeg',
        fileName: 'aircon.jpg',
    });

    expect(calls).toEqual([
        { path: '/attachments', method: 'POST' },
        { path: '/attachments/att-1?offset=0', method: 'PATCH' },
        { path: `/attachments/att-1?offset=${FOUR_MB}`, method: 'PATCH' },
        { path: '/attachments/att-1/completion', method: 'POST' },
    ]);

    // Sequential, contiguous, and never past the end of the file.
    expect((blob as unknown as { __slices: [number, number][] }).__slices).toEqual([
        [0, FOUR_MB],
        [FOUR_MB, FOUR_MB + 1024],
    ]);
});

it('declares the real size so the server knows when the file is whole', async () => {
    readingFile(fakeBlob(1234));

    const send = jest.fn(async (path: string, options?: { body?: unknown }) => {
        void path;
        void options;

        return { data: { id: 'att-1' } };
    });

    await uploadAttachment(send as never, { uri: 'file:///a.jpg', mimeType: 'image/jpeg' });

    const opened = send.mock.calls[0][1] as { body: { size: number; mime: string; name: string } };

    expect(opened.body).toEqual({ name: 'photo.jpg', mime: 'image/jpeg', size: 1234 });
});

it('reports progress across the whole file, not the part in flight', async () => {
    readingFile(fakeBlob(FOUR_MB * 2));

    const seen: number[] = [];

    const send = jest.fn(
        async (
            path: string,
            options?: { onProgress?: (sent: number, total: number) => void },
        ) => {
            // Half of this part has moved.
            options?.onProgress?.(FOUR_MB / 2, FOUR_MB);

            return { data: { id: 'att-1' } };
        },
    );

    await uploadAttachment(
        send as never,
        { uri: 'file:///clip.mp4', mimeType: 'video/mp4' },
        (fraction) => seen.push(fraction),
    );

    // A quarter through the first part, half at its end, three quarters into
    // the second, and whole.
    expect(seen).toEqual([0.25, 0.5, 0.75, 1]);
});
