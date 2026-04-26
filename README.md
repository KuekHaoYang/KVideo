# KVideo

KVideo is a Next.js 16 + React 19 video aggregation app focused on self-hosted deployments, multi-source search, player ergonomics, IPTV playback, and account-aware local or Redis-backed persistence.

This branch aligns the project with the 2026-04-16 audit:

- outbound requests now go through a shared server-side policy
- relay routes are private by default
- auth throttling is enforced
- Cloudflare support is Workers/OpenNext, not `next-on-pages`
- Apple TV is no longer a supported product target
- the Android wrapper is TV-only
- offline support is limited to same-origin shell/static assets

## Support Matrix

Supported:

- Desktop browsers
- Mobile browsers / PWA install flow
- Android TV wrapper in [`android-tv`](/Users/haoyangkuek/development/KVideo/android-tv)
- Self-hosted Node.js
- Docker
- Cloudflare Workers via OpenNext

Not supported:

- Apple TV / tvOS app packaging

Apple TV users should use the web app in a browser or an AirPlay-style fallback instead of a native tvOS client.

## Deployment Modes

### Self-hosted Node.js / Docker

Recommended when you need the full product surface:

- external media proxy
- IPTV relay
- account management with Redis-backed managed auth
- cross-device config sync

Commands:

```bash
npm install
npm run build
npm start
```

Docker:

```bash
docker build -t kvideo .
docker compose up -d
```

### Cloudflare Workers

Cloudflare support is provided through OpenNext.

Commands:

```bash
npm run cf:build
npm run cf:preview
```

Important:

- use Workers/OpenNext, not Cloudflare Pages direct upload
- managed Cloudflare/Vercel deployments run in restricted mode in this codebase
- restricted mode disables external media relay and IPTV relay on those managed platforms

## Security Defaults

This project no longer behaves like a public generic fetch service.

- Only `http` and `https` outbound targets are allowed.
- Loopback, private, link-local, metadata, and reserved ranges are blocked by default.
- Hostnames are resolved before fetch, and redirects into blocked ranges are rejected.
- Relay endpoints do not forward cookies or spoof client IP / origin / referer headers.
- Public relay access is disabled unless explicitly enabled.
- `AUTH_SECRET` is required whenever auth is enabled.
- Login failures are throttled and can return `429` with `Retry-After`.

## Environment Variables

Core auth and access:

| Variable | Required | Notes |
| --- | --- | --- |
| `AUTH_SECRET` | Required when auth is enabled | Session signing secret. Missing secret disables authenticated relay/account flows. |
| `ADMIN_PASSWORD` | Optional | Legacy/admin bootstrap password. |
| `ACCESS_PASSWORD` | Optional | Legacy compatibility alias for `ADMIN_PASSWORD`. |
| `ACCOUNTS` | Optional | Bootstrap account list. Supports legacy and username-based formats. |
| `PREMIUM_PASSWORD` | Optional | Separate password for `/premium`. |

Relay and outbound policy:

| Variable | Required | Notes |
| --- | --- | --- |
| `KVIDEO_PUBLIC_RELAY_ENABLED` | Optional | Defaults to disabled. Public unauthenticated relay stays off unless set to `true`. |
| `KVIDEO_OUTBOUND_PRIVATE_HOST_ALLOWLIST` | Optional | Comma-separated allowlist for intentional LAN/private targets. Server-only. |

Redis / managed auth / sync:

| Variable | Required | Notes |
| --- | --- | --- |
| `UPSTASH_REDIS_REST_URL` | Optional | Enables managed accounts and sync features when paired with token. |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Enables managed accounts and sync features when paired with URL. |

Player integrations:

| Variable | Required | Notes |
| --- | --- | --- |
| `DANMAKU_API_URL` | Optional | Server-side default Danmaku API URL. |
| `NEXT_PUBLIC_DANMAKU_API_URL` | Optional | Client-visible default Danmaku API URL. |
| `VIDEOTOGETHER_ENABLED` | Optional | Defaults to disabled unless explicitly set to `true`. |
| `VIDEOTOGETHER_SCRIPT_URL` | Required when `VIDEOTOGETHER_ENABLED=true` | Must be an explicit HTTPS URL. No `@latest` default is used anymore. |
| `VIDEOTOGETHER_SETTING_URL` | Optional | Explicit settings page URL for the VideoTogether integration. |

## Runtime Behavior Changes

- `/api/proxy` and related relay routes now reject unsafe targets with 4xx responses.
- `/api/auth` may return `429` after repeated failed login attempts.
- `/api/user/config` and `/api/user/sync` silently no-op when Redis is absent.
- `clear all data` now also calls `DELETE /api/auth/session` and removes the httpOnly session.

## Offline / PWA Scope

Offline support is intentionally narrow.

- cached: same-origin shell and static assets
- fallback: navigation fallback to [`public/offline.html`](/Users/haoyangkuek/development/KVideo/public/offline.html)
- not cached for offline playback: remote media, proxy responses, IPTV streams, API data

## Android TV

The Android wrapper is TV-only.

- no standard phone launcher entry
- release behavior enforces HTTPS
- mixed content is disabled
- WebView navigation is restricted to the configured app origin
- the remaining JavaScript bridge is only for PiP-related behavior

Build commands:

```bash
cd android-tv
./gradlew --no-daemon lint test assembleDebug assembleRelease
```

## Development

Install dependencies:

```bash
npm install
```

Useful commands:

```bash
npm run lint
npm test
npm run test:e2e
npm run build
npm run cf:build
docker compose config
docker build -t kvideo .
cd android-tv && ./gradlew --no-daemon lint test assembleDebug assembleRelease
```

## CI Gates

This repo is expected to stay green on:

- ESLint
- Node unit tests
- Playwright smoke tests
- Next.js production build
- OpenNext / Workers build
- `npm audit --omit=dev`
- `docker compose config`
- Docker image build
- Android TV lint / test / debug / release builds

## Repository Notes

- `npm start` runs the standalone Next.js server output.
- `pages:build` is kept only as a temporary compatibility alias to the Workers/OpenNext build path.
- The old Apple TV sample app has been removed from the supported product path on purpose.
