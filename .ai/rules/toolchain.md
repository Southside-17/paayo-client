---
paths:
  - 'package.json'
  - 'app.config.ts'
  - 'scripts/with-jdk.mjs'
---

# Toolchain

## Native projects are generated
`android/` and `ios/` are produced by `expo prebuild` from `app.config.ts` and are
gitignored. Never edit them directly -- a regeneration silently discards it. Put
platform settings in `app.config.ts`, or a config plugin when that is not enough.

## Android needs JDK 17 or 21, not 25
React Native's native modules go through AGP's CMake configure step, which still
makes restricted JNI calls. JDK 25 made those fatal (JEP 472), so a build on 25
dies with `configureCMakeDebug ... restricted method` -- an error that reads like
a code fault and is not. `scripts/with-jdk.mjs` resolves a supported JDK and
fails with a plain sentence when it cannot. Delete it once RN supports 25.

Install a JDK as a **cask**, never `brew install openjdk@21`: the formula is
keg-only, so macOS never registers it and nothing finds it without env vars.

## Let Expo pin versions
Run `npx expo install --check` after touching dependencies. Hand-picked versions
drift from what the SDK expects -- `react-native-svg@15.13` imported Node's
`buffer` and broke the bundle; the SDK's own 15.15.4 does not. Use
`npx expo install --fix` rather than editing version ranges by hand.
