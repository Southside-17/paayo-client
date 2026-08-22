import { useCallback, useState } from 'react';

import { ApiError, DisplayableError } from './api';

type Submission = {
    busy: boolean;
    /** The server's message when it refused for a reason no single field owns. */
    message: string | null;
    errorFor: (field: string) => string | undefined;
    submit: (action: () => Promise<void>) => Promise<void>;
};

/**
 * Run a request, holding whatever the server said about why it refused.
 *
 * The server is the validator: a 422 carries per-field messages, and anything
 * else carries one message for the form. Nothing is validated twice on the
 * client beyond what stops an obviously empty submit.
 */
export function useSubmit(): Submission {
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [errors, setErrors] = useState<Record<string, string[]>>({});

    const submit = useCallback(async (action: () => Promise<void>) => {
        setBusy(true);
        setMessage(null);
        setErrors({});

        try {
            await action();
        } catch (error) {
            if (error instanceof ApiError) {
                setErrors(error.errors);
                setMessage(Object.keys(error.errors).length === 0 ? error.message : null);
            } else if (error instanceof DisplayableError) {
                setMessage(error.message);
            } else {
                // Everything that reaches here is a transport failure, and the
                // person is told so in one sentence because there is nothing
                // else they can act on. While developing, the cause has to be
                // visible: a bug in the request reads exactly like dropped
                // Wi-Fi, and swallowing it whole costs an afternoon.
                if (__DEV__) {
                    console.warn('[paayo] request failed', error);
                }

                setMessage('Could not reach Paayo. Check your connection and try again.');
            }
        } finally {
            setBusy(false);
        }
    }, []);

    const errorFor = useCallback((field: string) => errors[field]?.[0], [errors]);

    return { busy, message, errorFor, submit };
}
