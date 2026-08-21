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

## iOS 27 needs a scene life cycle we patch in ourselves
iOS 27 makes UIKit's scene life cycle mandatory: an app linked against the
iOS 27 SDK that builds its own `UIWindow` in `didFinishLaunchingWithOptions`
is trapped inside UIKit before any of our code runs, with `Application failed
to launch: UIScene life cycle is required for apps built with this SDK`. It
dies instantly, writes no crash log and prints nothing -- only a debugger
attached in Xcode shows why. Simulators on iOS 26 only warn, so the same binary
runs there; check the device's iOS version before assuming a fault is ours.

Expo has not adopted scenes (expo/expo#46663, #46664), so
`scripts/with-ios-scene-lifecycle.js` does it: it declares the manifest and
rewrites the generated `AppDelegate.swift` to boot React Native from
`scene(_:willConnectTo:options:)`.

**It is temporary.** Delete the file and the two lines in `app.config.ts` that
use it once Expo ships the real thing. It throws during prebuild if the
template stops matching, so it fails loudly rather than silently patching the
wrong thing.

## A physical device needs the LAN address
`EXPO_PUBLIC_API_URL` in `.env` points the app at the host's LAN address,
because `localhost` on a phone is the phone. Laravel must answer there too
(`--host=0.0.0.0`), and macOS must not be set to block all incoming
connections -- that setting overrides per-app firewall rules, so allowing
`node` alone does nothing while it is on.

## Jest needs its own transformer for `.mjs`
jest-expo resolves the `react-native` export condition, which for packages like
`lucide-react-native` is an ESM `.mjs` build -- but its preset registers
babel-jest only for `.[jt]sx?`, so the file arrives untransformed and throws
`SyntaxError: Unexpected token 'export'`. Two things are needed and neither
works alone: the package added to `transformIgnorePatterns`, and
`"transform": {"\\.mjs$": "babel-jest"}` in `package.json`, which Jest merges
into the preset's transforms rather than replacing them.

## Fonts are embedded by the config plugin, never loaded at runtime
`assets/fonts/` holds five `.ttf` files -- Urbanist 400/500/600/700 and JetBrains
Mono 400 -- matching the console's `vite.config.ts`. They are declared to the
`expo-font` config plugin in `app.config.ts`, so they exist at first paint with no
`useFonts` gate and no flash of a fallback face. `expo-font` was already a
dependency; no package was added to get them.

The plugin's two halves are not symmetric and both are needed. `android.fonts`
takes `fontDefinitions` mapping each file to a `weight` under one `fontFamily`;
`ios.fonts` takes bare paths and leans on each file's CoreText metadata.

A space in a family name is fine. Prebuild writes
`ReactFontManager.getInstance().addCustomFont(this, "JetBrains Mono", R.font.xml_jet_brains_mono)`
into `MainApplication.kt`, so Android registers the human name and the `xml_`
prefix is only a resource-name collision guard. Adding or removing a face means
`expo prebuild --clean` and a rebuild -- it is native configuration, not JS.

## expo-maps is two components, and only Android needs a key
`AppleMaps.View` on iOS, `GoogleMaps.View` on Android. Neither renders on the
other platform, so `src/components/pin-map.tsx` chooses by `Platform.OS` and
every screen above it stays platform blind. Expo's own docs are explicit that
Google Maps is supported "exclusively on Android" here -- do not enable Maps SDK
for iOS, it is unreachable from this library.

The key is read from `GOOGLE_MAPS_API_KEY` into `android.config.googleMaps.apiKey`
in `app.config.ts` -- that exact path, not a plugin option. Prebuild writes it
into `AndroidManifest.xml` as `com.google.android.geo.API_KEY`, which is the
thing to check when the map draws grey: a mismatch between the restriction and
the package shows up only in `adb logcat`, never in the UI.

Cost is nothing. The Android map draws the Mobile Native Dynamic Maps SKU, which
Google lists as unlimited -- not the 10,000/month tier the billed services use.
Places, Geocoding and Directions are the billed ones; none are used, and address
autocomplete would be Places.

`cameraPosition` is the camera the view *opens* with, not one it tracks. Both
platforms document it as the initial position, and passing a fresh object on
every render makes the map jump back over the pin at full zoom each time
someone taps -- the pin lands, and the view they were reading is gone. So
`PinMap` reads it once into state and moves the camera afterwards only through
the ref's `setCameraPosition`, driven by a separate `focus` prop. Dropping a pin
never sets `focus`; loading a saved address and reading the device's fix both
do.

Coordinates are placed on the map and nowhere else. There is no latitude or
longitude input -- a seven-decimal pair typed on a phone is a worse fix than a
tap, and a half-typed one is the only way to reach the server's
`required_with` refusal. The saved pair is shown back as read-only mono text.

## Associated Domains is a paid Apple capability, and it fails the whole build
A free Personal Team cannot claim a domain. Put `associatedDomains` in
`app.config.ts` under one and Xcode refuses to mint a profile at all --
"Personal development teams ... do not support the Associated Domains
capability" -- so the app stops building and installing, not just passkeys.

That is why the entitlement hangs off `EXPO_PUBLIC_PASSKEY_IOS` rather than off
`EXPO_PUBLIC_PASSKEY_RP_ID`. The domain is shared with Android, which needs no
entitlement and works on the debug keystore today; the flag is the one thing
that is iOS-only and costs a Developer Program membership. Empty means iOS
builds as before with the passkey buttons hidden.

`passkeysAreSupported()` reads the same pair, so the UI cannot offer a sheet the
build has no entitlement to open. Both are read through Expo's env shim as the
module graph is built, not per call, which is why the tests reload the module
inside `jest.isolateModules` instead of setting `process.env` and calling again.
