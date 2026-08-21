---
paths:
  - '**/*.ts'
  - '**/*.tsx'
---

# General

## Carried from the console
These hold here exactly as they do in the server repo. See its `.ai/rules/general.md`.

- **One-line docblocks.** State what the thing is. Rationale belongs in `.ai/rules`, not above the declaration.
- **Never write "verified" unqualified.** Two planes exist and they mean different things: `email_verified` and `identification_verified`. A bare `verified` does not say which.
- **Staff, never member.** No singular form; use the person's name in row actions.
- **Nickname is the primary line.** `fullname` is subtext and is nullable -- it is deliberately not a fallback for a nickname, because a self-chosen name must never appear where a legal one is expected.
- **npm only.** `packageManager` is pinned.

## UI primitives are hand-written
Do not add a component generator. `src/components/ui/*` is written by hand, matching the console's rule about shadcn. Keep them small, take `className`, and merge with `cn()`.

## NativeWind maps `className`, and nothing beside it
`react-native-css-interop` registers one prop per component, and on `TextInput`
that prop is `className`. There is no `placeholderClassName` -- passing one is
dropped in silence, so the placeholder quietly keeps iOS's near-invisible
default grey and nothing warns. Style it through the variant the console
already uses: `placeholder:text-muted-foreground`, which compiles to
`@rn-move color placeholderTextColor`.

## Take SafeAreaView from react-native-safe-area-context
React Native's own is deprecated, and it insets on iOS only. The context
package is already a dependency, expo-router mounts its provider, and NativeWind
registers its `SafeAreaView`, so `className` keeps working across the swap.

## A blank white bar at the foot of the screen is a warning
It is React Native's LogBox notification, not our UI. LogBox paints the bar
white and its message white, relying on a dark `Pressable` in between -- and
that background never lands, because NativeWind replaces every `Pressable`,
React Native's own included. So a warning shows up as an empty white bar with
an amber `!` and a dismiss cross, and looks like a rendering fault. The text is
there; read it in the Metro terminal instead.

## Import each lucide icon by its own path
`lucide-react-native`'s barrel carries every one of its ~1500 icons, and Jest
transforms all of them: one test file that reached it took 25s, and 1s once the
import became `lucide-react-native/icons/eye`. Metro pays the same toll in the
bundle. Deep import, one line per icon.

Icons also sit outside NativeWind's reach -- they render `react-native-svg`, and
no `className` prop is registered on them. Feed the `color` prop from
`src/theme/palette.js` keyed by `useColorScheme()`, the same way
`src/app/_layout.tsx` feeds the navigation theme.

## The only name a person types is their nickname
Labels say **Nickname**, never Name. `users.nickname` is the freeform display
name; the legal-name columns are written solely by approving an identification
and no form may reach them, so a field labelled "Name" invites exactly the value
that must never land there. Match the console: label `Nickname`, placeholder
`What you go by`, and `autoComplete="nickname"` -- `autoComplete="name"` makes
iOS and Android offer the saved legal name off the device contact card.
