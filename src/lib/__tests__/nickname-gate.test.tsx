import { render, screen } from '@testing-library/react-native';

import AppLayout from '@/app/(app)/_layout';
import { useSession } from '@/lib/session';

jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));

let mockPathname = '/';

beforeEach(() => {
    mockPathname = '/';
});

jest.mock('expo-router', () => ({
    Redirect: ({ href }: { href: string }) => {
        const { Text } = jest.requireActual('react-native');

        return <Text>{`redirect:${href}`}</Text>;
    },
    Stack: () => {
        const { Text } = jest.requireActual('react-native');

        return <Text>app</Text>;
    },
    usePathname: () => mockPathname,
}));

/**
 * @param overrides Partial user fields for the case under test.
 */
function signedInAs(overrides: Record<string, unknown>) {
    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        user: { nickname: 'Mara', email_verified: true, ...overrides },
    });
}

it('holds an unconfirmed address before anything else', () => {
    signedInAs({ email_verified: false, nickname: '' });

    render(<AppLayout />);

    expect(screen.getByText('redirect:/verify-email')).toBeOnTheScreen();
});

it('holds an empty nickname once the address is confirmed', () => {
    signedInAs({ nickname: '' });

    render(<AppLayout />);

    expect(screen.getByText('redirect:/set-nickname')).toBeOnTheScreen();
});

it('lets a complete account through', () => {
    signedInAs({});

    render(<AppLayout />);

    expect(screen.getByText('app')).toBeOnTheScreen();
});

it('lets go of the address gate once the address is confirmed', () => {
    mockPathname = '/verify-email';
    signedInAs({ email_verified: true });

    render(<AppLayout />);

    // Redirecting only one way is what left someone standing on the gate they
    // had just answered, with the button looking like it had done nothing.
    expect(screen.getByText('redirect:/')).toBeOnTheScreen();
});

it('lets go of the nickname gate once a nickname is chosen', () => {
    mockPathname = '/set-nickname';
    signedInAs({ nickname: 'Mara' });

    render(<AppLayout />);

    expect(screen.getByText('redirect:/')).toBeOnTheScreen();
});

it('renders the gate it is holding rather than redirecting to itself', () => {
    mockPathname = '/verify-email';
    signedInAs({ email_verified: false });

    render(<AppLayout />);

    expect(screen.getByText('app')).toBeOnTheScreen();
});
