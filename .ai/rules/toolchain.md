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

## Never accept Xcode's recommended settings
Opening `ios/` in Xcode offers to "update to recommended settings". Taking it
sets `ENABLE_USER_SCRIPT_SANDBOXING = YES` on the app target, which denies React
Native's bundling phase the write of `ip.txt` into the app bundle and fails every
**device** build -- simulator builds do not need that file and keep passing, so
the breakage looks like it came from the phone. CocoaPods already opts its own
targets out. `app.config.ts` forces it back to `NO` on regeneration.

## Signing lives in the environment
A regenerated `ios/` loses the team Xcode wrote into the project, so
`APPLE_TEAM_ID` in `.env` feeds `DEVELOPMENT_TEAM` through the same config
plugin. The certificate itself is not reproducible -- it is minted once by Xcode
against an Apple ID and lives in the login keychain. On a fresh machine, select
the team in Xcode once, then the CLI works from then on.

A free Personal Team signs for **7 days**. When a build that worked yesterday
refuses to launch, re-run `npx expo run:ios --device`; nothing is wrong.

## iOS 27 devices cannot run this yet
iOS 27 makes UIKit's scene life cycle mandatory: an app linked against the
iOS 27 SDK that declares no `UIApplicationSceneManifest` is trapped inside
UIKit before any of our code runs, with `Application failed to launch: UIScene
life cycle is required for apps built with this SDK`. It dies instantly, writes
no crash log and prints nothing -- only a debugger attached in Xcode shows why.

Expo's prebuild template has not adopted scenes (expo/expo#46663, #46664) and
neither `expo@57.0.15` nor `react-native@0.86.2` ships a scene delegate. There
is no config-level fix; the generated `AppDelegate.swift` builds the window
itself, which scene adoption forbids.

Until Expo ships it: **simulators run iOS 26.4 and are unaffected**, so develop
there. Do not conclude a device failure is ours before checking the device's iOS
version -- this one cost hours behind two unrelated blockers that had to be
cleared first.
