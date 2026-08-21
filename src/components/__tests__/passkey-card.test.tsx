import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { create, isSupported } from 'react-native-passkeys';

import { PasskeyCard } from '@/components/passkey-card';
import { useSession } from '@/lib/session';

jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));

const passkey = {
    id: 'p1',
    name: 'Pixel 8 (android)',
    last_used_at: null,
    created_at: '2026-01-01T00:00:00.000000Z',
};

/**
 * @param request What every call the card makes should answer with.
 */
function signedIn(request: jest.Mock) {
    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        authenticatedRequest: request,
    });

    return request;
}

beforeEach(() => {
    jest.mocked(isSupported).mockReturnValue(true);
    jest.mocked(create).mockReset();
});

it('says nothing on a device that cannot hold a passkey', () => {
    jest.mocked(isSupported).mockReturnValue(false);
    signedIn(jest.fn().mockResolvedValue({ data: [] }));

    render(<PasskeyCard />);

    expect(screen.queryByText('Passkeys')).toBeNull();
});

it('lists what the account holds', async () => {
    signedIn(jest.fn().mockResolvedValue({ data: [passkey] }));

    render(<PasskeyCard />);

    expect(await screen.findByText('Pixel 8 (android)')).toBeOnTheScreen();
    expect(screen.getByText('Never used')).toBeOnTheScreen();
});

it('sends the challenge back with the credential it was answered with', async () => {
    const request = signedIn(
        jest.fn(async (path: string) =>
            path === '/auth/passkeys/options'
                ? { challenge_token: 'a-challenge', options: {} }
                : { data: [] },
        ),
    );

    jest.mocked(create).mockResolvedValue({ id: 'cred' } as never);

    render(<PasskeyCard />);

    fireEvent.press(await screen.findByText('Add a passkey'));

    await waitFor(() =>
        expect(request).toHaveBeenCalledWith(
            '/auth/passkeys',
            expect.objectContaining({
                method: 'POST',
                body: expect.objectContaining({
                    challenge_token: 'a-challenge',
                    credential: { id: 'cred' },
                }),
            }),
        ),
    );
});

it('keeps quiet when the sheet is dismissed', async () => {
    const request = signedIn(
        jest.fn(async (path: string) =>
            path === '/auth/passkeys/options'
                ? { challenge_token: 'a-challenge', options: {} }
                : { data: [] },
        ),
    );

    jest.mocked(create).mockResolvedValue(null as never);

    render(<PasskeyCard />);

    fireEvent.press(await screen.findByText('Add a passkey'));

    await waitFor(() => expect(create).toHaveBeenCalled());

    expect(request).not.toHaveBeenCalledWith('/auth/passkeys', expect.anything());
});
