import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import VerifyEmail from '@/app/(app)/verify-email';
import { useSession } from '@/lib/session';

jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));

const user = {
    id: 'u1',
    nickname: 'Mara',
    email: 'mara@example.com',
    email_verified: false,
};

/**
 * @param reload What re-reading the account should answer with.
 */
function waitingOn(reload: jest.Mock) {
    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        user,
        reload,
        authenticatedRequest: jest.fn().mockResolvedValue({ message: 'Confirmation email sent.' }),
        logout: jest.fn(),
    });

    return reload;
}

const stillWaiting = 'This address is still unconfirmed. Open the link in the email, then try again.';

it('says so when the address is still unconfirmed', async () => {
    waitingOn(jest.fn().mockResolvedValue({ ...user, email_verified: false }));

    render(<VerifyEmail />);

    fireEvent.press(screen.getByText('I have confirmed it'));

    expect(await screen.findByText(stillWaiting)).toBeOnTheScreen();
});

it('says nothing once the address is confirmed', async () => {
    const reload = waitingOn(jest.fn().mockResolvedValue({ ...user, email_verified: true }));

    render(<VerifyEmail />);

    fireEvent.press(screen.getByText('I have confirmed it'));

    // The layout gate moves them on from here; this screen only has to not
    // accuse a confirmed address of being unconfirmed.
    await waitFor(() => expect(reload).toHaveBeenCalled());

    expect(screen.queryByText(stillWaiting)).toBeNull();
});

it('clears the warning when another email is sent', async () => {
    waitingOn(jest.fn().mockResolvedValue({ ...user, email_verified: false }));

    render(<VerifyEmail />);

    fireEvent.press(screen.getByText('I have confirmed it'));
    expect(await screen.findByText(stillWaiting)).toBeOnTheScreen();

    // The warning arrives while the check is still in flight, and both buttons
    // are disabled for as long as it is. Pressing on that render is swallowed
    // by the Pressable and nothing resends -- so wait for the button to come
    // back rather than for the machine to be quick.
    await waitFor(() => expect(screen.getByText('Send another email')).toBeEnabled());
    fireEvent.press(screen.getByText('Send another email'));

    await waitFor(() => expect(screen.queryByText(stillWaiting)).toBeNull());
    expect(screen.getByText('Confirmation email sent.')).toBeOnTheScreen();
});
