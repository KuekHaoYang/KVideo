# Contributing

## Baseline

Contributions are expected to preserve the post-audit behavior of this repository:

- secure outbound request policy
- private-by-default relay endpoints
- explicit auth secret requirements
- Workers/OpenNext Cloudflare path
- Android TV-only wrapper scope
- Apple TV unsupported

Do not reintroduce permissive relay behavior, wildcard CORS, cookie forwarding, TLS verification bypasses, or public private-network fetches.

## Prerequisites

- Node.js 22+
- npm 10+
- Java 17 for Android builds
- Android SDK for Android TV validation
- Docker if you need to run the image/build checks locally

Install dependencies:

```bash
npm install
```

## Development Commands

```bash
npm run dev
npm run lint
npm test
npm run test:e2e
npm run build
npm run cf:build
docker compose config
docker build -t kvideo .
cd android-tv && ./gradlew --no-daemon lint test assembleDebug assembleRelease
```

## Required Checks Before a PR

At minimum, run the checks relevant to the code you changed. For broad or infrastructure-facing work, run the full matrix:

- `npm run lint`
- `npm test`
- `npm run build`
- `npm run cf:build`
- `npm audit --omit=dev`
- `docker compose config`
- `docker build -t kvideo .`
- `cd android-tv && ./gradlew --no-daemon lint test assembleDebug assembleRelease`

If you touch user flows, add or update Playwright smoke coverage in [`playwright`](/Users/haoyangkuek/development/KVideo/playwright).

## Style Expectations

- Keep changes scoped and intentional.
- Prefer testable extraction over speculative abstraction.
- Do not add fake compatibility aliases for insecure legacy behavior.
- Do not depend on arbitrary file-length limits. CI-backed quality gates matter; line counts do not.
- Keep documentation accurate to the actual runtime behavior of the branch.

## Pull Requests

Each PR should include:

- what changed
- why it changed
- risk areas
- validation performed
- any deployment/env var changes

If a change affects relay, auth, sync, IPTV, PWA behavior, Workers deployment, or Android TV, say so explicitly in the PR body.
