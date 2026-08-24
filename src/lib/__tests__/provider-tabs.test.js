const { readdirSync, readFileSync, statSync } = require('fs');
const { join } = require('path');

/**
 * Every screen in the business group is either a tab or deliberately not one.
 *
 * Expo Router turns each route file under a `Tabs` layout into a tab unless the
 * layout says otherwise, so putting a detail screen in this directory put a raw
 * `listing/[id]` in the tab bar beside Jobs and Services. Nothing else caught
 * it: the screen rendered, the route resolved, and the tests driving it passed.
 *
 * Hiding it with `href: null` was not the fix. A hidden tab is still a tab, so
 * reaching it was a tab switch rather than a push, and the back button ran
 * `router.back()` against the tab history and landed on Jobs. A screen pushed
 * from a tab belongs on the app stack -- `job/[id]` is the pattern, and the
 * offer editor now sits beside it at `offer/[id]`.
 *
 * So this asks only that a route here be named in the layout, which is enough
 * to make whoever adds the next one decide whether it is a tab at all.
 *
 * Plain JS on purpose, matching `keyboard-avoidance.test.js`: it reads the
 * source tree, and `fs` has no types here without adding `@types/node`.
 */
/* global __dirname */
const GROUP = join(__dirname, '..', '..', 'app', '(app)', '(provider)');

const layout = readFileSync(join(GROUP, '_layout.tsx'), 'utf8');

/**
 * The route names this directory declares, the way Expo Router derives them:
 * the path from the group root, without its extension.
 */
function routes(dir, prefix = '') {
    return readdirSync(dir).flatMap((entry) => {
        const path = join(dir, entry);

        if (statSync(path).isDirectory()) {
            return routes(path, `${prefix}${entry}/`);
        }

        if (entry === '_layout.tsx' || !entry.endsWith('.tsx')) {
            return [];
        }

        return [`${prefix}${entry.slice(0, -'.tsx'.length)}`];
    });
}

const declared = routes(GROUP);

it('finds the screens in the business group', () => {
    // A guard that matches nothing passes for the wrong reason.
    expect(declared.length).toBeGreaterThan(3);
});

it.each(declared)('%s is named in the layout, as a tab or as hidden', (route) => {
    expect(layout).toContain(`name="${route}"`);
});
