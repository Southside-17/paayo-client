import { uploadAttachment } from '@/lib/upload';

type Put = { url: string; bytes: number; source: boolean };

type MockFs = {
    __state: {
        size: number;
        reads: [number, number][];
        puts: Put[];
        carved: number;
        asked: { sessionType?: string }[];
    };
    __reset: (size: number, refuse?: number) => void;
};

/** One part. Matches PART_SIZE on the server, and a store's 5MB floor. */
const PART = 8 * 1024 * 1024;

/**
 * Stand in for the file system, recording what was read, carved and put.
 */
jest.mock('expo-file-system', () => {
    const state: {
        size: number;
        reads: [number, number][];
        puts: { url: string; bytes: number; source: boolean }[];
        carved: number;
        refuse: number;
        refused: number;
        asked: { sessionType?: string }[];
    } = { size: 0, reads: [], puts: [], carved: 0, refuse: 0, refused: 0, asked: [] };

    class MockHandle {
        offset = 0;
        file: MockFile;

        constructor(file: MockFile) {
            this.file = file;
        }

        readBytes(length: number) {
            const take = Math.min(length, this.file.size - this.offset);

            if (this.file.source) {
                state.reads.push([this.offset, this.offset + take]);
            }

            this.offset += take;

            return new Uint8Array(take);
        }

        writeBytes(bytes: Uint8Array) {
            this.file.size += bytes.length;
        }

        close() {}
    }

    class MockFile {
        size = 0;
        type = 'video/mp4';
        exists = false;
        source = false;

        constructor(...parts: unknown[]) {
            if (typeof parts[0] === 'string') {
                this.source = true;
                this.exists = true;
                this.size = state.size;
            } else {
                state.carved += 1;
            }
        }

        create() {
            this.exists = true;
        }

        delete() {
            this.exists = false;
        }

        open() {
            return new MockHandle(this);
        }

        createUploadTask(
            url: string,
            options: { sessionType?: string; onProgress?: (p: { bytesSent: number }) => void },
        ) {
            state.asked.push({ sessionType: options.sessionType });

            return {
                uploadAsync: async () => {
                    const refusing = state.refused < state.refuse;

                    if (refusing) {
                        state.refused += 1;
                    } else {
                        state.puts.push({ url, bytes: this.size, source: this.source });
                    }

                    options.onProgress?.({ bytesSent: this.size });

                    return { status: refusing ? 403 : 200, body: '', headers: {} };
                },
            };
        }
    }

    class MockDirectory {
        exists = false;
        create() {
            this.exists = true;
        }
        delete() {
            this.exists = false;
        }
    }

    return {
        File: MockFile,
        Directory: MockDirectory,
        Paths: { cache: new MockDirectory() },
        FileMode: { ReadOnly: 'r', WriteOnly: 'w', ReadWrite: 'rw' },
        UploadType: { BINARY_CONTENT: 0, MULTIPART: 1 },
        __state: state,
        __reset: (size: number, refuse = 0) => {
            state.size = size;
            state.reads = [];
            state.puts = [];
            state.carved = 0;
            state.refuse = refuse;
            state.refused = 0;
            state.asked = [];
        },
    };
});

const { __state: disk, __reset: reset } = jest.requireMock<MockFs>('expo-file-system');

/** The grant the server answers an open with: one entry per part of the file. */
function grantFor(size: number, uploaded: number[] = []) {
    const parts = [];

    for (let offset = 0, number = 1; offset < size; offset += PART, number += 1) {
        parts.push({
            number,
            offset,
            size: Math.min(PART, size - offset),
            uploaded: uploaded.includes(number),
            url: `https://store.paayo.test/att-1?partNumber=${number}&X-Amz-Signature=abc`,
        });
    }

    return { part_size: PART, parts };
}

/** A server that opens, re-grants and seals, recording what it was asked. */
function serverFor(size: number, uploaded: number[] = []) {
    const calls: { path: string; method?: string }[] = [];

    const send = jest.fn(async (path: string, options?: { method?: string; body?: unknown }) => {
        calls.push({ path, method: options?.method });

        if (path.endsWith('/completion')) {
            return { data: { id: 'att-1', is_complete: true } };
        }

        return { data: { id: 'att-1' }, upload: grantFor(size, uploaded) };
    });

    return { send, calls };
}

// The bytes go to the store, not through the application. What the application
// gets is an open, possibly a re-grant, and a seal.
it('opens the upload, puts each part at the store, then seals it', async () => {
    reset(PART + 1024);

    const { send, calls } = serverFor(PART + 1024);

    await uploadAttachment(send as never, {
        uri: 'file:///aircon.mp4',
        mimeType: 'video/mp4',
        fileName: 'aircon.mp4',
    });

    expect(calls).toEqual([
        { path: '/attachments', method: 'POST' },
        { path: '/attachments/att-1/completion', method: 'POST' },
    ]);

    expect(disk.puts.map((put: Put) => put.bytes)).toEqual([PART, 1024]);
    expect(disk.puts.map((put: Put) => put.url)).toEqual([
        'https://store.paayo.test/att-1?partNumber=1&X-Amz-Signature=abc',
        'https://store.paayo.test/att-1?partNumber=2&X-Amz-Signature=abc',
    ]);
});

// The whole point. React Native holds a Blob as one allocation, so reading a
// video in to send it put the whole video in memory and got the app killed part
// way up a large one.
it('never reads more than a piece of the file at a time', async () => {
    reset(PART + 1024);

    const { send } = serverFor(PART + 1024);

    await uploadAttachment(send as never, { uri: 'file:///clip.mp4', mimeType: 'video/mp4' });

    const largest = Math.max(...disk.reads.map(([from, to]: [number, number]) => to - from));

    expect(largest).toBeLessThanOrEqual(1024 * 1024);

    // And between them the reads cover the file exactly once, in order.
    const covered = [...disk.reads].sort((a, b) => a[0] - b[0]);

    expect(covered[0][0]).toBe(0);
    expect(covered.at(-1)?.[1]).toBe(PART + 1024);

    for (let i = 1; i < covered.length; i += 1) {
        expect(covered[i][0]).toBe(covered[i - 1][1]);
    }
});

// Carving one would be copying a file in order to send it, and every photo
// lands here after preparePicture has shrunk it.
it('sends a file that fits in one part as it lies, without carving', async () => {
    reset(1234);

    const { send } = serverFor(1234);

    await uploadAttachment(send as never, { uri: 'file:///a.jpg', mimeType: 'image/jpeg' });

    expect(disk.carved).toBe(0);
    expect(disk.reads).toEqual([]);
    expect(disk.puts).toEqual([
        {
            url: 'https://store.paayo.test/att-1?partNumber=1&X-Amz-Signature=abc',
            bytes: 1234,
            source: true,
        },
    ]);
});

it('declares the real size so the server knows how to cut the file up', async () => {
    reset(1234);

    const { send } = serverFor(1234);

    await uploadAttachment(send as never, { uri: 'file:///a.jpg', mimeType: 'image/jpeg' });

    const opened = send.mock.calls[0][1] as { body: { size: number; mime: string; name: string } };

    expect(opened.body).toEqual({ name: 'photo.jpg', mime: 'image/jpeg', size: 1234 });
});

// An app killed mid-upload comes back knowing nothing, so the server reports
// what the store is already holding and those parts are not sent again.
it('skips the parts the store already holds', async () => {
    reset(PART * 2);

    const { send } = serverFor(PART * 2, [1]);

    await uploadAttachment(send as never, { uri: 'file:///clip.mp4', mimeType: 'video/mp4' });

    expect(disk.puts.map((put: Put) => put.url)).toEqual([
        'https://store.paayo.test/att-1?partNumber=2&X-Amz-Signature=abc',
    ]);
});

// A signed address expires, and a long upload outlives one. A part that did not
// land is re-signed and sent again rather than failing the whole file.
it('asks for fresh addresses when a part is refused, and sends it again', async () => {
    reset(1024, 1);

    const { send, calls } = serverFor(1024);

    await uploadAttachment(send as never, { uri: 'file:///a.jpg', mimeType: 'image/jpeg' });

    expect(calls).toEqual([
        { path: '/attachments', method: 'POST' },
        { path: '/attachments/att-1/parts', method: undefined },
        { path: '/attachments/att-1/completion', method: 'POST' },
    ]);

    expect(disk.puts).toHaveLength(1);
});

it('reports progress across the whole file, and finishes at one', async () => {
    reset(PART * 2);

    const seen: number[] = [];
    const { send } = serverFor(PART * 2);

    await uploadAttachment(
        send as never,
        { uri: 'file:///clip.mp4', mimeType: 'video/mp4' },
        (fraction) => seen.push(fraction),
    );

    expect(seen.at(-1)).toBe(1);
    expect(Math.max(...seen)).toBeLessThanOrEqual(1);
});

// An iOS background session waits for connectivity and gives up after seven
// days, so a part the store never answers would leave the attachment at a
// progress that never becomes null -- and Book refuses to place a booking while
// anything is still in flight. The upload has to be able to fail.
it('asks for a foreground session on every part, so a stalled part can fail', async () => {
    reset(PART * 2);

    const { send } = serverFor(PART * 2);

    await uploadAttachment(send as never, { uri: 'file:///clip.mp4', mimeType: 'video/mp4' });

    expect(disk.asked).toHaveLength(2);
    expect(disk.asked.every((asked) => asked.sessionType === 'foreground')).toBe(true);
});

// The retry tile and the re-grant both hang off this: a part that will not land
// has to reach the caller as a rejection, not as an upload that never returns.
it('gives up on a part that is refused twice, rather than waiting on it', async () => {
    reset(1024, 2);

    const { send } = serverFor(1024);

    await expect(
        uploadAttachment(send as never, { uri: 'file:///a.jpg', mimeType: 'image/jpeg' }),
    ).rejects.toThrow('Some of that file did not go up.');
});
