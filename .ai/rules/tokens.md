---
paths:
  - 'src/global.css'
  - 'src/theme/**'
  - 'tailwind.config.js'
  - 'scripts/sync-tokens.mjs'
---

# Design tokens

## The palette is generated, never authored
`src/global.css` and `src/theme/colors.js` are output from `scripts/sync-tokens.mjs`,
which reads the console's `resources/css/app.css`. Do not hand-edit either file --
rerun the script:

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
