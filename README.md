# Paayo Mobile

Cross-platform client for the Paayo field-service platform — **React Native +
Expo**, one TypeScript codebase for Android and iOS.

It consumes the Paayo server's token API at `/api/v1/auth/*`. The server's console
is administrators-only, so this app is how ordinary users reach the platform.

## Branches

| Branch | What it is |
| --- | --- |
| `master` | this app — React Native + Expo, both platforms |
| `android` | the retired native Android foundation (Kotlin + Compose), kept for reference |

`master` shares no history with `android`. The Kotlin foundation targeted a
different backend and its networking layer (Retrofit) is JVM-only, so it could
never have reached iOS.

## Requirements

- **Node** 20+ and npm.
- **Android:** Android Studio (SDK 36) and a **JDK 17 or 21 — not 25.**
  React Native cannot build on 25: [JEP 472](https://openjdk.org/jeps/472) made
  restricted JNI access fatal, which kills the CMake step its native modules go
  through. `npm run android` resolves a supported JDK and fails with a plain
  message when it cannot find one.

  Install it as a **cask** so macOS registers it and nothing needs `JAVA_HOME`:

  ```sh
  brew install --cask temurin@21     # or microsoft-openjdk@21
  ```

- **iOS:** Xcode, plus CocoaPods (`brew install cocoapods`). **No JDK**, and no
  Apple Developer account for simulator builds.

## Run

```sh
npm install
npm run android      # emulator or attached device
npm run ios          # simulator
npm test
npm run types:check
```

Point the app at a server with `EXPO_PUBLIC_API_URL`. Without it, an Android
emulator uses `http://10.0.2.2:8000` and an iOS simulator `http://localhost:8000`
— both reach `php artisan serve` on the host. A physical device needs a LAN
address and the server started with `--host=0.0.0.0`.

## Layout

```
src/app/          expo-router; (auth) signed out, (app) signed in
src/components/   ui/ primitives, hand-written
src/lib/          api client, session, secure token store, types
src/theme/        generated colour map — do not edit
scripts/          token sync, JDK preflight
design/           UI references carried over from the android branch
.ai/rules/        conventions; read before editing
```

Native `android/` and `ios/` directories are generated from `app.config.ts` by
`expo prebuild` and are not committed. Regenerate with `npm run prebuild`.

## Design tokens

The palette is **generated** from the console's `resources/css/app.css`, which
states its colours in oklch — a format React Native cannot parse. Never edit
`src/global.css` or `src/theme/colors.js` by hand:

```sh
node scripts/sync-tokens.mjs
```

## Status

The authentication slice: sign in, two-factor challenge, registration, forgotten
password, the unconfirmed-address gate, 2FA enrolment, and changing a password.
Verified end to end on Android.
