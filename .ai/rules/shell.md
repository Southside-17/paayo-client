---
paths:
  - 'src/app/(app)/**'
  - 'src/components/ui/tone.ts'
  - 'src/components/ui/status-pill.tsx'
  - 'src/components/ui/badge.tsx'
  - 'src/components/ui/screen-header.tsx'
  - 'src/components/settings-list.tsx'
  - 'src/components/social-card.tsx'
  - 'src/lib/providers.ts'
---

# The signed-in shell

## The Compose export is a reference for structure, never for style
`~/Downloads/kotlin-export` is a Jetpack Compose prototype of this app. Its
information architecture is what was adopted -- tab shell, `ScreenHeader`,
`StatusPill`, `PaayoBadge`, `SettingsList`, card-per-row -- and nothing else.

Two things in it are already-settled decisions going the other way, and both
will look like oversights if you read the export cold:

- `theme/Color.kt` opens `val Brand = Color(0xFF00B14F)`. That is the third
  appearance of a green that has never been adopted. The brand is amber. See
  `.ai/rules/tokens.md`.
- `theme/Type.kt` targets Instrument Sans. This app ships Urbanist, from the
  console, embedded through the `expo-font` config plugin.

Its screens are also mostly unbuildable: `ClientExperience.kt` and
`TeamExperience.kt` draw service requests, work orders, an inbox and earnings,
and the server has a table for none of them. Only the account side was ported,
because only the account side can be fed. Do not port a screen from that export
without first checking `routes/api/v1/` for something to put in it.

## `(tabs)` sits inside `(app)`, under the gates
`src/app/(app)/_layout.tsx` is a Stack and holds the two redirects. The tab bar
is a group below it, so `verify-email` and `set-nickname` render without one --
a gate screen with a tab bar offers three ways to leave a room the person is
being held in.

Detail screens (`profile/*`, `security/*`) stay siblings of `(tabs)` in that
Stack, so they push over the bar and `router.back()` lands on the tab that
opened them.

## The tab bar is React Navigation, so it takes literals
`Tabs` cannot read a `className`, exactly like the navigation theme in
`src/app/_layout.tsx`. Colours come from `src/theme/palette.js` keyed by
`useColorScheme()`, and `tabBarLabelStyle` has to name `Urbanist` outright --
labels never pass through `ui/text.tsx`, which is the only place the family
otherwise reaches text.

## A tone's dot is load-bearing
`StatusPill` and `Badge` both draw a dot from `TONES` in
`src/components/ui/tone.ts`. It is not decoration: colour alone fails WCAG-AA,
so the shape has to carry the status too. Removing it looks like a tidier pill
and is a regression; `status-pill.test.tsx` fails if it goes.

`TONES` spells every class out in full rather than building `bg-${tone}-subtle`.
NativeWind reads class names statically, so a constructed one leaves nothing for
the compiler to find and the pill renders unstyled with no warning.

## Account rows are one word each
**Profile**, **Address**, **Sign-in**, **Security**. The list reads as a column,
not a paragraph, and the note under each label carries the detail.

**Never "Provider" for a way of signing in.** In this codebase `Provider` is a
service company -- `app/Models/Provider.php` on the server, with staff, listings
and coverage. Google is a *social provider*, and in UI copy it is a way in.

## Adding Apple or Microsoft is one row in `src/lib/providers.ts`
`SOCIAL_PROVIDERS` is the single list every screen reads: the key matches the
server's `SocialProvider` enum and the route segment, and `isConfigured()` keeps
a provider off the screen in a build with no credentials for it. Home renders a
`SocialCard` per enabled provider and stays read-only -- linking and unlinking
carry the last-way-in rule, so they live only on `profile/socials.tsx`.

## An empty tab says so
`(tabs)/requests.tsx` has no server behind it and shows a written explanation
rather than a spinner, a placeholder list, or demo data. When booking lands,
that copy is what it replaces.
