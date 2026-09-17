# Update server

Serves Expo Updates protocol v1 from bundles baked into the image. It holds no
state: the image is the artifact, deploying is pushing a tag, rolling back is
redeploying the previous one.

It knows nothing about `paayo-server` and `paayo-server` knows nothing about it.

## Layout

    main.go        wiring and the four routes
    catalog.go     reads index.json, hashes every file a release points at
    sign.go        RSA-SHA256 code signing
    stage.mjs      build-time: lays an `expo export` out under exports/<id>
    minimum.json   the force-update floor, per platform
    bundles/       exports carried forward from earlier images (see below)
    certs/         the public certificate; the private key is never here

## Retention

An install built against runtime fingerprint `A` only accepts a manifest whose
`runtimeVersion` is exactly `A`. If the image held only the newest fingerprint,
every phone on an older native build would silently get `noUpdateAvailable`
forever -- indistinguishable from being up to date.

So `bundles/` carries earlier exports forward: copy the previous image's
`/srv/updates/exports/<id>` and `index.json` into it, and `stage.mjs` merges them
ahead of the new export. Prune a runtime version only once its native build is
dead, which is what the floor in `minimum.json` is for -- raise it, wait for
adoption, then drop the directory.

## Running

    CODE_SIGNING_KEY="$(cat private-key.pem)" ./updates

`UPDATES_ROOT` (default `/srv/updates`), `PORT` (8000), `PUBLIC_URL` and
`CODE_SIGNING_KEY_ID` (`main`) are the other knobs. Without a key it refuses to
start.
