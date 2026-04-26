# Security Policy

## Supported Versions

Security fixes are applied to the current `main` branch only.

| Version | Supported |
| --- | --- |
| `main` | Yes |
| Historical releases / stale forks | No |

## Reporting

For sensitive vulnerabilities, use GitHub Security Advisories / private reporting on the repository instead of opening a public issue first.

For non-sensitive hardening bugs or follow-up cleanup, open a normal issue with:

- affected route or component
- exact deployment mode
- reproduction steps
- expected behavior
- actual behavior

## Current Security Posture

This repository intentionally hardens several surfaces that were previously too permissive:

- outbound requests are restricted to `http` / `https`
- loopback, private, link-local, metadata, and reserved targets are blocked by default
- redirects are revalidated before follow
- raw relay routes are not public by default
- relay forwarding excludes cookies and spoofed forwarding headers
- auth-enabled deployments require `AUTH_SECRET`
- login attempts are throttled and may return `429`

## Deployment Guidance

Use self-hosted Node.js or Docker when you need the full relay / IPTV surface.

Cloudflare Workers via OpenNext is supported, but this codebase intentionally applies managed-platform restrictions there. Do not assume parity with unrestricted self-hosted Node deployments.
