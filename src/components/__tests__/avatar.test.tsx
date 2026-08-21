import { render, screen } from '@testing-library/react-native';

import { Avatar } from '@/components/avatar';

it('stands in with the initial when the account holds no picture', () => {
    render(<Avatar nickname="Mara" avatar={false} token="a-token" version={0} />);

    expect(screen.getByText('M')).toBeOnTheScreen();
    expect(screen.queryByTestId('avatar-image')).toBeNull();
});

it('stands in with the initial before a token is held', () => {
    render(<Avatar nickname="Mara" avatar token={null} version={0} />);

    expect(screen.queryByTestId('avatar-image')).toBeNull();
});

it('asks the profile route for the picture, carrying the token', () => {
    render(<Avatar nickname="Mara" avatar token="a-token" version={2} />);

    // expo-image normalises source into an array of one.
    expect(screen.getByTestId('avatar-image').props.source[0]).toMatchObject({
        uri: expect.stringContaining('/api/v1/profile/avatar?v=2'),
        headers: { Authorization: 'Bearer a-token' },
    });
});
