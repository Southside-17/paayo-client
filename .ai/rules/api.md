---
paths:
  - 'src/lib/api.ts'
  - 'src/lib/session.tsx'
  - 'src/lib/types.ts'
  - 'src/lib/upload.ts'
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

## A passkey is bound to a domain, and the app must prove it owns one
`react-native-passkeys` asks the platform, and the platform refuses until it has
fetched a file from that domain over HTTPS: iOS reads
`/.well-known/apple-app-site-association` and looks for this bundle, Android
reads `/.well-known/assetlinks.json` and looks for the signing certificate. An
IP or `localhost` can never satisfy either, so passkeys do not work against a
dev server no matter what else is right.

iOS additionally needs `EXPO_PUBLIC_PASSKEY_IOS`, which gates the Associated Domains entitlement -- a paid Apple Developer Program capability, and a build without it hides the buttons rather than failing at the sheet. See `.ai/rules/toolchain.md`.

`EXPO_PUBLIC_PASSKEY_RP_ID` names the domain -- `www.paayo.ph`, and the `www` is
load-bearing: the apex carries no A record, so a relying party there fails at
DNS. It must equal `PASSKEY_RP_ID`
on the server -- it drives the iOS Associated Domains entitlement in
`app.config.ts`, so changing it means `expo prebuild` and a rebuild, not a Metro
reload. It stays empty in development, where it could not work anyway, and the
buttons hide rather than offering something that cannot.

The API host is a separate thing and does not have to be that domain. A browser
derives the relying party from the page's own origin; an app declares it and
proves ownership out of band, so `EXPO_PUBLIC_API_URL` can stay a LAN address
while passkeys belong to the deployed domain.

The server parks each ceremony behind a `challenge_token` because there is no
session to hold it in; send it back untouched with the credential. The options
it returns are already in the JSON shape `create`/`get` take, so they are passed
straight through -- restating that shape here would only be somewhere for it to
drift. A null answer from either is the sheet being dismissed, which says
nothing, exactly as Google does.

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

A native client is handed a one-use authorization code, never a token, so
`exchangeCode()` is the leg that produces something the server can verify. It
reads the client id and the redirect back off the request rather than rebuilding
them, so they cannot drift from what was actually sent and earn a
`redirect_uri_mismatch`. `shouldAutoExchangeCode` is off for the same reason a
code redeems once: the hook's own exchange resolves long after `promptAsync()`
returns, and both running is one `invalid_grant`.

Declining the sheet returns null and the screen says nothing: backing out is a
decision, not a failure.

## A file goes through XMLHttpRequest, never through fetch
Expo SDK 57 replaces `globalThis.fetch` with its own implementation --
`install('fetch', () => require('./fetch').fetch)` in
`expo/src/winter/runtime.native.ts`. That one accepts a string, a `Blob`, or
something carrying `bytes()`, and React Native's own `{uri, name, type}` file
part reaches its `else` and throws:

```
Error: Unsupported FormDataPart implementation
```

It throws in `expo/src/winter/fetch/convertFormData.ts` **before a socket is
opened**, so nothing reaches the server and no status comes back -- which
`useSubmit` reports as "Could not reach Paayo", because an error with no status
is indistinguishable from a dead network. Hours went into the server before the
error itself was read; the `__DEV__` warning in `useSubmit` exists so the next
one is read first.

`XMLHttpRequest` is untouched by that swap. `convertRequestBody` turns a
FormData into the native part list (`{formData: body.getParts()}`) and the
networking layer streams the file off disk, which is what `fetch` itself used to
do. So `request()` splits: multipart through `sendMultipart`, everything else
through `sendJson`.

Do not set `Content-Type` on the multipart branch -- only the native layer knows
the boundary it is about to generate. And re-sending is safe: RN's `getParts()`
is idempotent, so the 401-refresh retry can hand back the same FormData, which a
consumed web `FormData` could not.

## Stored files are fetched from a signed URL, with no headers at all
The server no longer serves bytes. An attachment carries `url` and a user carries `avatar_url`: a link the object store signed, good for an hour, present only once there is something to fetch. Draw it directly.

Send nothing alongside it. The signature is in the query string, and a store reads an `Authorization` header in preference to it and then fails to verify a bearer token it was never issued. `MediaThumb`, `MediaViewer` and `Avatar` all take a plain URL and none of them accepts headers -- do not add them back, and do not build an attachment address out of `API_URL` either.

A fresh signature arrives with every load of the resource, which is also what replaced the avatar cache-busting counter: a new picture appears because the URL changed, not because anything told the image cache to look again.

## Files go up straight to the store, in parts, several at once
`POST /attachments` answers with `upload.parts` -- a signed address per part, each good for putting exactly that part of exactly that file. `src/lib/upload.ts` `PUT`s the parts at those addresses itself.

Nothing crosses the API but the open, the seal, and a re-grant if one is needed. This replaced a relay where every part was posted to the server and forwarded on, which cost two hops per part and allowed only one part at a time.

**A part never passes through JavaScript.** It is carved out of the source file on disk with `expo-file-system`'s `FileHandle` -- `readBytes` at an offset into a scratch file, `CARVE` bytes at a time -- and then handed to `File.createUploadTask(url, {uploadType: UploadType.BINARY_CONTENT})`, which streams it from disk to the socket natively. A file small enough to be one whole part skips the carving and is sent where it lies.

This is not a preference. React Native holds a Blob as one contiguous `NSData` in `RCTBlobManager`'s dictionary, and `slice()` is a `subdataWithRange:` **copy** on top -- so reading a video in to send it put the whole video in memory twice and the app was killed part way up a 125MB clip. Do not reintroduce `responseType: 'blob'`, `xhr.send(blob)` or any path that names the bytes in JS.

**Send no headers on a part.** The address is signed and the signature is in the query string; a store reads an `Authorization` header in preference to it and then fails to verify a token it was never issued. `putPart` therefore goes nowhere near `request()`, which attaches the bearer token and the 401-refresh.

`LANES` parts are in the air at once. A part that comes back non-2xx is collected rather than thrown: one `GET /attachments/{id}/parts` re-signs everything and reports what the store already holds, so only the genuinely missing parts go again. That single retry is also what covers a signature expiring during a long upload.

Part size is the server's to decide and arrives as `upload.part_size`; the slices come from each part's own `offset` and `size`, so nothing here has to agree with the server about arithmetic. It is fixed rather than a ceiling -- a store will not assemble a part under 5MB into anything but the end of a file.

Progress is `createUploadTask`'s `onProgress`, summed across parts as a fraction of the **whole file**, never of the part alone, and parts finishing out of order is normal now. `request()` reports no progress of its own and takes no callback: nothing that goes through the API is big enough to need one.

There is no `received` on an attachment. The server never sees the bytes, so it does not count them; `uploaded` per part in the grant is the only truth about what landed, and it comes from the store.

**A part is put on a foreground session, and that is not the default.** `expo-file-system` asks for `sessionType: 'background'` unless told otherwise, and an iOS background `URLSession` waits for connectivity rather than failing -- its resource timeout is seven days. So a part the store never answers neither lands nor errors, `uploadAsync` never settles, and the attachment stays at a progress that never becomes `null`. `stillSending` reads that as an upload in flight and Book refuses to place the booking with "Wait for the upload to finish.", with no progress and no retry tile, until the app is killed. The way to get there is a signed address naming a host the client cannot reach -- which is what `AWS_ENDPOINT=localhost` on the server hands a phone.

Foreground costs nothing here. The module does not restore the JavaScript `UploadTask` after a relaunch, so a background session could never report a part it finished while the app was away either; resuming is a `GET /attachments/{id}/parts` away, and that is already how a killed upload picks up. Android's OkHttp path has always had 60s timeouts, so this only ever wedged on iOS.
