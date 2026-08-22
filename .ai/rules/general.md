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

## A jest.mock factory cannot build JSX
NativeWind rewrites this repo's JSX, and every bare `createElement` call, into a
module-scoped `_ReactNativeCSSInterop` helper -- and `babel-plugin-jest-hoist`
lifts `jest.mock` above that helper, so anything the factory renders throws
"not allowed to reference any out-of-scope variables". Aliasing `createElement`
does not help; the rewrite matches the name.

Declare the stand-in as a `function` in module scope instead and let the factory
hand it back. A function declaration is hoisted, so it exists by the time the
factory runs, which no `const` does. Name it `MockThing`: jest's prefix check is
case-insensitive, and `react-hooks/rules-of-hooks` needs the capital before it
will allow a hook inside. `src/components/__tests__/pin-map.test.tsx` is the
worked example.

## Take SafeAreaView from react-native-safe-area-context
React Native's own is deprecated, and it insets on iOS only. The context
package is already a dependency, expo-router mounts its provider, and NativeWind
registers its `SafeAreaView`, so `className` keeps working across the swap.

## The LogBox notification is off, because it could not be read
`src/app/_layout.tsx` calls `LogBox.ignoreAllLogs()`. LogBox paints the bar
white and its message white, relying on a dark `Pressable` in between -- and
that background never lands: `LogBoxButton` passes `style` as a function of the
pressed state, and NativeWind registers its interop on React Native's own
`Pressable`, LogBox's included. What showed up was a blank white bar with an
amber `!` and a dismiss cross, covering the tab bar and carrying no readable
text at all.

Nothing was lost by turning it off. Warnings still reach the Metro terminal and
`adb logcat` -- `adb logcat | grep ReactNativeJS` is how the Expo `fetch`
FormData failure was found -- and React Native documents this call as disabling
notifications only, so an uncaught error still opens the full screen LogBox,
which renders correctly.

Do not reach for `ignoreLogs([...])` to silence one message instead. That leaves
every other warning as the same unreadable bar, which is the actual problem.

## There is no Prettier config, so do not run Prettier
The repo is 4-space and single-quoted; `npx prettier` defaults to 2-space and
double quotes and there is nothing here to tell it otherwise. Running it on a
file rewrites the whole thing, and `expo lint` passes either way, so the damage
shows up only as a 200-line diff on a two-line change. Match the file you are
editing by hand.

## Brand marks are copied out of Simple Icons, not imported from it
Lucide carries no brand marks, so Google's comes from Simple Icons -- but that
package is one 5MB barrel with no per-icon JS entry point, and Metro does not
shake it. Importing a single mark would carry all ~3300, which is the same trap
the lucide rule below exists for. `src/lib/brands.ts` holds the paths;
`simple-icons` stays a devDependency and `brand-icon.test.tsx` reads it for real
and fails if a copied path has drifted, so the copy cannot rot in silence.

The mark takes its `color` as a prop. There is no `currentColor` to inherit
here, and NativeWind does not reach `react-native-svg`, so it is fed from
`src/theme/palette.js` like every other icon. Passkey is a Lucide glyph
(`key-round`), not a brand mark -- the console does the same.

## Import each lucide icon by its own path
`lucide-react-native`'s barrel carries every one of its ~1500 icons, and Jest
transforms all of them: one test file that reached it took 25s, and 1s once the
import became `lucide-react-native/icons/eye`. Metro pays the same toll in the
bundle. Deep import, one line per icon.

Icons also sit outside NativeWind's reach -- they render `react-native-svg`, and
no `className` prop is registered on them. Feed the `color` prop from
`src/theme/palette.js` keyed by `useColorScheme()`, the same way
`src/app/_layout.tsx` feeds the navigation theme.

## Two icon sets, and they do different jobs
**Lucide** draws the interface -- chevrons, the tab bar, the settings rows, the
eye on a password field. **Tabler** draws service categories and nothing else.
It is here because Lucide has no aircon glyph at all, which is the first
category in the catalog; Tabler carries `IconAirConditioning`, `IconFridge`,
`IconLadder`, `IconTools` and the rest of the trades. Both are 24px 2px-stroke,
so they sit together.

`src/lib/icons.ts` is **generated** by `scripts/sync-icons.mjs` from the
console's `resources/data/service-icons.json`. Do not hand-edit it, and do not
import a Tabler glyph anywhere else -- adding one means an entry in that JSON
and rerunning the script in **both** repos. The barrel is worse here than
Lucide's: 6184 icons against 1500.

`types/tabler-icons.d.ts` exists because the package's own exports map is
wrong -- it points `./*` types at `dist/icons/*.d.ts` and the declarations sit
at `dist/icons/icons/*.d.ts`. Delete the file when upstream fixes it.

## The only name a person types is their nickname
Labels say **Nickname**, never Name. `users.nickname` is the freeform display
name; the legal-name columns are written solely by approving an identification
and no form may reach them, so a field labelled "Name" invites exactly the value
that must never land there. Match the console: label `Nickname`, placeholder
`What you go by`, and `autoComplete="nickname"` -- `autoComplete="name"` makes
iOS and Android offer the saved legal name off the device contact card.

## The two gates run in the server's order
`src/app/(app)/_layout.tsx` redirects on an unconfirmed address first, then on an
empty nickname -- matching `auth:sanctum` -> `verified` -> `EnsureHasNickname` on
the API. Reversing them strands a provider signup whose address is unconfirmed:
it would be sent to pick a name while every route it needs answers 403 about the
address instead.

`nickname === ''` is the signal, and it is already on the wire in `UserResource`.
A provider signup arrives confirmed, so in practice only the nickname gate is
ever met.

## A private image is fetched with the token, not from a URL
Avatars and identity documents are served to their owner alone, so
`components/avatar.tsx` passes `Authorization` in the image source's `headers`
rather than pointing at a public URL. The route never changes, so an upload also
bumps a `version` query the image cache can see -- without it the old picture
stays on screen.

`UserResource.avatar` is read before the request is made. The route answers 404
for an account holding no picture, so a component that asks unconditionally
404s on every account that has not set one -- which reads, in a log, exactly
like a broken upload endpoint. The boolean exists to be checked.

That is the one thing `fetch` cannot carry for us, and the only reason
`useSession()` exposes the raw `token`. Do not reach for it for anything a
request can do.

## A 422 with field errors clears the form message
`useSubmit` files a validation refusal under its fields and sets `message` to
null, because a form that renders `FieldError` under each input would otherwise
say the same thing twice. The trap is a submission whose field has no input to
sit under -- the avatar is one: a button, a picker, and a `documents[0][files]`
upload will be another.

There the screen goes completely silent. The spinner stops, nothing appears,
and the refusal -- too large, wrong dimensions -- is held in `errors` with
nothing reading it. Pass the field through to the banner:

```tsx
<FormMessage message={message ?? errorFor('avatar') ?? null} />
```

`useSubmit` also `console.warn`s anything that is neither an `ApiError` nor a
`DisplayableError` when `__DEV__`. Everything reaching that branch is a
transport failure and the person is told so in one sentence, which reads
identically whether the Wi-Fi dropped or the request was malformed. Without the
warning those two cost an afternoon to tell apart.
