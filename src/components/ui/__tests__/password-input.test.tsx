import { fireEvent, render, screen } from '@testing-library/react-native';

import { PasswordInput } from '../password-input';

function renderField() {
    render(<PasswordInput placeholder="Password" />);

    return screen.getByPlaceholderText('Password');
}

it('masks the password until the toggle is pressed', () => {
    const field = renderField();

    expect(field).toHaveProp('secureTextEntry', true);

    fireEvent.press(screen.getByLabelText('Show password'));

    expect(field).toHaveProp('secureTextEntry', false);
    expect(screen.getByLabelText('Hide password')).toBeOnTheScreen();
});

it('re-masks the password when the toggle is pressed again', () => {
    const field = renderField();

    fireEvent.press(screen.getByLabelText('Show password'));
    fireEvent.press(screen.getByLabelText('Hide password'));

    expect(field).toHaveProp('secureTextEntry', true);
});

/**
 * Masking is what keeps iOS from autocorrecting the field, so revealing it
 * would hand the keyboard a visible password to "fix" unless both are pinned.
 */
it('never autocorrects the password, revealed or not', () => {
    const field = renderField();

    expect(field).toHaveProp('autoCorrect', false);
    expect(field).toHaveProp('spellCheck', false);

    fireEvent.press(screen.getByLabelText('Show password'));

    expect(field).toHaveProp('autoCorrect', false);
    expect(field).toHaveProp('spellCheck', false);
});
