const { readdirSync, readFileSync, statSync } = require('fs');
const { join } = require('path');

/**
 * Every screen that can be typed into has to stay clear of the keyboard.
 *
 * This has been shipped broken four times, always the same way: a text field
 * low on a screen, typed into, and hidden behind the keyboard the moment it
 * opens. It is invisible to every other kind of test -- the component renders,
 * the value updates, the request goes out -- so it is checked structurally here
 * rather than left to whoever next reviews a screen.
 *
 * The fourth time got past this guard because the field was a bare `TextInput`
 * rather than the `Input` primitive, and the guard only looked for the import.
 * It now looks for the element too.
 *
 * `AuthScreen` and `Sheet` count because they wrap their own body in
 * `KeyboardAvoiding`. Naming a wrapper is a weaker claim than nesting inside
 * one -- a file holding both a sheet and a loose field would pass -- but this
 * is a tripwire, not a proof, and it is the shape the bug keeps arriving in.
 *
 * Plain JS on purpose: it reads the source tree, and `fs` has no types here
 * without adding `@types/node` for one file.
 */
/* global __dirname */
const ROOT = join(__dirname, '..', '..');

/** The `Input` primitive, its password twin, or a `TextInput` written by hand. */
const TYPEABLE = /from '@\/components\/ui\/(password-)?input'|<TextInput[\s/>]/;

/**
 * The primitives themselves, and the wrapper that provides the protection.
 *
 * A primitive holds a field but never decides where on a screen it sits, so it
 * cannot be the thing that keeps clear of the keyboard -- the screen using it
 * is. Only add a file here if it is a leaf that renders one field and nothing
 * that positions it.
 */
const EXEMPT = [
    join('components', 'ui', 'input.tsx'),
    join('components', 'ui', 'password-input.tsx'),
    join('components', 'peso-input.tsx'),
    join('components', 'auth-screen.tsx'),
];

function sources(dir) {
    return readdirSync(dir).flatMap((entry) => {
        const path = join(dir, entry);

        if (statSync(path).isDirectory()) {
            return entry === '__tests__' ? [] : sources(path);
        }

        return entry.endsWith('.tsx') ? [path] : [];
    });
}

const typeable = sources(ROOT)
    .filter((path) => !EXEMPT.some((exempt) => path.endsWith(exempt)))
    .map((path) => ({ path: path.slice(ROOT.length + 1), body: readFileSync(path, 'utf8') }))
    .filter(({ body }) => TYPEABLE.test(body));

it('finds the screens that can be typed into', () => {
    // A guard that matches nothing passes for the wrong reason.
    expect(typeable.length).toBeGreaterThan(5);
});

it.each(typeable.map(({ path }) => path))('%s stays clear of the keyboard', (path) => {
    const { body } = typeable.find((one) => one.path === path);

    expect(
        body.includes('KeyboardAvoiding') ||
            body.includes('AuthScreen') ||
            body.includes('<Sheet'),
    ).toBe(true);
});
