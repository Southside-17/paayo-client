import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * The server as seen from a simulator. An Android emulator reaches the host
 * through 10.0.2.2; an iOS simulator shares the host's own loopback. A physical
 * device needs EXPO_PUBLIC_API_URL set to a LAN address.
 */
export const API_URL =
    process.env.EXPO_PUBLIC_API_URL ??
    Platform.select({ android: 'http://10.0.2.2:8000', default: 'http://localhost:8000' })!;

const PREFIX = '/api/v1';

/** The name this device is given to the tokens it is issued. */
export const DEVICE_NAME = `${Constants.deviceName ?? 'Unknown device'} (${Platform.OS})`;

type ValidationErrors = Record<string, string[]>;

/**
 * A response the server refused. Carries the field errors from a 422 so a form
 * can render them against the inputs that caused them.
 */
export class ApiError extends Error {
    constructor(
        readonly status: number,
        message: string,
        readonly errors: ValidationErrors = {},
    ) {
        super(message);
        this.name = 'ApiError';
    }

    get isUnauthenticated(): boolean {
        return this.status === 401;
    }

    get isThrottled(): boolean {
        return this.status === 429;
    }

    /** The first message for a field, for rendering beneath an input. */
    errorFor(field: string): string | undefined {
        return this.errors[field]?.[0];
    }
}

export type RequestMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

type RequestOptions = {
    method?: RequestMethod;
    body?: unknown;
    token?: string | null;
};

/**
 * Call the API and unwrap the response.
 *
 * A 204 carries no body, which JSON.parse would choke on, so it resolves to
 * undefined and callers that expect nothing type it as void.
 *
 * FormData is passed through untouched and deliberately carries no
 * Content-Type: only the runtime knows the multipart boundary it is about to
 * generate, and naming the type ourselves omits it and the request is rejected.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, token } = options;
    const multipart = body instanceof FormData;

    const response = await fetch(`${API_URL}${PREFIX}${path}`, {
        method,
        headers: {
            Accept: 'application/json',
            ...(body && !multipart ? { 'Content-Type': 'application/json' } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: multipart ? body : body ? JSON.stringify(body) : undefined,
    });

    if (response.status === 204) {
        return undefined as T;
    }

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        throw new ApiError(
            response.status,
            payload?.message ?? `Request failed (${response.status}).`,
            payload?.errors ?? {},
        );
    }

    return payload as T;
}
