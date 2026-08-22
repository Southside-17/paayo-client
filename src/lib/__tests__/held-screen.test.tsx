import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import Held from '@/app/(app)/held';
import { useSession } from '@/lib/session';
import type { SuspensionNotice } from '@/lib/types';

jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));

const authenticatedRequest = jest.fn();
const reload = jest.fn();

const notice: SuspensionNotice = {
    scope: 'activity',
    notice: 'You can sign in, but everything else is on hold while this is in force.',
    punitive: true,
    reason: 'Conduct',
    starts_at: '2026-08-22T14:18:08.000000Z',
    ends_at: null,
    appealed_at: null,
};

function held(overrides: Partial<SuspensionNotice> = {}) {
    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        user: { nickname: 'Mara', email_verified: true, suspension: { ...notice, ...overrides } },
        authenticatedRequest,
        reload,
        logout: jest.fn(),
    });
}

beforeEach(() => jest.clearAllMocks());

it('says what is held, why, and since when', () => {
    held();

    render(<Held />);

    expect(screen.getByText('Your account is suspended')).toBeOnTheScreen();
    expect(screen.getByText(notice.notice)).toBeOnTheScreen();
    expect(screen.getByText('Conduct')).toBeOnTheScreen();
    expect(screen.getByText('Aug 22, 2026')).toBeOnTheScreen();
    expect(screen.getByText('it is lifted')).toBeOnTheScreen();
});

// An investigation has established nothing and a compromised account belongs to
// a victim. isPunitive() is false for both, and the heading has to follow it.
it('does not call a protective hold a suspension', () => {
    held({ punitive: false, reason: 'Account compromised' });

    render(<Held />);

    expect(screen.getByText('Your account is on hold')).toBeOnTheScreen();
    expect(screen.queryByText('Your account is suspended')).not.toBeOnTheScreen();
});

it('sends the review request and re-reads the account', async () => {
    held();

    render(<Held />);

    fireEvent.changeText(screen.getByPlaceholderText('Anything we should know.'), '  Please look.  ');
    fireEvent.press(screen.getByText('Send'));

    await waitFor(() =>
        expect(authenticatedRequest).toHaveBeenCalledWith('/auth/suspension/appeal', {
            method: 'POST',
            body: { appeal_note: 'Please look.' },
        }),
    );

    // The answered state is read back off the account rather than kept here, so
    // a reopened app shows it too.
    expect(reload).toHaveBeenCalled();
});

it('does not offer the request a second time', () => {
    held({ appealed_at: '2026-08-23T01:00:00.000000Z' });

    render(<Held />);

    expect(screen.getByText(/You asked for this to be reviewed on Aug 23, 2026/)).toBeOnTheScreen();
    expect(screen.queryByText('Send')).not.toBeOnTheScreen();
});
