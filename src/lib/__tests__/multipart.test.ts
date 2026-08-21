import { request } from '../api';

/**
 * The runtime, not us, decides the multipart boundary, so a Content-Type we
 * wrote ourselves would arrive without one and be rejected.
 */
it('sends FormData untouched and names no content type', async () => {
    const fetchMock = jest.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Picture updated.' }),
    }));

    // @ts-expect-error -- the test replaces the global fetch
    global.fetch = fetchMock;

    const body = new FormData();
    body.append('avatar', 'file');

    await request('/profile/avatar', { method: 'POST', body, token: 'a-token' });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];

    expect(init.body).toBe(body);
    expect(init.headers).not.toHaveProperty('Content-Type');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer a-token' });
});

it('still serialises a plain object as json', async () => {
    const fetchMock = jest.fn(async () => ({
        ok: true,
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
