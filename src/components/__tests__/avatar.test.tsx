import { render, screen } from '@testing-library/react-native';

import { Avatar } from '@/components/avatar';

it('stands in with the initial when the account holds no picture', () => {
    render(<Avatar nickname="Mara" />);

    expect(screen.getByText('M')).toBeOnTheScreen();
    expect(screen.queryByTestId('avatar-image')).toBeNull();
});

// A signed address arrives with the account, so there is a moment before the
// first load where the flag is known and the address is not.
it('stands in with the initial before an address is held', () => {
    render(<Avatar nickname="Mara" url={null} />);

    expect(screen.queryByTestId('avatar-image')).toBeNull();
});

// No headers. The signature is in the query string, and the store reads an
// Authorization header in preference to it and then fails to verify a bearer
// token it was never issued.
it('draws the signed address on its own', () => {
    render(<Avatar nickname="Mara" url="https://store.paayo.test/avatars/one?X-Amz-Signature=abc" />);

    // expo-image normalises source into an array of one.
    const source = screen.getByTestId('avatar-image').props.source[0];

    expect(source.uri).toBe('https://store.paayo.test/avatars/one?X-Amz-Signature=abc');
    expect(source.headers).toBeUndefined();
});
