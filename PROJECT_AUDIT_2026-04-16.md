# KVideo Project Audit

Date: 2026-04-16 18:14:16 +08  
Repository: `KVideo`  
Branch: `main`  
HEAD: `20c9ae3`

## Scope

This audit covered:

- Repository structure, docs, contribution rules, workflows, and deployment files
- Web app routes discovered from the Next.js build output
- Runtime commands that can be executed in this environment
- Security-sensitive API routes, auth, proxying, storage, PWA, TV wrappers, and UI surfaces
- Screenshot-based UI inspection
- Android emulator install/launch checks and Apple toolchain validation

This is not a fake “overview.” Commands were actually run, screenshots were actually captured, and several findings were reproduced end-to-end.

## Executive Summary

The project is functional enough to build, render, and pass a small test suite. That is the good part.

The bad part is larger:

- There is a real, exploitable credential-leak vulnerability in `/api/proxy`.
- There are multiple unauthenticated open-fetch/open-relay surfaces.
- TLS verification is globally disabled in one of the server fetch utilities.
- The repo does not follow its own contribution standards.
- The docs overclaim several things that the code does not actually do.
- CI enforcement is effectively missing.
- The codebase has obvious “shit-mountain” areas: giant files, heavy `any` usage, lint failure everywhere, and platform support that is inconsistent between docs and code reality.
- The Android wrapper does build and boot, but it is still a permissive WebView shell, and the non-TV Android path is visibly wrong.
- The Apple TV story is worse: the repo does not contain a buildable project, and the provided `WKWebView` example contradicts the tvOS support reality exposed by the local SDK and Apple’s platform guidance.

If this were a production system, the proxy/auth issues need to be fixed before anything else.

## Commands Run

### Environment

```bash
node --version
# v25.9.0

npm --version
# 11.12.1

git branch --show-current
# main

git rev-parse --short HEAD
# 20c9ae3
```

### Project checks

```bash
npm test
npm run lint
npm run build
npm run pages:build
npm audit --omit=dev
npm audit
npm outdated
docker compose config
docker build -t kvideo-audit .
./gradlew --no-daemon tasks
env JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home PATH=/opt/homebrew/opt/openjdk@17/bin:$PATH sdkmanager --list_installed
env JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home PATH=/opt/homebrew/opt/openjdk@17/bin:$PATH ANDROID_HOME=/opt/homebrew/share/android-commandlinetools ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools ./gradlew --no-daemon assembleDebug assembleRelease lint test
env JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home PATH=/opt/homebrew/opt/openjdk@17/bin:$PATH ANDROID_HOME=/opt/homebrew/share/android-commandlinetools ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools ./gradlew --no-daemon assembleDebug -PkvideoUrl=http://10.0.2.2:3000
xcodebuild -version
xcodebuild -showsdks
xcrun --sdk appletvsimulator swiftc -typecheck apple-tv/KVideoTV/KVideoTV/ContentView.swift apple-tv/KVideoTV/KVideoTV/KVideoTVApp.swift -target arm64-apple-tvos16.0-simulator
```

### Local route/runtime checks

```bash
curl -I http://localhost:3000/
curl -I http://localhost:3000/settings
curl -I http://localhost:3000/premium
curl -I http://localhost:3000/iptv
curl http://localhost:3000/api/auth
```

### Native runtime checks

```bash
adb install -r android-tv/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.kvideo.tv/.MainActivity
adb exec-out screencap -p > audit-artifacts/android-tv-setup.png
adb exec-out screencap -p > audit-artifacts/android-tv-loaded.png
adb -s emulator-5556 install -r android-tv/app/build/outputs/apk/debug/app-debug.apk
adb -s emulator-5556 shell am start -n com.kvideo.tv/.MainActivity
adb -s emulator-5556 exec-out screencap -p > audit-artifacts/android-phone-loaded.png
```

### Security reproductions

```bash
curl 'http://localhost:3000/api/proxy?url=https%3A%2F%2Fexample.com'
curl 'http://localhost:3000/api/iptv?url=https%3A%2F%2Fexample.com'
curl -X POST 'http://localhost:3000/api/detail' ...
curl -X POST 'http://localhost:3000/api/search-parallel' ...
curl 'http://localhost:3000/api/proxy?url=https%3A%2F%2Fhttpbin.org%2Fanything' -H 'Cookie: kvideo_session=test123; foo=bar'
```

## Route Surface Found

From `npm run build`:

- Pages: `/`, `/favorites`, `/iptv`, `/player`, `/premium`, `/premium/favorites`, `/premium/settings`, `/settings`
- API routes:
  `/api/app-update`, `/api/auth`, `/api/auth/accounts`, `/api/auth/accounts/[accountId]`, `/api/auth/session`, `/api/config`, `/api/danmaku`, `/api/detail`, `/api/douban/image`, `/api/douban/recommend`, `/api/douban/tags`, `/api/iptv`, `/api/iptv/stream`, `/api/ping`, `/api/premium/category`, `/api/premium/types`, `/api/probe-resolution`, `/api/proxy`, `/api/search-parallel`, `/api/user/config`, `/api/user/sync`

Observed direct route status checks:

- `/` -> `200`
- `/settings` -> `200`
- `/premium` -> `200`
- `/iptv` -> `200`
- `/api/auth` -> `200`

## Critical Findings

### 1. `/api/proxy` leaks incoming cookies to attacker-chosen upstream hosts

Files:

- `app/api/proxy/route.ts:32-41`
- `lib/utils/fetch-with-retry.ts:41-57`

Why this is critical:

- `/api/proxy` explicitly forwards the incoming `cookie` header to the upstream URL.
- The upstream URL is attacker-controlled via `?url=...`.
- The KVideo session cookie is `httpOnly`, which means client JS cannot read it, but the server can. This route forwards it anyway.
- Result: every proxied third-party host can receive the user’s KVideo session token.

Relevant code:

- `app/api/proxy/route.ts:33-39` copies `cookie` and `range`.
- `app/api/proxy/route.ts:41` passes those headers into `fetchWithRetry`.
- `lib/utils/fetch-with-retry.ts:43` spreads those forwarded headers into the upstream request.

This is not theoretical. It was reproduced with `httpbin`:

```bash
curl -s 'http://localhost:3000/api/proxy?url=https%3A%2F%2Fhttpbin.org%2Fanything' \
  -H 'Cookie: kvideo_session=test123; foo=bar'
```

Observed upstream echo:

```json
"Cookie": "kvideo_session=test123; foo=bar"
```

That is a real credential leak path.

Impact:

- Session theft
- Cross-user account takeover if the leaked cookie belongs to an authenticated user
- Silent cookie leakage to any proxied media/domain, not just explicit attackers

Minimum fix:

- Stop forwarding `cookie` to external origins entirely.
- If any cookies must ever be forwarded, scope them to a strict allowlist and never include app auth/session cookies.
- Add strict upstream allowlisting for proxy targets.

### 2. Global TLS certificate verification is disabled

File:

- `lib/api/http-utils.ts:6-7`

Relevant code:

```ts
// Disable SSL verification for video sources with invalid certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
```

Why this is critical:

- This disables TLS validation for Node-side HTTPS requests globally, not only for one bad upstream.
- It turns MITM from “harder” into “trivial” anywhere this utility is used in a Node runtime.
- This is security debt at the process level, not one call site.

Minimum fix:

- Delete this line.
- If broken sources must be supported, isolate that behavior behind an explicit per-source opt-in and a custom agent, not a process-wide kill switch.

## High Severity Findings

### 3. Multiple unauthenticated open-fetch / SSRF / relay surfaces exist

Files:

- `app/api/proxy/route.ts:25-41`
- `app/api/iptv/route.ts:10-35`
- `app/api/iptv/stream/route.ts:107-138`
- `app/api/danmaku/route.ts:17-63`
- `app/api/detail/route.ts:94-100`
- `app/api/search-parallel/route.ts:37-49`
- `app/api/ping/route.ts:12-54`
- `app/api/douban/image/route.ts:7-18`

Why this is bad:

- The app exposes several server/edge fetchers that accept arbitrary external destinations.
- Some are public and unauthenticated.
- Some are documented as proxies, but others are presented as app APIs while still trusting caller-supplied upstream targets.

Observed behavior:

- `/api/proxy?url=https://example.com` returned Example Domain HTML.
- `/api/iptv?url=https://example.com` returned Example Domain HTML.
- `/api/search-parallel` accepted a caller-supplied source object and attempted the fetch.
- `/api/detail` accepted a caller-supplied source object and attempted the fetch.

This is enough to classify the HTTP surface as an open relay / SSRF surface.

Minimum fix:

- Add strict allowlists for upstream domains.
- Reject private IPs, localhost, RFC1918, link-local, metadata ranges, and non-http(s) schemes.
- Require auth for proxying if this feature is meant only for trusted users.
- Remove caller-supplied source configs from server routes, or validate them against trusted server-side source registries only.

### 4. `/api/proxy` also supports header and IP spoofing

File:

- `lib/utils/fetch-with-retry.ts:18-23`
- `lib/utils/fetch-with-retry.ts:45-56`

Bad behavior:

- Random UA rotation
- Synthetic `Referer`
- Synthetic `Origin`
- Caller-controlled `ip` parameter
- Hardcoded fallback IP `202.108.22.5`
- Explicit `X-Forwarded-For` and `Client-IP`

This is not just ugly. It creates unreliable behavior, makes upstream debugging harder, and can turn your server into a generic anti-blocking relay that upstreams did not consent to.

### 5. No rate limiting or lockout on auth endpoints

File:

- `app/api/auth/route.ts:15-35`

Why it matters:

- Password and premium validation are directly exposed.
- There is no rate limiting, no lockout, no backoff, no IP throttling, no per-account throttling.

Result:

- Brute-force resistance is weak.
- This is especially bad when paired with long-lived cookies and legacy password mode.

### 6. PWA/offline caching is claimed in the docs but not implemented

Files:

- `README.md:173-178`
- `public/sw.js:1-17`

Doc claim:

- “Service Worker: offline caching and resource preloading”

Reality:

- The service worker only calls `skipWaiting`, deletes legacy caches, and calls `clients.claim()`.
- There is no `fetch` handler.
- There is no precache.
- There is no runtime cache.
- There is no offline fallback.

This is a direct documentation mismatch.

### 7. The project claims “silent degradation” without Redis, but build output is noisy

Files:

- `README.md:194-195`
- `app/api/user/config/route.ts:14`
- `app/api/user/sync/route.ts:8`

Doc claim:

- Without Redis, config sync “静默降级” and the app still works locally.

Observed build behavior:

- `npm run build`
- `npm run pages:build`
- `docker build`

All emitted repeated Upstash warnings:

```text
[Upstash Redis] Unable to find environment variable: `UPSTASH_REDIS_REST_URL`
[Upstash Redis] Unable to find environment variable: `UPSTASH_REDIS_REST_TOKEN`
[Upstash Redis] The 'url' property is missing or undefined in your Redis config.
[Upstash Redis] The 'token' property is missing or undefined in your Redis config.
```

Cause:

- `Redis.fromEnv()` is executed at module scope in `app/api/user/config/route.ts` and `app/api/user/sync/route.ts`.

That is not silent degradation.

### 8. Dependency security is not clean

Observed:

- `npm audit --omit=dev` -> 1 high vulnerability
- `npm audit` -> 26 vulnerabilities total, including 11 high

Highlights:

- `next` vulnerable to `GHSA-q4gf-8mx6-v5v3`
- vulnerable trees through `vercel`, `@cloudflare/next-on-pages`, `tar`, `undici`, `path-to-regexp`, `flatted`, `picomatch`, `minimatch`

This does not mean instant compromise, but it absolutely means the dependency surface is not healthy.

## Medium Severity Findings

### 9. `npm start` is inconsistent with `output: 'standalone'`

Files:

- `package.json:8`
- `next.config.ts:13`
- `README.md:818`
- `README.md:968`

Observed at runtime:

```text
"next start" does not work with "output: standalone" configuration.
Use "node .next/standalone/server.js" instead.
```

This is a documentation and script mismatch.

### 10. `next/image` remote allowlist is wildly over-broad

File:

- `next.config.ts:19-114`

Bad behavior:

- Allows `http` and `https` for `**.com`, `**.cn`, `**.net`, `**.org`, `**.tv`, `**.io`, `**.xyz`, `**.online`, `**.top`

Why this is bad:

- This is effectively “allow almost the public internet.”
- It weakens any security/perf benefit of a curated image allowlist.
- It increases exposure to abusive image optimization fetches.

### 11. Legacy auth session signing falls back to secrets derived from credentials

File:

- `lib/server/auth.ts:247-254`

Behavior:

- If `AUTH_SECRET` is missing, legacy mode signs session tokens using:

```ts
`legacy:${effectiveAdminPassword}:${ACCOUNTS}:${PREMIUM_PASSWORD}`
```

Problems:

- Secret material is tied to user credentials and runtime configuration strings.
- It is brittle.
- It is an unnecessary downgrade from requiring a proper signing secret.

### 12. “Clear all data” overpromises and does not actually clear httpOnly session cookies

Files:

- `app/settings/page.tsx:201-209`
- `lib/store/settings-store.ts:331-347`
- `lib/server/auth.ts:317-334`

Dialog claim:

- “删除所有设置、历史记录、Cookie 和缓存”

Reality:

- The client removes `localStorage`, some caches, and script-readable cookies.
- The auth session cookie is `httpOnly`, so `document.cookie` cannot reliably clear it.
- There is no call to `/api/auth/session` `DELETE` in the reset flow.

This is a user-facing correctness bug, not just wording.

### 13. TV detection can misclassify normal desktops as TV devices

File:

- `lib/hooks/useTVDetection.ts:38-45`

Problem:

- Fallback heuristic is just:
  - width >= 1280
  - no touch
  - DPR <= 1.5

That matches plenty of desktops, kiosks, external monitors, and cheap laptops.

### 14. Android TV wrapper has permissive WebView security settings

Files:

- `android-tv/app/src/main/AndroidManifest.xml:24`
- `android-tv/app/src/main/java/com/kvideo/tv/MainActivity.kt:96-104`
- `android-tv/app/src/main/java/com/kvideo/tv/MainActivity.kt:142`

Observed:

- `android:usesCleartextTraffic="true"`
- `mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW`
- JS enabled
- `addJavascriptInterface(AndroidPlayerBridge(), "KVideoAndroid")`

For a wrapper that loads a user-configurable remote URL, this is a large attack surface.

### 15. Apple TV support is a code snippet, not a complete project

Files found under `apple-tv/`:

- `apple-tv/KVideoTV/KVideoTV/ContentView.swift`
- `apple-tv/KVideoTV/KVideoTV/KVideoTVApp.swift`
- `apple-tv/README.md`

There is no `.xcodeproj`, no workspace, no build settings bundle, no test target. The repo does not contain a buildable Apple TV app. The README is honest that you must create a new Xcode project manually, but this still means “Apple TV app support” is partial, not turnkey.

### 16. All movie cards eagerly load images and bypass optimization

File:

- `components/home/MovieCard.tsx:52-60`

Problem:

- Every card uses `loading="eager"`
- Every card uses `unoptimized`

That is bad for mobile bandwidth, initial render cost, and scroll smoothness, especially on content-heavy pages.

### 17. Real-time latency pinging on the homepage is wired incorrectly

Files:

- `app/page.tsx:27-31`
- `lib/hooks/useLatencyPing.ts:53-59`
- `app/api/ping/route.ts:19-24`

Problem:

- The homepage maps `availableSources` into `{ id, baseUrl: id }`.
- `useLatencyPing` sends `baseUrl` to `/api/ping`.
- `/api/ping` requires a valid URL.

So the latency system is trying to ping source IDs, not actual source URLs. That means homepage latency badges are either wrong, absent, or silently degraded.

## Maintainability / “Shit-Mountain” Findings

### 18. The repo fails its own 150-line hard rule in 74 non-generated files

Contribution rule:

- `CONTRIBUTING.md:119-127`
- `CONTRIBUTING.md:661-666`

Measured result:

- 74 files over 150 lines, excluding `node_modules`, `.next`, `.git`, `.vercel`, images, and markdown

Worst offenders:

| File | Lines |
| --- | ---: |
| `components/iptv/IPTVPlayer.tsx` | 1062 |
| `components/settings/AccountSettings.tsx` | 713 |
| `components/player/EpisodeList.tsx` | 657 |
| `components/player/desktop/DesktopMoreMenu.tsx` | 655 |
| `lib/server/auth.ts` | 654 |
| `app/player/page.tsx` | 581 |
| `components/player/hooks/desktop/useFullscreenControls.ts` | 478 |
| `components/player/DesktopVideoPlayer.tsx` | 456 |
| `app/styles/video-player.css` | 437 |
| `lib/utils/m3u-parser.ts` | 431 |

This is not a minor drift. The project has simply stopped obeying its own hard rule.

### 19. Lint is badly broken

Observed:

- `npm run lint` -> exit code `1`
- `225 problems`
- `153 errors`
- `72 warnings`

Representative categories:

- `no-explicit-any`
- `react-hooks/set-state-in-effect`
- `ban-ts-comment`
- `prefer-const`
- `no-require-imports`
- `no-img-element`
- missing deps / React compiler warnings

Examples from the lint run:

- `components/ThemeProvider.tsx`
- `components/home/PopularFeatures.tsx`
- `lib/hooks/useTVDetection.ts`
- `lib/hooks/useSourceBadges.ts`
- `lib/hooks/useTypeBadges.ts`
- `lib/store/settings-store.ts`
- `app/api/search-parallel/route.ts`

### 20. Type discipline is weak

Measured:

- `111` occurrences of `any`
- `3` occurrences of `@ts-ignore`
- `3` occurrences of `eslint-disable`

That directly violates the contribution guide’s stated type-safety direction.

### 21. Design system rules are not consistently followed

Contribution rule:

- `CONTRIBUTING.md:710-718`

Measured violations:

- `components/iptv/IPTVPlayer.tsx:628`
- `components/iptv/IPTVPlayer.tsx:678`
- `components/iptv/IPTVPlayer.tsx:818`
- `components/iptv/IPTVPlayer.tsx:825`
- `components/iptv/IPTVPlayer.tsx:999`
- `components/settings/ExportModal.tsx:74`
- `components/settings/ExportModal.tsx:95`

These use `rounded-lg` or custom `rounded-[0.6rem]` even though the guide says only `rounded-2xl` and `rounded-full` are allowed.

### 22. Test coverage is shallow relative to the claimed feature set

Observed test files:

- `tests/android-pip-utils.test.ts`
- `tests/auth.test.ts`
- `tests/player-source-list.test.ts`
- `tests/resolution-probe-utils.test.ts`

What is missing:

- No UI/e2e tests
- No route integration tests
- No proxy/auth abuse tests
- No settings-page tests
- No IPTV parsing/player integration tests
- No service worker/PWA tests
- No Android wrapper tests beyond utility helpers
- No Apple TV tests

For a repo claiming web, mobile, TV, PWA, auth, sync, and multiple streaming surfaces, this is thin.

## Docs / Process Mismatches

### 23. Docs claim GitHub Actions automatically run checks, but there is no CI for lint/test/build

Files:

- `CONTRIBUTING.md:683-699`
- `.github/workflows/android-tv-apk.yml`
- `.github/workflows/Github_Upstream_Sync.yml`

Observed workflows:

- `android-tv-apk.yml`
- `Github_Upstream_Sync.yml`

Missing:

- No lint workflow
- No test workflow
- No build workflow
- No PR validation workflow

The contribution guide promises automatic checks. The repo does not provide them.

### 24. README claims Docker images are auto-built and published on every push to `main`, but no such workflow exists

Files:

- `README.md:971`
- `.github/workflows/*`

This is false as the repo currently stands.

### 25. Docker Compose file uses obsolete `version`

File:

- `docker-compose.yml:1`

Observed output from `docker compose config`:

```text
the attribute `version` is obsolete, it will be ignored
```

### 26. Cloudflare Pages build path uses deprecated tooling

Files:

- `package.json:11`
- `package.json:28`

Observed during Docker dependency install:

```text
@cloudflare/next-on-pages@1.13.16: Please use the OpenNext adapter instead
```

That does not mean immediate breakage, but it is maintenance debt.

## UI / UX / Animation Findings

## Screenshots

Desktop homepage:

![Desktop homepage](./audit-artifacts/home-desktop.png)

Mobile homepage:

![Mobile homepage](./audit-artifacts/home-mobile.png)

Desktop settings:

![Desktop settings](./audit-artifacts/settings-desktop.png)

Desktop IPTV self-hosted empty state:

![Desktop IPTV](./audit-artifacts/iptv-desktop-selfhosted.png)

Android TV first-run setup:

![Android TV setup](./audit-artifacts/android-tv-setup.png)

Android TV running local KVideo instance through the wrapper:

![Android TV loaded](./audit-artifacts/android-tv-loaded.png)

Android phone emulator running the same APK:

![Android phone loaded](./audit-artifacts/android-phone-loaded.png)

### 27. Mobile homepage wastes too much above-the-fold space

Evidence:

- `audit-artifacts/home-mobile.png`

Observed:

- Large header/search chrome consumes most of the first screen.
- Only two cards are visible above the fold.
- The page feels sparse instead of dense.

Code contributing to this:

- `app/page.tsx:43-58` separates navbar and search form, stacking vertical chrome.
- `components/home/PopularFeatures.tsx:98-123` uses a fixed `w-80` toggle block.
- `components/home/MovieGrid.tsx:40` uses only two columns on mobile.

This is not a fatal bug, but it contradicts the “移动优先” / “完美支持移动设备” claim in the README.

### 28. Motion system is not reduced-motion-aware in any serious way

Observed grep result:

- Only `app/scroll-optimization.css` references `prefers-reduced-motion`

But the app uses motion heavily:

- hover scale
- jiggle
- shake
- shimmer
- pulse
- fade/zoom/slide transitions
- view transitions

There is no broad reduced-motion strategy. That is an accessibility gap.

### 29. The settings surface is visually coherent but operationally overloaded

Evidence:

- `audit-artifacts/settings-desktop.png`

Observed:

- The page is one very long control stack.
- Many advanced settings are mixed with account/security settings.
- The “clear all data” action is near the bottom of a long form, which increases the chance of accidental destructive interaction.

This is not visually broken, but the information architecture is heavy.

### 30. IPTV empty state is visually clean but functionally barren

Evidence:

- `audit-artifacts/iptv-desktop-selfhosted.png`

Observed:

- Fresh self-hosted state shows no channels and requires manual source management.
- That is expected from the repo policy of shipping with no built-in sources, but it means the route looks “implemented” while actually being inert until configured.

This is acceptable if documented clearly. The docs do mention no built-in sources, so this is not a false claim, just a usability reality.

### 31. Android TV first-run setup is TV-hostile and unnecessarily manual

Evidence:

- `audit-artifacts/android-tv-setup.png`

Observed:

- First launch drops the user into a raw URL-entry form.
- The on-screen keyboard obscures the action row while the URL field is focused.
- Completing setup with a remote means typing a full deployment URL by hand unless the APK was prebuilt with `-PkvideoUrl`.

This is workable for a developer, not polished for an actual living-room setup flow.

### 32. The APK advertises itself as a normal Android launcher app and looks wrong on phones

Files:

- `android-tv/app/src/main/AndroidManifest.xml:26-36`

Evidence:

- `audit-artifacts/android-phone-loaded.png`

Observed:

- The manifest exposes both `LEANBACK_LAUNCHER` and standard `LAUNCHER`.
- The activity is hard-locked to landscape.
- On the phone emulator, the result is a TV-oriented landscape shell with black guttering and a clearly non-touch-native layout.

If the package is not meant for phones/tablets, the standard launcher entry should not exist. Right now the app is claiming broader Android support than it actually has.

### 33. Android lint is not clean even though the Gradle build passes

Observed:

- `./gradlew --no-daemon assembleDebug assembleRelease lint test` -> `BUILD SUCCESSFUL`
- `app/build/reports/lint-results-debug.html` generated successfully
- Lint reported `0 errors, 13 warnings`

Representative warnings:

- `ScrollViewSize` in `activity_main.xml`
- `Overdraw` in `activity_main.xml`
- `UselessParent` in `activity_main.xml`
- `ButtonStyle` on the setup action buttons
- `IconLauncherShape` on the launcher assets
- outdated `androidx.core`, `androidx.activity`, and `androidx.webkit`

This is not catastrophic, but it does show the native wrapper is not actually polished just because it builds.

### 34. The Apple TV README describes a `WKWebView` approach that does not survive contact with the toolchain

Files:

- `apple-tv/README.md:1-38`
- `apple-tv/KVideoTV/KVideoTV/ContentView.swift:1-45`

Observed locally:

- There is no `.xcodeproj` in the repo, so `xcodebuild` cannot build anything directly.
- `xcrun --sdk appletvsimulator swiftc -typecheck ...` fails with `no such module 'WebKit'`.
- The tvOS simulator SDK on this machine does not contain `WebKit.framework`.

External platform guidance:

- Apple’s Human Interface Guidelines page for web views states that web views are “Not supported in tvOS or watchOS”: <https://developer.apple.com/design/human-interface-guidelines/web-views>

That means the Apple TV section is not merely incomplete. The current README is describing a wrapper strategy that does not match the local tvOS SDK reality and appears fundamentally invalid as written.

## Platform / Build Results

### Web app

- `npm test` -> passed
- `npm run lint` -> failed badly
- `npm run build` -> passed with Upstash warnings
- `npm run pages:build` -> passed
- `npm start` -> serves locally, but warns the start command is wrong for standalone output

### Docker

- `docker compose config` -> parsed, but warned about obsolete `version`
- `docker build -t kvideo-audit .` -> passed
- Docker build also surfaced 26 dependency vulnerabilities during install

### Android TV

- Java 17 and the Android SDK were available after exporting:

```bash
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools
```

- `./gradlew --no-daemon assembleDebug assembleRelease lint test` -> passed
- Output artifacts produced:
  - `android-tv/app/build/outputs/apk/debug/app-debug.apk` (`2.2M`)
  - `android-tv/app/build/outputs/apk/release/app-release-unsigned.apk` (`227K`)
  - `android-tv/app/build/outputs/mapping/release/mapping.txt`
  - `android-tv/app/build/reports/lint-results-debug.html`
- Gradle emitted an SDK-tooling mismatch warning:

```text
This version only understands SDK XML versions up to 3 but an SDK XML file of version 4 was encountered.
```

- That warning did not block the build.
- The debug APK installed successfully on the existing `kvideo-tv` emulator.
- After rebuilding with `-PkvideoUrl=http://10.0.2.2:3000`, the APK successfully loaded the local KVideo instance through the WebView wrapper.

### Android phone / non-TV Android

- The same APK also installs on the existing `kvideo-phone` emulator because the manifest includes a standard launcher entry.
- Runtime behavior on phone is visibly wrong: forced landscape, TV-oriented chrome, and black guttering on the left edge.
- This is not a build failure. It is a product-definition failure.

### Apple TV

- Xcode 26.4 and the tvOS/tvOS Simulator SDKs are installed on this machine.
- The repo still contains no runnable project bundle:
  - no `.xcodeproj`
  - no `.xcworkspace`
  - no `project.pbxproj`
- Attempting to build the implied project path fails because the project file does not exist.
- Raw typecheck against the provided Swift files fails:

```text
ContentView.swift:2:8: error: no such module 'WebKit'
```

- The local AppleTVOS SDK and AppleTVSimulator SDK do not contain `WebKit.framework`.
- Based on both the toolchain result and Apple’s platform guidance, the current Apple TV instructions are not a working repo feature path.

## Additional Notes

### `/api/proxy` is publicly abusable even when auth is off

Because `/api/proxy` is not gated and returns `Access-Control-Allow-Origin: *`, this service can be abused as a public relay. Even if browsers do not send credentials cross-site by default, the endpoint is still a free server-side fetch surface and still leaks cookies when called by the app or a same-origin user session.

### Service worker registration is basically cosmetic

`components/ServiceWorkerRegister.tsx` registers `/sw.js`, but `public/sw.js` does not implement any meaningful caching strategy. So PWA support is mostly installability plus config sync, not offline resilience.

### Third-party script loading is too trusting

Files:

- `app/layout.tsx:24-26`
- `app/layout.tsx:112-116`
- `components/VideoTogetherController.tsx:131-136`

The default VideoTogether script URL uses `@latest`, and the script is injected dynamically. That is supply-chain risk and version drift by design.

## Recommended Fix Order

1. Kill the proxy cookie leak immediately.
2. Remove global TLS disable.
3. Add strict allowlists / SSRF protection to all fetcher endpoints.
4. Add auth throttling.
5. Fix the broken process/docs mismatches:
   - real CI
   - correct `start` script / docs
   - remove false PWA and Docker workflow claims
   - make Redis degradation actually silent
6. Upgrade vulnerable dependencies, especially `next`.
7. Start paying down the 74 overlong files and 225 lint problems.
8. Add real integration/e2e coverage around auth, proxying, player flows, settings, and IPTV.

## Bottom Line

This project is not a complete disaster, but it is absolutely not “clean,” “fully verified,” or “following its own standards.”

The codebase currently has:

- one confirmed critical credential-leak vulnerability
- several open relay / SSRF surfaces
- a global TLS-verification disable
- broken lint hygiene
- contribution-rule drift
- doc/process claims that the repo does not back up

The fastest way to improve trustworthiness is not another feature. It is deleting unsafe proxy behavior, restoring basic security guarantees, and making the docs match reality.
