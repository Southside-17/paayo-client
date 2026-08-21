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
