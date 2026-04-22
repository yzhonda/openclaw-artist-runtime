# Gateway Auth Boundary

This document explains what the current `Auth: plugin` entries in
`docs/API_ROUTES.md` mean in practice for operators.

## Current auth model

- All `/plugins/artist-runtime/api/*` routes currently inherit `auth: "plugin"`
  from `safeRegisterRoute()`.
- In this package, that means access control is delegated to the OpenClaw Gateway
  plugin boundary.
- The plugin itself does **not** add per-route bearer-token, session-cookie, or
  custom API-key checks inside `src/routes/index.ts`.

## What this means for operators

If an untrusted client can reach the OpenClaw Gateway endpoint that serves this
plugin, that client can reach the same route surface the Producer Console uses.
That includes:

- reading autopilot, platform, audit, recovery, and Suno status surfaces
- writing config overrides
- pausing/resuming autopilot
- triggering `run-cycle`
- probing platform connector state
- using dry-run helper actions such as simulate-reply

Dry-run does not remove this reachability. It only limits external side effects.

## Dry-run does not imply auth

`autopilot.dryRun: true` means public side effects should stay simulated or fail
closed. It does **not** mean the HTTP surface becomes private or anonymous-safe.

An exposed gateway can still allow outside callers to:

- inspect current runtime state
- toggle config values
- pause or resume automation
- trigger internal dry-run flows

Do not treat dry-run mode as a substitute for network or gateway access control.

## Recommended operator boundary

1. Keep the OpenClaw Gateway bound to localhost or another trusted local-only
   interface whenever possible.
2. If remote access is required, place the gateway behind an authenticated
   reverse proxy or equivalent trusted-network control.
3. Treat connector and CLI credentials separately; see `docs/CONNECTOR_AUTH.md`
   for Bird / Instagram / TikTok credential setup and refresh.
4. Before relying on Producer Console `Platforms` or `Status`, confirm the
   gateway boundary itself is already restricted to trusted operators.

## See also

- `docs/API_ROUTES.md`
- `docs/CONNECTOR_AUTH.md`
- `SECURITY.md`
- `PUBLISHING.md`
