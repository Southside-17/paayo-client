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

## Status

Scaffolding in progress. See `design/` for the UI references carried over from the
Android branch, and the server repo's `resources/css/app.css` for the design tokens
this app mirrors.
