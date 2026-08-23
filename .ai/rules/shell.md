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
  - src/lib/workspace.tsx
  - src/components/business-bar.tsx
  - src/components/business-switch.tsx
  - src/components/hold-notice.tsx
  - src/lib/addresses.tsx
  - src/lib/use-selected-address.ts
  - src/lib/offers.ts
  - src/components/address-sheet.tsx
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

## A hold is the first gate, ahead of the address and the nickname
`(app)/_layout.tsx` runs three gates in the server's order: suspension,
`verified`, then `EnsureHasNickname`. The hold goes first because it outranks
both -- the API does not permit `auth.email-verification.send` to a held
account, so sending them to the address gate first strands them on a screen
whose only button answers 403 with the suspension notice.

`held.tsx` reads `user.suspension`, which `UserResource` sends on every read of
the account and which is the only reason `api.v1.auth.user` is permitted while
held. The check is truthy, not `!== null`: the app ships on its own schedule,
and a strict comparison against an older server that omits the field would gate
every account in the app.

The heading follows `punitive` -- **suspended** when the reason attributes
fault, **on hold** when it does not, matching the console word for word.
Investigation, account compromise and a legal order are the three that do not,
and calling a compromised account suspended accuses its victim.

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

## The picker's crop settles the shape, never the resolution
`allowsEditing` and `aspect` are geometry, and `quality` is JPEG compression --
`expo-image-picker` has no output-size option at all. A square crop of a
full-size camera photo comes back at the source's own pixels: measured off the
device, one crop was 340x340 at 19KB and another 3024x3024 at 741KB, from the
same settings. Both pass the server's caps, and the second is megabytes to draw
something never rendered above 72pt.

So every picked image goes through `preparePicture` in `src/lib/picture.ts`
before it is appended to a `FormData`. It resizes down only -- scaling up spends
bytes to add blur -- and re-saves as JPEG whatever arrived, so the part carries a
name and a type the server's `mimes` rule can match rather than whatever the
picker reported. The identification upload wants the same treatment when it
lands; give it its own longest-side rather than reusing `AVATAR_SIZE`.

## Every pushed screen goes back, and says where to
`src/components/back-button.tsx` sits top-left on every screen pushed over the
tabs, labelled with the screen it returns to: **Home**, the trade, the service,
**Bookings**, **Account**, **Addresses**, **Security**. Nothing carries a
top-right *Done* or *Cancel* any more -- those were copied onto browse screens
from the settings screens, and Done means finished, which browsing a category
never is.

The label is a prop and not inferred, because a screen reached from two places
returns to two places: `profile/addresses` is opened from Account and from
Home's address line, so the caller passes `from`.

## Names travel with the link, they do not settle after it
A row that is tapped already knows what it is called, so it passes the name
along and the next screen's title is right on the first frame. Home sends a
category's `name`; the category screen sends a service's `name` and its
`category`; the bookings list sends the service and provider names.

Without this a screen opens on a placeholder -- "Services", "Service",
"Booking" -- and renames itself when the fetch lands, which reads as a glitch.
The fetched value stays as the fallback for a screen reached by deep link.

Where the back label already carries a name, do not repeat it in the eyebrow.
The provider list is titled with the service and goes back to the trade; showing
the trade in both places is the same word twice, stacked.

## A list that is loading holds its own shape
`src/components/ui/skeleton.tsx`, sized at the call site so content lands into
space already held for it. Never a blank, never a line of text that is then
replaced -- both resize the page under the reader. It stops pulsing when the
system asks for reduced motion, and holds its animated value in lazy state
rather than a ref, which the React Compiler refuses to read during render.

## Confirmations are ours, not the platform's
`src/components/ui/confirm-dialog.tsx`. Do not reach for React Native's
`Alert`: it draws in the operating system's own colours and typeface -- a grey
sheet with teal system buttons and Roboto -- which against this app's amber,
Urbanist and dark card reads as a dialog from a different application. It was
tried and rejected on exactly that ground.

Two actions ask before they happen, and both are the kind that should: placing
a booking commits someone to a visit, and cancelling one cannot be undone.

The confirming button says what happens -- **Place booking**, **Cancel
booking** -- never OK. The way out is never the word the confirming button
uses: a dialog headed "Cancel this booking?" offers **Keep it**, because a
button reading Cancel there means both things at once. Destructive actions take
`destructive`, which is the one place `Button`'s destructive variant is used.

The backdrop dismisses, matching every other dialog on the platform.

## The provider list is a fallback, never a step
Where a provider covers the address, `service/[id].tsx` resolves and `router.replace`s straight to Book — the client never sees a list, and Book shows who is coming as a card with no picker, no "choose another", no override. The list is only drawn when nobody covers that zone, and it opens with a banner naming the service and the market, because a list appearing where an answer was expected reads as a downgrade unless it explains itself.

`replace` rather than `push`, so back from Book returns to the category rather than to a screen the client was never meant to stop on.

## Where work goes is a selection, and the default is only its seed
`src/lib/addresses.tsx` holds the **address id**, never the record, and reads it
back out of the fetched list every render -- the same shape as
`src/lib/workspace.tsx`, and for the same reasons: an address that is edited,
unpinned or removed falls back to the seed on its own rather than being read off
a stale copy.

`addresses.is_default` is a persisted account flag and is **not** the selection.
It seeds it, and nothing more. Before this the whole booking flow ran off
`is_default`, so moving work to another address meant Home -> Change -> Edit ->
toggle default -> Save: four taps through a management form, mutating account
state to answer "which address am I booking for right now". Do not reintroduce
that, and do not offer a way to change the default from the app -- selection
supersedes it here.

The selection is **not persisted**, so a cold start returns to the pinned
default, exactly as the workspace does and for the same reason: the token lives
in `expo-secure-store`, which is for secrets, and there is no other storage here
without adding a dependency.

An address with **no pin is never selectable, and never seeded** -- not even when
it is the default. Coverage is decided by the pin, so selecting one would answer
the catalog unfiltered: every row would arrive with no `covering`, every tap
would land on the picker, and the picker would report that nobody serves the
area. It is shown dimmed and explained rather than hidden, because an address
that vanished from the list would read as lost.

The list is asked for **once for the whole visit**, from `AddressesProvider`
mounted around the last `<Stack>` in `(app)/_layout.tsx` -- past every gate, so a
held or unverified account never asks. It was four requests for one booking:
Home, the category screen, the picker and Book each read it on every focus, and
every `router.back()` re-fired the lot. Screens that change an address call
`reload()`; nothing else re-asks.

## The address sheet selects, and the addresses screen manages
`src/components/address-sheet.tsx` opens from Home's address line and does one
thing: it answers which address work goes to. No add, no edit, no remove -- those
live on `profile/addresses`, reached from Account or from the sheet's closing
**Manage addresses** row. That row is navigation, not an action, and it is the
only way forward for someone whose only address has no pin.

## The list carries what the picker needs, so the picker asks nothing
`src/lib/offers.ts` is a module-scope cache, like the one in
`src/components/media-thumb.tsx`. The category list is answered `covering` *and*
`alternatives` *and* the market, so it remembers one `ServiceOffer` per row and
`service/[id].tsx` seeds its state from that in a **lazy `useState`
initialiser** -- read during render, so a preloaded picker paints providers on
its first frame instead of holding skeletons over an answer it was handed.

Keyed on the address, and the map is dropped **whole** when the selection
changes: coverage is decided by the pin, so one change makes every remembered
answer wrong at once. A covered row is deliberately not seeded -- that screen is
about to `replace` into Book, and drawing the empty case first would flash
"nobody offers this" on its way out. The fetch stays for a miss: a deep link, a
search, or a pin changed since.

## A screen that uploads reports it, and uploads as it goes
Media is sent when it is picked, not when the form is submitted: Book stays instant, and a failure appears next to the thumbnail that caused it instead of after the person thought they were finished. Each item carries its own progress bar and its own retry.

`MediaPicker`'s `onChange` takes an **updater**, not a list. Uploads run concurrently and report progress as they go, so a callback that closed over the list it was handed wipes whatever landed while it was in flight — this was a real bug, caught by a test, not a hypothetical.

## expo-maps needs a mock with an imperative handle
`pin-map.tsx` aims the camera through a ref, so a bare `View` stand-in throws on a method it does not have. The mock in `jest.setup.js` renders `null` and imports nothing from `react-native`: NativeWind's babel plugin rewrites any `View` in a `jest.mock` factory into an interop call, and a mock factory may not reference an out-of-scope variable.

A read-only map is `pointerEvents="none"`, not `uiSettings`. `AppleMapsUISettings` has no gesture toggles at all, so the Google-shaped object that locks the map on Android does nothing on iOS.

## Which side you are on is an id, held in memory, looked up every render
`src/lib/workspace.tsx` holds the **staff id**, never the staff record, and
reads the record back out of `session.user.staffs` on every render. Two things
fall out of that and both are wanted: a suspension lifted mid-session is read
fresh rather than off a stale copy, and being taken off a staff empties the
workspace on its own, which `(provider)/_layout.tsx` turns into a redirect home
without anything having to notice.

It is **not persisted**, so the app opens on the personal side every time. That
is a consequence, not a preference: the token lives in `expo-secure-store`,
which is for secrets, and there is no other storage here without adding a
dependency. Persisting it would also mean validating the stored id against the
account on boot. Revisit when a provider is a daily driver.

`session.user.staffs` is read as possibly absent, the same way `user.suspension`
is read truthily: the app ships on its own schedule, and an older server that
omits the field must leave someone on the personal side rather than take the
account screen down.

## Switching is dismissAll then replace, and the stack is anchored to `(tabs)`
`enter()` and `leave()` own the navigation, so no caller can half-switch.
`router.dismissAll()` drops whatever was pushed and `router.replace()` swaps the
root, which leaves exactly the mode that was chosen and nothing underneath it --
without it, switching from a pushed screen leaves the other mode sitting under
back. `(app)/_layout.tsx` carries `unstable_settings = { initialRouteName:
'(tabs)' }` for the same reason the auth stack does.

## A held business stays on the list, and stays tappable
The switcher draws every business whatever its standing, with a `suspended`
pill, and switching into one works. Hiding it is the one way of never being told
about it; the notice is on the other side of the tap, at the top of Jobs and of
Business, drawn by `hold-notice.tsx`. The heading follows `punitive` -- the same
split `held.tsx` makes for a person, for the same reason.

## The business side is two tabs and a bar, not a third gate
`(provider)/` is a sibling group to `(tabs)` inside the same Stack, so it sits
under the three gates in `(app)/_layout.tsx` rather than adding a fourth.
`BusinessBar` opens every provider screen -- which side of the app you are on is
never something to remember -- and is the way back to the switcher. Job detail
lives at `(app)/job/[id].tsx`, a sibling of both groups, the same shape
`profile/*` and `booking/*` already take.

Accepting and declining is not built. Job detail says so in a sentence rather
than drawing a disabled button, because a greyed-out control reads as something
that is temporarily unavailable rather than as something that does not exist.
