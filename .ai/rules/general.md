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
