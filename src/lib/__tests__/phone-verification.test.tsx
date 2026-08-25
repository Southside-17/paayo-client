import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import ConfirmPhone from '@/app/(app)/profile/phone';
import { ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';

jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));
jest.mock('expo-router', () => ({
    useLocalSearchParams: () => ({}),
    router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
}));

const user = {
    id: 'u1',
    nickname: 'Mara',
    fullname: null,
    phone: '+639171234567' as string | null,
    phone_verified: false,
    avatar: false,
    email: 'mara@example.com',
    email_verified: true,
    identification_verified: false,
    two_factor_enabled: false,
    has_password: true,
    administrator: false,
    created_at: '2026-01-01T00:00:00.000000Z',
};

type Options = { method?: string; body?: { code?: string } };

/**
 * @param authenticatedRequest What the screen's calls should answer with.
 * @param account Whatever the fixture should differ by.
 */
function signedIn(authenticatedRequest: jest.Mock, account: Partial<typeof user> = {}) {
    const reload = jest.fn().mockResolvedValue({ ...user, ...account });

    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        user: { ...user, ...account },
        token: 'a-token',
        authenticatedRequest,
        reload,
    });

    return reload;
}

/** Ask for a code, and wait until the field it produces is on screen. */
async function askForACode() {
    fireEvent.press(screen.getByText('Text me a code'));

    return await screen.findByPlaceholderText('123456');
}

beforeEach(() => {
    jest.clearAllMocks();
});

it('texts nothing until a code is asked for', () => {
    const request = jest.fn();

    signedIn(request);

    render(<ConfirmPhone />);

    // Each send spends one of six an hour, so opening the screen must not.
    expect(request).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText('123456')).toBeNull();
    expect(screen.getByText('Text me a code')).toBeOnTheScreen();
});

it('asks for a code, and then takes one', async () => {
    const request = jest.fn(async (path: string, options: Options = {}) =>
        options.method === 'POST'
            ? { message: 'Code sent.' }
            : { data: { ...user, phone_verified: true }, message: 'Number confirmed.' },
    );

    signedIn(request);

    render(<ConfirmPhone />);

    await askForACode();

    expect(request).toHaveBeenCalledWith('/profile/phone/verification', { method: 'POST' });
    expect(screen.getByText('Code sent.')).toBeOnTheScreen();
});

it('re-reads the account and goes back once the number is confirmed', async () => {
    const request = jest.fn(async (path: string, options: Options = {}) =>
        options.method === 'POST'
            ? { message: 'Code sent.' }
            : { data: { ...user, phone_verified: true }, message: 'Number confirmed.' },
    );

    const reload = signedIn(request);

    render(<ConfirmPhone />);

    const field = await askForACode();

    fireEvent.changeText(field, '123456');
    fireEvent.press(screen.getByText('Confirm number'));

    await waitFor(() => expect(reload).toHaveBeenCalled());

    expect(request).toHaveBeenCalledWith('/profile/phone/verification', {
        method: 'PUT',
        body: { code: '123456' },
    });
    expect(router.back).toHaveBeenCalled();
});

it('renders a refused code against the field that holds it', async () => {
    const refusal = 'That code is wrong or has expired. Ask for another.';
    const request = jest.fn(async (path: string, options: Options = {}) => {
        if (options.method === 'POST') {
            return { message: 'Code sent.' };
        }

        throw new ApiError(422, 'The given data was invalid.', { code: [refusal] });
    });

    signedIn(request);

    render(<ConfirmPhone />);

    const field = await askForACode();

    fireEvent.changeText(field, '000000');
    fireEvent.press(screen.getByText('Confirm number'));

    expect(await screen.findByText(refusal)).toBeOnTheScreen();

    // The code may still be good; only this attempt was not.
    expect(screen.getByPlaceholderText('123456')).toBeOnTheScreen();
});

it('says the gateway would not take it, in the words the server sent', async () => {
    const refusal = 'We could not text that number. Try again in a moment.';

    signedIn(jest.fn().mockRejectedValue(new ApiError(502, refusal)));

    render(<ConfirmPhone />);

    fireEvent.press(screen.getByText('Text me a code'));

    expect(await screen.findByText(refusal)).toBeOnTheScreen();
    expect(screen.queryByPlaceholderText('123456')).toBeNull();
});

it('says how many codes an hour holds, not "Too Many Attempts."', async () => {
    signedIn(jest.fn().mockRejectedValue(new ApiError(429, 'Too Many Attempts.')));

    render(<ConfirmPhone />);

    fireEvent.press(screen.getByText('Text me a code'));

    expect(
        await screen.findByText('That is as many codes as we can text in an hour. Try again later.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Too Many Attempts.')).toBeNull();
});

it('carries a refusal about the number itself, which has no field here', async () => {
    const refusal = 'Add a contact number before asking for a code.';

    signedIn(
        jest
            .fn()
            .mockRejectedValue(
                new ApiError(422, 'The given data was invalid.', { phone: [refusal] }),
            ),
    );

    render(<ConfirmPhone />);

    fireEvent.press(screen.getByText('Text me a code'));

    expect(await screen.findByText(refusal)).toBeOnTheScreen();
});

it('offers a way to add a number when the account holds none', () => {
    const request = jest.fn();

    signedIn(request, { phone: null });

    render(<ConfirmPhone />);

    expect(screen.queryByText('Text me a code')).toBeNull();

    fireEvent.press(screen.getByText('Add a number'));

    expect(router.push).toHaveBeenCalledWith({
        pathname: '/profile/edit',
        params: { from: 'Profile' },
    });
});

it('asks for nothing on a number already confirmed', () => {
    signedIn(jest.fn(), { phone_verified: true });

    render(<ConfirmPhone />);

    expect(screen.queryByText('Text me a code')).toBeNull();
    expect(screen.queryByPlaceholderText('123456')).toBeNull();
    expect(
        screen.getByText('This number is confirmed. We can text you when a crew is at your door.'),
    ).toBeOnTheScreen();
});
