import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import Account from '@/app/(app)/(tabs)/account';
import { ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';

jest.mock('@/lib/session', () => ({ useSession: jest.fn() }));
// The header chip reads the workspace. An account on no staff never draws it,
// which is the state every test here is in.
jest.mock('@/lib/workspace', () => ({
    useWorkspace: () => ({ staff: null, businesses: [], enter: jest.fn(), leave: jest.fn() }),
}));
jest.mock('expo-router', () => ({ Link: MockLink }));
jest.mock('expo-image-picker', () => ({
    launchImageLibraryAsync: jest.fn(),
    launchCameraAsync: jest.fn(),
    requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
}));
jest.mock('@/lib/picture', () => ({
    AVATAR_SIZE: 512,
    preparePicture: jest.fn(async () => ({
        uri: 'file:///small.jpg',
        name: 'avatar.jpg',
        type: 'image/jpeg',
    })),
}));

function MockLink({ href, children }: { href: string; children: ReactNode }) {
    return <View accessibilityLabel={`to ${href}`}>{children}</View>;
}

const user = {
    id: 'u1',
    nickname: 'Mara',
    fullname: 'Maria Reyes',
    phone: null,
    avatar: false,
    email: 'mara@example.com',
    email_verified: true,
    identification_verified: true,
    two_factor_enabled: false,
    has_password: true,
    administrator: false,
    created_at: '2026-01-01T00:00:00.000000Z',
};

function signedIn(authenticatedRequest: jest.Mock = jest.fn()) {
    (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        user,
        token: 'a-token',
        authenticatedRequest,
        reload: jest.fn(),
        logout: jest.fn(),
    });
}

it('leads with the nickname and keeps the legal name as subtext', () => {
    signedIn();

    render(<Account />);

    expect(screen.getByText('Mara')).toBeOnTheScreen();
    expect(screen.getByText('Maria Reyes')).toBeOnTheScreen();
});

// One word each, so the list reads as a column rather than a paragraph.
it('names every section in one word', () => {
    signedIn();

    render(<Account />);

    for (const label of ['Profile', 'Address', 'Sign-in', 'Security']) {
        expect(screen.getByText(label)).toBeOnTheScreen();
    }
});

it('points each section at the screen that owns it', () => {
    signedIn();

    render(<Account />);

    expect(screen.getByLabelText('to /profile/edit')).toBeOnTheScreen();
    expect(screen.getByLabelText('to /profile/addresses')).toBeOnTheScreen();
    expect(screen.getByLabelText('to /profile/socials')).toBeOnTheScreen();
    expect(screen.getByLabelText('to /security')).toBeOnTheScreen();
});

// The picture has no input of its own, so useSubmit files a 422 under the
// field and clears the form message -- and the screen went silent. A refusal
// the person cannot see is worse than one they can.
it('shows why an upload was refused, though no input owns the field', async () => {
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///photo.jpg', width: 3024, height: 3024 }],
    } as never);

    signedIn(
        jest.fn().mockRejectedValue(
            new ApiError(422, 'The avatar field has invalid image dimensions.', {
                avatar: ['The avatar field has invalid image dimensions.'],
            }),
        ),
    );

    render(<Account />);

    // The badge on the picture opens the sheet; the sheet does the choosing.
    fireEvent.press(screen.getByLabelText('Change your picture'));
    fireEvent.press(screen.getByText('Choose from library'));

    await waitFor(() =>
        expect(
            screen.getByText('The avatar field has invalid image dimensions.'),
        ).toBeOnTheScreen(),
    );
});
