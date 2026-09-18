---
paths:
  - Dockerfile
  - .dockerignore
  - compose.yaml
  - 'server/**'
---

# Deployment

## The service is paayo-client, and it has its own network
`compose.yaml` declares one service, `paayo-client`, built from `Dockerfile`. It
runs on `paayo-client-network` and is deliberately **not** joined to the server
repo's `paayo-server-network`.

The update server holds no state and talks to nothing: it serves bundles baked
into its own image. `paayo-server` has no part in OTA updates and never learns
that the app has versions. A shared bridge between the two would be the first
thing to suggest otherwise, so there is no `external:` network reference in
either file.

## CODE_SIGNING_KEY comes from the shell, never from .env
The private key is a multi-line PEM, and dotenv parsing of one is a trap — the
same reason the server base64-encodes `APNS_PRIVATE_KEY`. `compose.yaml` reads it
from the process environment instead:

    CODE_SIGNING_KEY="$(cat certs/private-key.pem)" docker compose up -d --build

Do **not** write it as `${CODE_SIGNING_KEY:?...}`. Compose interpolates the whole
file on every subcommand, so a required-variable marker makes `down`, `logs` and
`ps` fail as well — including the `down` needed to clean up a stack that is
already running. A missing key is not silent anyway: the binary refuses to start
with `updates: CODE_SIGNING_KEY is not set`.

`certs/private-key.pem` is gitignored and excluded by `.dockerignore`. It is
never baked into the image; only `certs/certificate.pem` ships, compiled into the
app.

## EXPO_PUBLIC_* are build args, not environment
Babel inlines every `EXPO_PUBLIC_*` into the bundle at `expo export` time, so
`EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_PASSKEY_DOMAIN` are `build.args` in
`compose.yaml`, not `environment`. Changing either means a rebuild, not a
restart. They mirror the `PRODUCTION` map in `scripts/build.mjs`.

Only `PORT`, `UPDATES_ROOT`, `PUBLIC_URL`, `CODE_SIGNING_KEY` and
`CODE_SIGNING_KEY_ID` are read at run time, by the Go binary.

## The host port is 44800
The project's host ports live in a 44xxx block so nothing collides with a stock
service on the machine — see `.ai/rules/deployment.md` in the server repo, which
owns 44000/44025/44080/44173/44379/44432/44825/44900/44901. 44800 is this repo's,
echoing the container's `PORT=8000`. Take the next free number in the block
rather than a default if another service is ever added here.

## No healthcheck in compose, because the image has no shell
The runtime stage is `gcr.io/distroless/static`. There is nothing to run a
`HEALTHCHECK` command in, which is why `Dockerfile` has none either. Probe
`GET /up` from the orchestrator or the proxy instead.

## compose.yaml is in .dockerignore
The `bundler` stage does `COPY . .` before the Expo export. Without the ignore
entry, editing compose would invalidate that layer and re-run the whole export
for a change the image never reads.
