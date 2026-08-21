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
- **Android:** Android Studio (SDK 36) and a JDK -- 17 or 21, *not* 25.
  React Native builds fail on 25: [JEP 472](https://openjdk.org/jeps/472) made
  restricted JNI access fatal, which kills the CMake step its native modules go
  through. `npm run android` resolves a supported JDK for you and fails with a
  plain message when it cannot find one.

  ```sh
  brew install openjdk@21
  export JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
  ```

- **iOS:** Xcode. No JDK, and no Apple Developer account for simulator builds.

## Run

```sh
npm install
npm run android   # emulator or attached device
npm run ios       # simulator
```

## Status

Scaffolding in progress. See `design/` for the UI references carried over from the
Android branch, and the server repo's `resources/css/app.css` for the design tokens
this app mirrors.
