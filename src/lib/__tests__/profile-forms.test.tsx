import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import EditProfile from '@/app/(app)/profile/edit';
import { ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';

jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));

const user = {
    id: 'u1',
    nickname: 'Mara',
    fullname: null,
    phone: null,
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
 */
function signedIn(authenticatedRequest: jest.Mock) {
    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        user,
        token: 'a-token',
        authenticatedRequest,
        reload: jest.fn(),
    });
}

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
