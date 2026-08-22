import { request } from '../api';

/**
 * Expo SDK 57 swaps globalThis.fetch for its own, and that one rejects React
 * Native's {uri, name, type} file part outright -- so a file goes through
 * XMLHttpRequest, which still hands it to the native networking layer.
 */
type FakeXhr = {
    open: jest.Mock;
    setRequestHeader: jest.Mock;
    send: jest.Mock;
    status: number;
    responseText: string;
    onload?: () => void;
    onerror?: () => void;
    ontimeout?: () => void;
};

function xhr(status: number, body: string): FakeXhr {
    const instance: FakeXhr = {
        open: jest.fn(),
        setRequestHeader: jest.fn(),
        send: jest.fn(() => {
            instance.status = status;
            instance.responseText = body;
            instance.onload?.();
        }),
        status: 0,
        responseText: '',
    };

    // @ts-expect-error -- the test replaces the global constructor
    global.XMLHttpRequest = jest.fn(() => instance);

    return instance;
}

it('sends a file through XMLHttpRequest, not through fetch', async () => {
    const fetchMock = jest.fn();
    // @ts-expect-error -- the test replaces the global fetch
    global.fetch = fetchMock;

    const instance = xhr(200, '{"message":"Picture updated."}');
    const body = new FormData();
    body.append('avatar', { uri: 'file:///a.jpg', name: 'a.jpg', type: 'image/jpeg' } as never);

    const answer = await request<{ message: string }>('/profile/avatar', {
        method: 'POST',
        body,
        token: 'a-token',
    });

    expect(answer.message).toBe('Picture updated.');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(instance.send).toHaveBeenCalledWith(body);
});

// Naming the type ourselves would arrive without the boundary only the native
// layer knows, and the server would refuse the body.
it('names no content type on a file', async () => {
    const instance = xhr(200, '{}');
    const body = new FormData();
    body.append('avatar', 'file');

    await request('/profile/avatar', { method: 'POST', body, token: 'a-token' });

    const named = instance.setRequestHeader.mock.calls.map((call) => call[0] as string);

    expect(named).not.toContain('Content-Type');
    expect(instance.setRequestHeader).toHaveBeenCalledWith('Authorization', 'Bearer a-token');
});

it('raises the server’s refusal of a file, rather than a transport failure', async () => {
    xhr(422, '{"message":"The avatar field must be an image.","errors":{"avatar":["nope"]}}');

    const body = new FormData();
    body.append('avatar', 'file');

    await expect(request('/profile/avatar', { method: 'POST', body })).rejects.toMatchObject({
        status: 422,
        errors: { avatar: ['nope'] },
    });
});

it('still serialises a plain object as json', async () => {
    const fetchMock = jest.fn(async () => ({
        status: 200,
        json: async () => ({ message: 'Profile updated.' }),
    }));

    // @ts-expect-error -- the test replaces the global fetch
    global.fetch = fetchMock;

    await request('/profile', { method: 'PUT', body: { nickname: 'Mara' } });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];

    expect(init.body).toBe('{"nickname":"Mara"}');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
});
