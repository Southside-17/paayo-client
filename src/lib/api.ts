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
 * An error whose message was written for the person to read.
 *
 * Everything else a form catches is a transport failure, which gets the generic
 * wording, so a refusal that already explains itself needs a way to say so.
 */
export class DisplayableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DisplayableError';
    }
}

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

type Payload = { message?: string; errors?: ValidationErrors } | null;

type Answer = { status: number; payload: Payload };

/**
 * Send a request the way the platform still supports for file uploads.
 *
 * Expo SDK 57 replaces `globalThis.fetch` with its own implementation
 * (`install('fetch', ...)` in expo/src/winter/runtime.native.ts), and that one
 * only understands a string, a Blob, or something carrying `bytes()`. React
 * Native's own `{uri, name, type}` file part reaches its `else` and throws
 * `Unsupported FormDataPart implementation` before a socket is ever opened --
 * which useSubmit reports as a connection failure, because that is what an
 * error with no status looks like from the outside.
 *
 * XMLHttpRequest is untouched by that swap. It hands a FormData to
 * `convertRequestBody`, which turns it into the native part list the
 * networking layer wants, and that is what fetch itself used to do.
 */
function sendMultipart(
    url: string,
    method: RequestMethod,
    headers: Record<string, string>,
    body: FormData,
): Promise<Answer> {
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();

        request.open(method, url);

        // Never set Content-Type here: only the native layer knows the
        // boundary it is about to generate.
        for (const [name, value] of Object.entries(headers)) {
            request.setRequestHeader(name, value);
        }

        request.onload = () =>
            resolve({
                status: request.status,
                payload: request.status === 204 ? null : parse(request.responseText),
            });
        request.onerror = () => reject(new TypeError('Network request failed'));
        request.ontimeout = () => reject(new TypeError('Network request timed out'));

        request.send(body);
    });
}

/** Everything that is not a file, through the ordinary client. */
async function sendJson(
    url: string,
    method: RequestMethod,
    headers: Record<string, string>,
    body: unknown,
): Promise<Answer> {
    const response = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    // A 204 carries no body, which parsing would choke on.
    return {
        status: response.status,
        payload: response.status === 204 ? null : await response.json().catch(() => null),
    };
}

/**
 * Call the API and unwrap the response.
 *
 * A 204 carries no body, so it resolves to undefined and callers that expect
 * nothing type it as void.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, token } = options;
    const multipart = body instanceof FormData;

    const headers: Record<string, string> = {
        Accept: 'application/json',
        ...(body && !multipart ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const url = `${API_URL}${PREFIX}${path}`;

    const { status, payload } = multipart
        ? await sendMultipart(url, method, headers, body)
        : await sendJson(url, method, headers, body);

    if (status === 204) {
        return undefined as T;
    }

    if (status < 200 || status >= 300) {
        throw new ApiError(
            status,
            payload?.message ?? `Request failed (${status}).`,
            payload?.errors ?? {},
        );
    }

    return payload as T;
}

/** A body that is not JSON tells us nothing, so it is read as nothing. */
function parse(text: string): Payload {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}
