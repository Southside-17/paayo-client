import { ApiError, request } from '../api';

function respondWith(status: number, body: unknown) {
    globalThis.fetch = jest.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    }) as unknown as typeof fetch;
}

describe('request', () => {
    it('returns the parsed body', async () => {
        respondWith(200, { data: { id: 'u1' } });

        await expect(request('/auth/user')).resolves.toEqual({ data: { id: 'u1' } });
    });

    it('resolves to undefined for a 204, which carries no body', async () => {
        globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 204 }) as unknown as typeof fetch;

        await expect(request('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
    });

    it('turns a 422 into field errors', async () => {
        respondWith(422, {
            message: 'The given data was invalid.',
            errors: { email: ['Wrong email or password'] },
        });

        const error = (await request('/auth/login', { method: 'POST' }).catch((caught) => caught)) as ApiError;

        expect(error).toBeInstanceOf(ApiError);
        expect(error.status).toBe(422);
        expect(error.errorFor('email')).toBe('Wrong email or password');
    });

    it('flags a throttled response', async () => {
        respondWith(429, { message: 'Too many attempts.' });

        const error = (await request('/auth/login', { method: 'POST' }).catch((caught) => caught)) as ApiError;

        expect(error.isThrottled).toBe(true);
    });

    it('flags an expired token', async () => {
        respondWith(401, { message: 'Unauthenticated.' });

        const error = (await request('/auth/user').catch((caught) => caught)) as ApiError;

        expect(error.isUnauthenticated).toBe(true);
    });

    it('sends the bearer token when given one', async () => {
        respondWith(200, {});

        await request('/auth/user', { token: 'secret-token' });

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/v1/auth/user'),
            expect.objectContaining({
                headers: expect.objectContaining({ Authorization: 'Bearer secret-token' }),
            }),
        );
    });
});
