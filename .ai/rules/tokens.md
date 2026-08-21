---
paths:
  - 'src/global.css'
  - 'src/theme/**'
  - 'tailwind.config.js'
  - 'scripts/sync-tokens.mjs'
---

# Design tokens

## The palette is generated, never authored
`src/global.css`, `src/theme/colors.js` and `src/theme/palette.js` are output
from `scripts/sync-tokens.mjs`, which reads the console's
`resources/css/app.css`. Do not hand-edit any of the three -- rerun the script:

```sh
node scripts/sync-tokens.mjs [path-to-app.css]   # defaults to ../server/resources/css/app.css
```

## Why it has to be generated
The console states colours in **oklch**. React Native cannot parse that, and
NativeWind only understands it from v5 (still a preview; we are on 4.2.6 with
Tailwind 3.4, because NativeWind 4 does not support Tailwind 4). So the mobile
palette is a conversion to sRGB, and conversions drift unless they are mechanical.

Opaque tokens are emitted as space-separated channels so Tailwind's opacity
modifiers still resolve; tokens that already carry alpha are emitted as complete
`rgba()` and used as-is.

## The brand is amber, not green
`design/README.md` proposes a green `#00b14f`. That was never adopted. The live
brand is signal amber -- `--brand: oklch(0.672 0.146 62)` in the console, which
converts to `212 126 29`. Take colours from the console, not from the handoff.

## Three outputs, because not everything can read a variable
`global.css` holds the variables, `colors.js` points Tailwind at them, and
`palette.js` spells the same colours out as literals. NativeWind resolves the
variables for anything carrying a `className`; the navigation theme in
`src/app/_layout.tsx` and the splash screen in `app.config.ts` are declared
outside of that and need the values themselves. Opaque tokens are hex there
because expo-splash-screen parses nothing else -- it kills the build on an
`rgb()`.

## Dark mode hangs on `darkMode: 'class'`
The dark tokens sit under `.dark:root`, and NativeWind only reads that selector
as a dark variable set when `tailwind.config.js` says `darkMode: 'class'`.
Without it the whole block compiles to a class that never matches and the app
stays light for ever, with nothing to say why. The setting does not make the
scheme manual: NativeWind still follows the device, it only also permits
`colorScheme.set()` to override it, which `darkMode: 'media'` refuses outright.
