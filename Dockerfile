# syntax=docker/dockerfile:1.7

# The OTA update server. It is built from this repo because the bundles it serves
# are this repo's -- `paayo-server` has no part in it and never learns that the
# mobile app has versions.
#
# Three stages, and nothing from the first two survives into the image except two
# directories: a static binary and an `expo export`. That is what lets the runtime
# be `distroless/static` rather than a base carrying a language runtime around --
# ~2 MB against ~60 MB for `node:alpine` or ~140 MB for `distroless/nodejs`.
#
# When CI takes over the build, stages one and two lift out unchanged and this
# collapses to the COPY-only stage at the bottom.

ARG GO_VERSION=1.27
ARG NODE_VERSION=22

FROM golang:${GO_VERSION}-alpine AS builder

WORKDIR /src

COPY server/go.mod ./
RUN go mod download

COPY server/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /updates .

FROM node:${NODE_VERSION}-alpine AS bundler

# EXPO_PUBLIC_* is inlined into the bundle by Babel at export time, so these are
# baked in here rather than read at run time. They mirror the PRODUCTION map in
# scripts/build.mjs:42-52.
ARG EXPO_PUBLIC_API_URL=https://www.paayo.ph
ARG EXPO_PUBLIC_PASSKEY_DOMAIN=www.paayo.ph
ENV EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL} \
    EXPO_PUBLIC_PASSKEY_DOMAIN=${EXPO_PUBLIC_PASSKEY_DOMAIN}

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

RUN npx expo export --platform ios --platform android --output-dir /export \
    && node server/stage.mjs /export /srv/updates

FROM gcr.io/distroless/static:nonroot

COPY --from=builder /updates /updates
COPY --from=bundler /srv/updates /srv/updates

ENV PORT=8000 \
    UPDATES_ROOT=/srv/updates

EXPOSE 8000

# No HEALTHCHECK: there is no shell in the image to run one. Probe GET /up from
# the orchestrator instead.
ENTRYPOINT ["/updates"]
