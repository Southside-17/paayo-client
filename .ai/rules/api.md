---
paths:
  - 'src/lib/api.ts'
  - 'src/lib/session.tsx'
  - 'src/lib/types.ts'
---

# Talking to the server

## The server validates, the client renders
A 422 carries per-field messages; `useSubmit` unpacks them and the form shows
each against its input. Do not reimplement the server's rules on the client --
password strength, nickname shape, and uniqueness all live there.

## Shapes that will bite
- **Logout answers 204** with no body. `JSON.parse` on it throws; `request()` returns `undefined` for that status.
- **`expires_at` is nullable** in the contract even though config currently sets 12 hours.
- **Login is a union.** It returns a token response *or* `{ two_factor: true, challenge_token }`. Narrow with `isTwoFactorChallenge()` before assuming a token.
- **Refresh is destructive.** The server deletes the presented token, so a failed refresh means the device is signed out for good -- never retry it in a loop.
- **Reading 2FA enrolment material before `POST /auth/two-factor`** returns 422 on `code`, not 404.

## An address has no Region, and its locality is `town`
Province is the top place name; `region` was stored and then ignored, and is
gone from the column, the request, `AddressResource` and the `identity_address`
shape. The locality is `town` -- one word covering cities and municipalities --
never `city`. `Address` in `src/lib/types.ts` and the form's `FIELDS` mirror the
server's `.ai/rules/models.md` on this; do not put either name back.

## Profile is not an auth route
It sits at `api/v1/profile` and `api/v1/profile/avatar`, beside addresses and
identifications. `auth/*` is for proving who you are and holding the token, not
for editing what the account says about itself.

## Two flows finish in a browser, by design
Password reset and email verification are completed by the server, which reuses
Laravel's broker and consumes the signed link itself. The app cannot confirm
either one locally -- it can only request another email and re-read the account.
Do not add an API endpoint for reset-with-token without revisiting that decision.

## FormData goes through untouched, and names no Content-Type
`request()` passes a `FormData` body straight to `fetch` and deliberately omits
the header. Only the runtime knows the multipart boundary it is about to
generate; writing `multipart/form-data` ourselves omits the boundary and the
server rejects the body. A plain object still gets `application/json`.

Re-sending the same `FormData` after a 401 refresh is safe here in a way it is
not on the web: React Native holds file parts as URIs and re-reads them per
request, rather than consuming a stream. So `authenticatedRequest` needs no
body factory for the retry.

## Google sign-in posts a token; it never redirects
The API is a stateless exchange: `src/lib/google.ts` gets an access token from
`expo-auth-session`, and `signInWithGoogle()` posts it to
`POST auth/socials/google`. The server answers exactly as password login does --
a token response, or a second-factor challenge -- so callers branch on
`isTwoFactorChallenge()` either way. A brand new account comes back 201 rather
than 200; nothing on the client needs to care.

Three client ids, because Google verifies each kind of app differently: web by
its secret, Android by package name plus signing fingerprint, iOS by bundle
identifier. Only ids live in `.env` -- a mobile OAuth client has no usable
secret. Both mobile ids are bound to `com.paayo.ph`, so renaming the app means
new clients.

The server refuses a token minted for a client it does not know, so these ids
must appear in its `services.google.audiences`. A build without the id its
platform needs hides the button rather than offering one that cannot work.

Declining the sheet returns null and the screen says nothing: backing out is a
decision, not a failure.
