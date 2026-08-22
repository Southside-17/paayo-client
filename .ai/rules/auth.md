---
paths:
  - 'src/app/(auth)/**'
---

# The signed-out stack

## Login is the root, and every other screen sits over it
`unstable_settings = { initialRouteName: 'login' }` in `(auth)/_layout.tsx`.
The group holds no `index.tsx`, so without it the anchor is whichever route the
router happens to sort first, and a deep link to `/register` opens with nothing
underneath -- back then has nowhere to go.

## Forward links push, return links dismiss
Login pushes to `/forgot-password` and `/register`. The links that come back --
**Back to log in**, **Log in** -- are `dismissTo`, which pops until the login
already in the stack is reached.

They used to be plain `<Link href="/login">`, which pushes a *second* login on
top of register, and the next tap pushed a second register on top of that.
Login -> forgot password -> login -> sign up left four screens deep and four
presses from the way out.

`dismissTo` also degrades correctly: expo-router replaces the current screen
when the target is not in the stack, so a deep link straight to `/register`
still lands on one login rather than two.

Two-factor is the exception and is a genuine step forward -- `router.push` from
login, and back cancels the challenge.
