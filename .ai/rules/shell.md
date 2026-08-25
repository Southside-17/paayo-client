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
  - src/components/phone-notice.tsx
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

## Confirming a number is asked for, never sent on its own
`profile/phone.tsx` opens on a button. `security/two-factor.tsx` auto-begins in
a `useEffect` and this deliberately does not: every send spends one of six an
hour and costs real centavos, and a screen that re-mounts on focus would spend
another without anybody pressing anything.

Four states, and only one of them has a field: no number on the account, a
number with nothing asked for yet, a code asked for, and a number already
confirmed. The confirmed state has no button at all -- the server answers 200
rather than refusing, so a **Text me a code** there would spend nothing and
change nothing, which is worse than not offering it.

**There is no fourth gate.** The API requires a confirmed number nowhere, so
`(app)/_layout.tsx` keeps its three redirects; adding one would strand every
existing account behind a screen the server never asked for. What a person
misses is the arrival SMS, and that is said where it matters rather than
enforced.

The word is **confirm**, never verify. `.ai/rules/general.md` forbids an
unqualified "verified" and the email flow already says *Confirm your email*.

`BackButton`'s label is a route param here (`from`), because three routes reach
this screen -- the phone field on `profile/edit`, the notice on a booking, and
`profile/edit`'s own save. That is the case the prop exists for; see *Every
pushed screen goes back, and says where to*. `profile/edit` takes the same param
for the same reason, defaulting to `Account`.

Saving a **changed** number `router.replace`s into this screen rather than going
back, because the server has just cleared the confirmation and the next step is
one the person is already in the middle of. `replace`, so back reaches wherever
the form was opened from instead of a form that is finished with. Clearing the
number to nothing still goes `back()`.

## The unconfirmed-number notice is on the booking, not in settings
`phone-notice.tsx` is `NotifyNotice`'s twin and sits on `booking/[id].tsx`,
drawn on `booking.status.is_open && !user.phone_verified`. Same reasoning that
keeps `NotifyNotice` on the Jobs tab: a client reading a live booking is looking
at the thing the text is about. A closed booking gets nothing, because nobody is
coming.

Held behind `is_open` and nothing finer. Conditioning it on there being a job,
or on the job reading `enroute`, would put it on screen at the moment it is
already too late to act on.

It says **the app will still show it**, out loud. The push still lands, so an
unconfirmed number is a diminished thing rather than a broken one, and claiming
otherwise is a lie the reader can check. The tap routes to `/profile/edit` when
there is no number at all and to `/profile/phone` when there is -- the branch
lives here because this is where the number is known.

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
from the settings screens, and Done means finished, which browsing a trade
never is.

The label is a prop and not inferred, because a screen reached from two places
returns to two places: `profile/addresses` is opened from Account and from
Home's address line, so the caller passes `from`.

## Names travel with the link, they do not settle after it
A row that is tapped already knows what it is called, so it passes the name
along and the next screen's title is right on the first frame. Home sends a
trade's `name`; the trade screen sends a service's `name` and its
`trade`; the bookings list sends the service and provider names.

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

Every answer that commits a person or a business asks first: placing a booking,
cancelling one, taking a job, and turning one down. There is no one-tap path
through any of them.

The confirming button says what happens -- **Place booking**, **Cancel
booking**, **Take the job**, **Turn it down** -- never OK, and it keeps the
same wording as the button that opened it. The way out is never the word the
confirming button uses: a dialog headed "Cancel this booking?" offers **Keep
it**, because a button reading Cancel there means both things at once.
`destructive` is reserved for what cannot be taken back -- cancelling a booking
and turning down a job -- and is the only use of `Button`'s destructive
variant.

The card carries `testID="confirm-dialog"`, so a test presses the dialog's
button rather than the one behind it when both read the same.

The backdrop dismisses, matching every other dialog on the platform.

## The provider list is a fallback, never a step
Where a provider covers the address, `service/[id].tsx` resolves and `router.replace`s straight to Book — the client never sees a list, and Book shows who is coming as a card with no picker, no "choose another", no override. The list is only drawn when nobody covers that zone, and it opens with a banner naming the service and the market, because a list appearing where an answer was expected reads as a downgrade unless it explains itself.

`replace` rather than `push`, so back from Book returns to the trade rather than to a screen the client was never meant to stop on.

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
Home, the trade screen, the picker and Book each read it on every focus, and
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
`src/components/media-thumb.tsx`. The trade list is answered `covering` *and*
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

## A screen with a text field wraps in KeyboardAvoiding
See `.ai/rules/general.md`, first section. `job/[id].tsx` shipped without it and
its decline note typed underneath the keyboard -- the third time that exact bug
has gone out. `src/lib/__tests__/keyboard-avoidance.test.js` now fails any
screen importing `Input` that references neither `KeyboardAvoiding` nor
`AuthScreen`.

## Answering a job is not a symmetric choice, so the buttons are not either
Two equal side-by-side buttons is the obvious shape and the wrong one. Taking
work is the ordinary answer and commits the business to showing up; turning it
down is the exception and carries a note. Equal weight makes the expensive
mistake exactly as cheap as the common action.

`job/[id].tsx` gives **Take this job** the primary full-width button and
**Can't take it** a ghost beneath it. Declining swaps the pair for a note field
— `ConfirmDialog` holds no input, so the reason is typed on the screen — and
both answers then confirm.

Each dialog names what it does instead of asking whether you are sure.
Accepting: *"You are saying you will be at 12 Mabini Street on Tue 1 Sep at
9AM. Mara will see that you accepted."* Turning down: *"Mara will be asked to
choose another business. You cannot take this job back afterwards."* — the
client's position and the irreversibility, which are the two things a business
would want to have been told.

The header carries the visit time beside the price. A provider deciding is
answering *is this worth my Tuesday morning*, and those two facts are the
decision; the service name is context and `WhenCard` sits below the fold.

## The map is a picture; getting there is the phone's own app
`WhereCard` draws `PinMap` and puts **Open in Maps** at the top right of the
card, which hands the pin to `Linking.openURL` and stops there. Paayo does not
route, and the person already has the app they navigate with -- a client
checking their own pin and a technician driving to a job both want the same
thing, so the control is on both sides.

iOS takes `http://maps.apple.com/?ll=` (which opens the app, not the browser)
and Android takes `geo:` (which offers its chooser). A tap that opens nothing
says *No maps app on this phone answered.* rather than doing nothing, which
reads as a broken button.

## A shared card is told which end is reading it
`WhoCard`, `WhereCard` and `WhenCard` in `src/components/booking-facts.tsx` are
drawn on both `booking/[id].tsx` and `job/[id].tsx`, and the words are not the
same from both ends. A business reading *"When are they arriving?"* about its
own visit is being addressed as somebody else, which is how the provider side
shipped.

They take `audience: 'client' | 'provider'`, defaulting to `client`, and swap
every sentence that names a reader -- *When are you expected?*, *Where is the
job?*, *The client's address*. Reuse a card on a new screen and the first
question is whose voice it is written in; the default is the client's, so the
business side always passes the prop.

## A hold replaces the controls, it does not disable them
Under a provider suspension `job/[id].tsx` draws `HoldNotice` where Accept and
Decline would be. A greyed-out button reads as temporarily unavailable, which is
the wrong thing to say about a sanction — the notice says what is actually true.

## Being turned down leads with the way out
Never `destructive`. Nothing failed and it is not the client's doing, so the
declined card is `warning` and opens with **Choose someone else** rather than
with the refusal. The one fact that has to be said out loud is that *your photos
and details stay as they are* — it is the whole reason a re-pick exists instead
of cancel-and-book-again, and nobody will assume it.

`WhoCard` is hidden while a booking is declined: naming a provider as coming
when none is, is worse than an empty space.

## The re-pick shows the decliner, it does not vanish them
`service/[id].tsx` takes a `repick` param instead of a second list screen, asks
`/services/{id}?choosing=1` so the whole market comes back whether or not
somebody covers the pin, and `PUT`s to `bookings/{id}/provider` rather than
pushing Book — none of the booking form is walked again.

The provider that declined stays on the list, dimmed and badged **turned this
down**, unselectable. Removing them reads as a bug and sends the client hunting
for a name they saw a moment ago.

## The Bookings badge is amber, and counts what is owed
`tabBarBadge` reads `user.bookings_needing_provider`, so it counts bookings
waiting on a decision rather than unread ones — nothing tracks "seen", and an
accepted booking asks nothing of the client so it earns no badge. Brand amber,
not destructive red: a decision is waiting, nothing is wrong. React Navigation
takes literals, so `tabBarBadgeStyle` reads `palette.js` the way
`tabBarLabelStyle` already does, and the count is read defensively — an older
server omits the field, and `NaN` on the tab bar is worse than no badge.

## A crew has one screen, and it holds one button
`(provider)/_layout.tsx` gates every tab on its own permission rather than
branching the whole layout on `booking:view`. It used to fall back to a bare
`<Stack>` for anybody without it, which is why a technician had no screens at
all; they hold `job:work` now and Jobs is the one the role exists for. `href:
null` keeps a tab routable but off the bar.

Which list the Jobs tab reads is a permission, not a preference: `/bookings` for
somebody who answers work, `/jobs` for somebody who does it. Both answer the
same shape, so it is one list and one row. The row's pill shows the **job's**
state once there is one -- a booking reads "accepted" for as long as the work
takes, which says nothing to whoever has to do it.

`job/[id].tsx` reads through `/jobs/{job}` whenever there is a job, because a
technician deliberately holds no `booking:view` and everyone who can be on a job
holds `job:work`. The job id therefore travels with the link the way names
already do.

**One live button, for the one step the job is up to.** `nextStep()` in
`src/lib/jobs.ts` owns it. A row of four would be three wrong answers, and the
crew are reading this holding tools. There is no start button on a card with
nothing hourly on it: arriving writes `started_at` in the same breath there, and
`JobResource.starts_on_arrival` is how the phone knows.

## Finishing a job is a screen, not a sheet
`job/finish.tsx`. `price-sheet.tsx` is the outlier that draws a `<Modal>`, and
this is the same kind of form `book.tsx` and `enquiry/new.tsx` are: several
fields, a running figure, and a keyboard that has to sit under all of it.

Minutes pre-fill from `elapsed_minutes`, which the server measures from
**`started_at` and never `arrived_at`** -- the wait at the gate is not the
client's time. They pre-fill only when `hourly_label` names a line, which the
server sets only when there is exactly one hourly line: time on site cannot be
split across two, and a guess spread over both is worse than a blank.

Running past a rate's `maximum_minutes` **warns and does not refuse**. The crew
still get to report what actually happened, and the client sees a line that ran
past what the card promised.

`chargeableMinutes()` in `src/lib/jobs.ts` duplicates the server's rounding on
purpose and says so: it is a preview so the total moves as the crew type, and the
server applies it again on the way in. Its answer is the one that bills.

## The moving dot is not built, and its slot is
`PinMap` takes `crew`, draws a second marker and a line to the address, and every
caller passes **null** -- so the map renders exactly as it does today and landing
tracking later is one prop rather than a redesign. There is a test asserting the
null case changes nothing.

The line is a plain stroke, not a dash: `contourStyle` is iOS only and Google
takes no dash pattern at all, so a dashed version would be dashed on half the
phones.

What actually answers "where is the crew" is `job-progress.tsx` -- a sentence in
the tense the job is in, and a trail with the real timestamps under each rung.
For somebody waiting in at a booked hour that is more use than a marker
refreshed every thirty seconds, and it is honest: it says what is known instead
of implying a precision there isn't.

## Auto-arrival is a geofence, and the position never leaves the phone
Everything `expo-location`-geofencing is confined to `src/lib/geofence.ts`. It is
armed from `job/[id].tsx` while the job reads `enroute` and dropped the moment it
does not.

Region monitoring, not tracking: the phone's own hardware watches the boundary
and wakes the app once. That is why this could ship while the dot could not, and
why **no coordinate reaches the server** -- the request body carries
`{automatic: true}` and nothing else, which a test pins.

Radius is **150m**. iOS region monitoring is unreliable below about 100m, and the
pin is a marker somebody dropped rather than a surveyed point; a fence that never
fires is worse than one that fires at the gate.

Registering also takes **one fix of its own**, because ENTER never fires for a
boundary nobody crossed -- a crew setting out from next door would otherwise
never arrive at all.

A refused permission does nothing: no error, no nag. **The manual button stays.**
Auto-arrival removes a tap; it must never be the only way to make one.

`expo-task-manager` is the one dependency this added. `app.config.ts` declares
`expo-location` in its own right rather than leaning on the maps plugin, because
the background permission and the foreground service are not things that plugin
asks for -- and this is CNG, so a `prebuild --clean` and a fresh dev build are
needed before a fence can be tested at all.

## A notification action does not navigate
`registerJobActions()` in `src/lib/push.ts` teaches the OS the buttons, and the
root layout answers them by posting and stopping there. Being dropped into a
screen would undo the saving: the whole point is that the crew never open the app.

The action deliberately does **not** arm the geofence. That needs the address's
exact pin, and a push travels through Apple or Google -- a client's doorstep is
not worth putting through one to save a tap. Arming happens next time the job
screen is opened.

## hour_rounding is read defensively everywhere it is read
The same rule `user.suspension` and `session.user.staffs` already follow: the app
ships on its own schedule, and an older server omitting the field must not take
the offer editor down or stop a crew finishing a job. It defaults to the trade
convention, which is what the server defaults to as well.

## Getting paid: the Direct rail
The crew record that a client paid; nothing waits on the client. `job/payment.tsx`
is a full screen, following `finish.tsx` and against `price-sheet.tsx`, which is
the outlier.

**The picker offers accounts, not rails.** `PaymentMethod` is `cash | ewallet |
bank | paymongo`; GCash and Maya are **not** values, they are the `institution`
field, the way BPI is a bank. So the buttons read "Cash", "GCash", "Maya" —
built from `booking.provider.destinations`, one per published account, because
offering "E-wallet" would make the crew pick a category and then pick again.

The payment sends `method` **and** `institution`: a business may publish GCash and
Maya at once, so the rail alone no longer says where the money went.

Cash is always offered; a transfer only where the business published somewhere to
send it. That list is empty until the work has been taken, because a provider's
GCash number is their mobile number. Offering a rail with nothing published is
offering a refusal, so the picker filters rather than letting the server answer.

**A transfer must carry the confirmation screen; cash must not.** `MediaPicker`
takes `photosOnly` and `limit` for this — a video of a confirmation is not
evidence of anything the still does not show. The server refuses both directions
with a deferred trigger, so the app is preventing a round trip rather than being
the only check.

**Say who, on both screens.** A payment on this rail is somebody's word, so the
client sees "paid in cash · ₱2,000 · 25 Aug · by Mario" rather than a bare
"paid". `attestation()` in `lib/billing.ts` writes that line; `standing()` writes
the one about where the money stands, and neither accuses anybody — an unrecorded
payment is usually just forgetfulness.

**Amounts come off the invoice, never recomputed.** `outstanding()` reads the
server's figure. The rounding that produced the total belongs to the booking that
was answered, and two places computing money is how an invoice stops adding up to
its own lines.

**`destinations.tsx` is Owner only** (`provider:update`), and every owner is told
when it changes including whoever changed it. Changing where money arrives is how
a taken-over account becomes cash. The account name field is not a nicety: it is
the only thing that lets a client check they are sending to the right person.

The editor takes as many accounts as a business has, two rails deep. `institution`
is **free text with suggestions**, and the suggestions arrive as
`meta.institutions` on the destinations response — so adding a bank needs no app
release. Tapping one fills the field; typing something nobody listed is expected,
because a business banking at a rural co-op still has to be able to be paid. What
the list buys is spelling: the server refuses the same institution twice
case-insensitively, so "GCash" and "Gcash" cannot both be published.

**The QR is sent as multipart, and saying nothing about it keeps it.** The save is
a POST rather than a PUT because PHP only parses multipart on a POST. Each account
sends `destinations[N][code]` when a new image was picked, `remove_code` when it
was taken down, and **neither** when it was left alone — that last case is what
tells the server to carry the published QR forward, so editing a number does not
silently drop the code beside it. Read it back as `code_url`, a short-lived signed
link behind the same gate as the number, since the image encodes the number.

A QR is optional on both ends: a client can type the number, so a business with
none to hand is not shut out of being paid.

**`QrCard` draws it on both ends, and the crew's end is not an afterthought.** A
client cannot point a camera at their own screen, so a code they can only see in
their own app is a code they cannot use at the door — the payment screen shows the
chosen account's QR on the *crew's* phone with "Show this for them to scan", and
falls back to "read them the number" where none was published.

Tapping it opens `MediaViewer`, which is where it is big enough to scan. **Send**
and **Save** go through `lib/codes.ts`, which fetches the bytes first — the link
is signed and short-lived, so handing the URL itself to a share sheet would pass
on something that stops working within the hour.

`expo-media-library` is declared **write-only**: Paayo saves a business's own QR
and never reads the library, which the picker asks for separately. A refused
permission is answered with a sentence rather than an error, because somebody who
says no has made a choice.

Read `booking.invoice` and `provider.destinations` defensively, the way
`hour_rounding` and `user.suspension` are.
