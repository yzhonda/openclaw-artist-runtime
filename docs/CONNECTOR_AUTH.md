# Connector Auth Guide

This document is the operator-facing reference for connector credential setup,
refresh, and health checks.

Use it together with:

- `CAPABILITIES.md` for connector scope and fail-closed behavior
- `SECURITY.md` for secret handling requirements
- `PRIVACY.md` for local-only credential storage boundaries
- `PUBLISHING.md` for release/package checklist items
- `docs/API_ROUTES.md` for the plugin HTTP surface

## Shared rules

- Do not paste secrets into Prompt Ledgers, audit logs, workspace files, package
  artifacts, screenshots, or repository docs.
- Check connector state from Producer Console `Platforms` and `Status` before
  retrying any live distribution action.
- Use `POST /plugins/artist-runtime/api/platforms/{id}/test` for connector health
  checks (`x`, `instagram`, `tiktok`).
- Keep connector credentials local to the operator machine. CI, packaging, and
  tarball verification should run without bundling these values.

## X (Bird)

### Contract

- Requires the `bird` CLI to be installed and available on `PATH`.
- Auth is expected to live in Bird's own local cookie/token store.
- The plugin probes Bird with `bird --help` and `bird whoami --plain`.

### Refresh

1. Re-authenticate Bird so its local session store is current.
2. Re-run [`POST /plugins/artist-runtime/api/platforms/x/test`](./API_ROUTES.md#post-apiplatformsxtest).
3. If the route still returns `bird_cli_not_installed`, `bird_auth_expired`, or
   `bird_probe_failed`, inspect the local Bird install/session outside the plugin
   before retrying distribution.

### Dry-run behavior

- Dry-run publish/reply paths stay fail-closed and do not perform real external
  side effects.

## Instagram

### Contract

- The current connector checks one of:
  - `OPENCLAW_INSTAGRAM_AUTH`
  - `OPENCLAW_INSTAGRAM_ACCESS_TOKEN`
- If neither variable is present, the connector reports
  `instagram_auth_not_configured`.

### Refresh

1. Update `OPENCLAW_INSTAGRAM_AUTH` or `OPENCLAW_INSTAGRAM_ACCESS_TOKEN` in the
   active shell environment or launch profile.
2. Reload the shell/session that launches OpenClaw so the environment is current.
3. Re-run [`POST /plugins/artist-runtime/api/platforms/instagram/test`](./API_ROUTES.md#post-apiplatformsinstagramtest).

### Dry-run behavior

- Instagram remains a dry-run-safe skeleton today. Capability checks can report
  configured/not-configured state, but publish/reply stay fail-closed until a
  real adapter is introduced.

## TikTok

### Contract

- The current connector checks one of:
  - `OPENCLAW_TIKTOK_AUTH`
  - `OPENCLAW_TIKTOK_ACCESS_TOKEN`
- If neither variable is present, the connector reports
  `tiktok_auth_not_configured`.

### Refresh

1. Update `OPENCLAW_TIKTOK_AUTH` or `OPENCLAW_TIKTOK_ACCESS_TOKEN` in the active
   shell environment or launch profile.
2. Reload the shell/session that launches OpenClaw so the environment is current.
3. Re-run [`POST /plugins/artist-runtime/api/platforms/tiktok/test`](./API_ROUTES.md#post-apiplatformstiktoktest).

### Dry-run behavior

- TikTok remains a dry-run-safe skeleton today. Capability checks can report
  configured/not-configured state, but publish/reply stay fail-closed until a
  real adapter is introduced.
