---
paths:
  - 'package.json'
  - 'app.config.ts'
  - 'scripts/with-android-env.mjs'
---

# Toolchain

## Native projects are generated
`android/` and `ios/` are produced by `expo prebuild` from `app.config.ts` and are
gitignored. Never edit them directly -- a regeneration silently discards it. Put
platform settings in `app.config.ts`, or a config plugin when that is not enough.

## Android builds run through scripts/with-android-env.mjs
`npm run android` goes through it, and it resolves the two paths Gradle needs
before handing over. Both failures without it read like code faults rather than
missing configuration.

**Never call `npx expo run:android` directly.** It skips the wrapper, and Gradle
then reports "SDK location not found" -- which reads like a broken machine and is
only a missing variable this script would have supplied. `npm run ios` has no
such wrapper and Xcode needs none.

**JDK 17 or 21, not 25.** React Native's native modules go through AGP's CMake
configure step, which still makes restricted JNI calls. JDK 25 made those fatal
(JEP 472), so a build on 25 dies with `configureCMakeDebug ... restricted
method`. This half goes away once RN supports 25.

**The SDK.** Without `ANDROID_HOME` Gradle says only "SDK location not found",
which is equally true whether the SDK is missing or merely unannounced. Android
Studio writes `android/local.properties` when it opens the project -- and
prebuild throws that away with the rest of `android/`, so it is not a fix.
The script accepts `ANDROID_HOME`/`ANDROID_SDK_ROOT` when they are already set
and otherwise looks where Studio installs. A path only counts if it holds
`platform-tools`, so a stale variable is treated as unset rather than passed on
to fail later. This half is permanent.

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

## Do not pin the iOS development team in app.config.ts
It looks like the obvious way to survive a regenerated `ios/`, and it stops
device builds working. `expo run:ios` passes `-allowProvisioningUpdates` only
when it finds no team in the project, so writing one in tells it signing is
already arranged and xcodebuild then fails on a profile nobody created. Leave
the project teamless and let Xcode mint what it needs.

The certificate is not reproducible either -- it is minted once by Xcode against
an Apple ID and lives in the login keychain. On a fresh machine, select the team
in Xcode once, then the CLI works from then on.

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

**A zoom number does not mean the same thing on both maps, and the difference is
set by the map's HEIGHT.** expo-maps hands Apple an `MKCoordinateRegion` whose
span is `360 / 2^zoom` degrees in *both* directions -- `ios/MapUtils.swift`
divides by `cos(0)`, so `latitudeDelta == longitudeDelta` -- and MapKit **fits**
that square, so on a wide short view the height is what binds. Google Maps
instead shows `360 x dp / (256 x 2^zoom)`. Matching the visible ground is
therefore `zoom_android = zoom_ios + log2(height_dp / 256)`: **negative**, about
-0.68 on the `h-40` booking card and -0.19 on the `h-56` address screen. At the
same number Android is zoomed *in* by 1.6x on the booking card.

`mercatorOffset()` computes it from the height measured by `onLayout`, and the
`MapView` is held back until that first layout arrives, because `cameraPosition`
is read once by the native view and a later correction would not apply. Do not
replace it with a constant -- the offset is a function of the height, and `PinMap`
is drawn at two of them. Do not derive it from the width either: that was the
first attempt, it has the sign the wrong way round, and it made the mismatch
worse on a real phone.

Consequence for tests: nothing renders until a layout event lands, so
`pin-map.test.tsx` renders through a `draw()` helper that fires one. iOS is the
reference and keeps the bare `STREET_ZOOM` / `AREA_ZOOM`.

`cameraPosition` is the camera the view *opens* with, not one it tracks. Both
platforms document it as the initial position, and passing a fresh object on
every render makes the map jump back over the pin at full zoom each time
someone taps -- the pin lands, and the view they were reading is gone. So
`PinMap` reads it once into state and moves the camera afterwards only through
the ref's `setCameraPosition`, driven by a separate `focus` prop. Dropping a pin
never sets `focus`; loading a saved address and reading the device's fix both
do.

**`setCameraPosition` must not be called on mount, and `focus` must be compared
by value.** The native Android view holds `cameraState` as a Kotlin `lateinit`
that is not initialised while the first effects run, so a call there is rejected
-- and since nothing awaits it, it arrives as an endless `Uncaught (in promise)
... lateinit property cameraState has not been initialized` on every screen
carrying a map. It is also unnecessary: `cameraPosition` has already placed the
camera. Worse, every caller builds `focus` inline (`focus={pin}` in
`booking-facts.tsx`, where `pin` is rebuilt each render), so keying the effect
on object identity re-aimed the camera on every single render. `PinMap` therefore
holds the last place it aimed at in a ref, depends on `focus?.latitude` /
`focus?.longitude` as primitives, and catches the rejection. Do not put the
whole object back in the dependency array.

Coordinates are placed on the map and nowhere else. There is no latitude or
longitude input -- a seven-decimal pair typed on a phone is a worse fix than a
tap, and a half-typed one is the only way to reach the server's
`required_with` refusal. The saved pair is shown back as read-only mono text.

## Associated Domains is a paid Apple capability, and it fails the whole build
A free Personal Team cannot claim a domain. Put `associatedDomains` in
`app.config.ts` under one and Xcode refuses to mint a profile at all --
"Personal development teams ... do not support the Associated Domains
capability" -- so the app stops building and installing, not just passkeys.

That is why the entitlement hangs off `EXPO_PUBLIC_APPLE_DEVELOPER_PROGRAM`
rather than off `EXPO_PUBLIC_PASSKEY_DOMAIN`. The domain is shared with Android,
which needs no entitlement and works on the debug keystore today; the membership
is the one thing that is iOS-only and costs money. Empty means iOS builds as
before with the passkey buttons hidden.

**The membership flag is deliberately not per-feature.** It is one fact about
the world -- whether this build was signed by a paid team -- and every paid Apple
capability hangs off it: Associated Domains here, `aps-environment` below. A flag
per feature invites setting one and not the other, which is a state that cannot
exist. Paying for the membership turns both on with no code change.

`passkeysAreSupported()` reads the domain and the membership, so the UI cannot
offer a sheet the build has no entitlement to open. Both are read through Expo's
env shim as the module graph is built, not per call, which is why the tests
reload the module inside `jest.isolateModules` instead of setting `process.env`
and calling again.

## expo-notifications applies its own config plugin, and its entitlement breaks the build
`expo-notifications` ships an `app.plugin.js`, and prebuild applies it **from the
dependency list alone** -- listing it in `plugins` is not what turns it on, and
removing it from `plugins` does not turn it off. It writes
`aps-environment` into the entitlements, which a free Personal Team cannot hold,
so Xcode refuses to mint a profile and the whole app stops building. Same wall as
Associated Domains above, reached by a different door: there the entitlement was
ours to withhold, here it arrives whether we ask or not. A `--clean` prebuild
does not help; it is regenerated every time.

`scripts/with-ios-push-entitlement.js` deletes the key unless
`EXPO_PUBLIC_APPLE_DEVELOPER_PROGRAM` is set, and is composed at the bottom of `app.config.ts`
with the other mods. The native module stays autolinked either way -- check
`grep -c ExpoNotifications ios/Podfile.lock` -- which is the pairing that
matters: the module must be present or the JS import throws on iOS, and the
entitlement must be absent or nothing installs. Setting the flag after enrolling
in the Apple Developer Program puts the entitlement back with no code change.

**A native module added on one platform must be prebuilt on both.** iOS was left
a day behind Android during the push work, so Metro served the new JS to an old
binary with no `ExpoNotifications` in it and every screen threw on import. The
symptom is the bare "Cannot find native module" this file warns about elsewhere,
and it looks nothing like a missing prebuild.

## Both entries in `scheme` are load bearing
`paayo` is ours; `com.paayo.ph` is where Google returns from sign in, because an
Android OAuth client's redirect *must* be the package name -- Google will not
accept another scheme for it. Remove the second and prebuild writes no intent
filter for it, so the browser has nowhere to hand the redirect back and sign in
dies at the last step. Checked by removing it and reading the generated
`AndroidManifest.xml`, not assumed.

A dev build logs `multiple possible URI schemes ... Ignoring: com.paayo.ph,
com.paayo.ph`. The duplicate is Expo's dev launcher appending the application id
at runtime for its own `expo-development-client` link -- the config holds it
once, and a release build has no launcher to add it. It is noise, not a symptom.
