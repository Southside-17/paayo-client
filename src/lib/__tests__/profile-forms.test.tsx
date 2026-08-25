import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import EditProfile from '@/app/(app)/profile/edit';
import { ApiError } from '@/lib/api';
import { router } from 'expo-router';
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
    phone: null as string | null,
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

/**
 * @param authenticatedRequest What the screen's one call should do.
 * @param account Whatever the fixture should differ by.
 */
function signedIn(authenticatedRequest: jest.Mock, account: Partial<typeof user> = {}) {
    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        user: { ...user, ...account },
        token: 'a-token',
        authenticatedRequest,
        reload: jest.fn(),
    });
}

beforeEach(() => {
    jest.clearAllMocks();
});

it('opens with what the account already holds', () => {
    signedIn(jest.fn());

    render(<EditProfile />);

    expect(screen.getByDisplayValue('Mara')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('mara@example.com')).toBeOnTheScreen();
});

it('renders a refusal against the field that caused it', async () => {
    signedIn(
        jest.fn().mockRejectedValue(
            new ApiError(422, 'The given data was invalid.', {
                nickname: ['That nickname is reserved.'],
            }),
        ),
    );

    render(<EditProfile />);

    fireEvent.press(screen.getByText('Save changes'));

    await waitFor(() =>
        expect(screen.getByText('That nickname is reserved.')).toBeOnTheScreen(),
    );
});

it('sends an empty phone as nothing rather than as a blank', async () => {
    const request = jest.fn().mockResolvedValue({ message: 'Profile updated.' });

    signedIn(request);

    render(<EditProfile />);

    fireEvent.press(screen.getByText('Save changes'));

    await waitFor(() => expect(request).toHaveBeenCalled());

    expect(request.mock.calls[0][1].body).toMatchObject({ phone: null });
});

it('sends a number that changed on to the screen that confirms it', async () => {
    const request = jest.fn().mockResolvedValue({ message: 'Profile updated.' });

    signedIn(request, { phone: '+639171234567', phone_verified: true });

    render(<EditProfile />);

    fireEvent.changeText(screen.getByDisplayValue('+639171234567'), '09189999999');
    fireEvent.press(screen.getByText('Save changes'));

    // Saving cleared the confirmation server-side, so the next step is in front
    // of them rather than two screens away.
    await waitFor(() =>
        expect(router.replace).toHaveBeenCalledWith({
            pathname: '/profile/phone',
            params: { from: 'Account' },
        }),
    );

    expect(router.back).not.toHaveBeenCalled();
});

it('goes back when the number was left alone', async () => {
    const request = jest.fn().mockResolvedValue({ message: 'Profile updated.' });

    signedIn(request, { phone: '+639171234567', phone_verified: true });

    render(<EditProfile />);

    fireEvent.changeText(screen.getByDisplayValue('Mara'), 'Mars');
    fireEvent.press(screen.getByText('Save changes'));

    await waitFor(() => expect(router.back).toHaveBeenCalled());

    expect(router.replace).not.toHaveBeenCalled();
});

it('offers to confirm a number that is not confirmed', () => {
    signedIn(jest.fn(), { phone: '+639171234567', phone_verified: false });

    render(<EditProfile />);

    expect(screen.getByText('not confirmed')).toBeOnTheScreen();

    fireEvent.press(screen.getByText('Confirm this number'));

    expect(router.push).toHaveBeenCalledWith({
        pathname: '/profile/phone',
        params: { from: 'Profile' },
    });
});
