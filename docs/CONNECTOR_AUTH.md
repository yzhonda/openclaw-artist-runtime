# Connector Auth Guide

This document is the operator-facing reference for connector credential setup,
refresh, and health checks.

Use it together with:

- `CAPABILITIES.md` for connector scope and fail-closed behavior
- `SECURITY.md` for secret handling requirements
- `PRIVACY.md` for local-only credential storage boundaries
- `PUBLISHING.md` for release/package checklist items
- `docs/GATEWAY_AUTH.md` for the HTTP/gateway boundary around these connector checks
- `docs/API_ROUTES.md` for the plugin HTTP surface
- `docs/SUNO_BROWSER_DRIVER.md` for the separate Suno browser-profile lane

## Shared rules

- Do not paste secrets into Prompt Ledgers, audit logs, workspace files, package
  artifacts, screenshots, or repository docs.
- Check connector state from Producer Console `Platforms` and `Status` before
  retrying any live distribution action.
- Use `POST /plugins/artist-runtime/api/platforms/{id}/test` for connector health
  checks (`x`, `instagram`, `tiktok`).
- Keep connector credentials local to the operator machine. CI, packaging, and
  tarball verification should run without bundling these values.

### Operator-only credential notes (`.local/social-credentials.env`)

- An optional reminder file may live at `.local/social-credentials.env`. It is
  ignored by the top-level `.gitignore` and should be created with mode `0600`.
- The file is **not** auto-loaded by the runtime. Connectors read their settings
  from process environment variables only. To apply locally-stored values:

  ```sh
  set -a; . ./.local/social-credentials.env; set +a
  scripts/openclaw-local-gateway start
  ```

- Never paste file contents into logs, PR descriptions, screenshots, or chat
  transcripts.
- A raw password alone does **not** satisfy any connector. Each platform below
  still requires its own session or token.

## X (Bird)

### Contract

- Requires the `bird` CLI to be installed and available on `PATH`.
- Auth is expected to live in Bird's own local cookie/token store.
- The plugin probes Bird with `bird --help` and `bird whoami --plain`.

### Refresh

1. Re-authenticate Bird so its local session store is current. Bird drives the
   account from its configured browser profile (e.g. a dedicated Firefox
   profile); the operator must sign in there directly — runtime cannot script
   that login.
2. Confirm `bird whoami --plain` returns the expected `@handle` outside the
   plugin.
3. Re-run [`POST /plugins/artist-runtime/api/platforms/x/test`](./API_ROUTES.md#post-apiplatformsxtest).
4. If the route still returns `bird_cli_not_installed`, `bird_auth_expired`, or
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
- Round 42 adds a Graph API publish skeleton behind the same env contract. The
  runtime now models these three stages, still fail-closed:
  1. `GET /me/accounts`
  2. `POST /{instagram_business_account_id}/media`
  3. `POST /{instagram_business_account_id}/media_publish`
- Required Meta scopes for the eventual live lane:
  - `pages_show_list`
  - `instagram_basic`
  - `instagram_content_publish`

### Refresh

1. Obtain an Instagram Graph API access token via Meta for Developers
   (requires an Instagram Business/Creator account linked to a Facebook Page
   and a Meta app). A raw login password is **not** accepted.
2. Confirm the Facebook Page is linked to the intended Instagram Business or
   Creator account, because the runtime resolves the Instagram business id from
   the `GET /me/accounts` response.
3. Keep the token in `OPENCLAW_INSTAGRAM_AUTH` or
   `OPENCLAW_INSTAGRAM_ACCESS_TOKEN`.
4. Reload the shell/session that launches OpenClaw so the environment is current.
5. Re-run [`POST /plugins/artist-runtime/api/platforms/instagram/test`](./API_ROUTES.md#post-apiplatformsinstagramtest).

### Dry-run behavior

- Instagram now runs the Graph API skeleton in dry-run only: the runtime is
  wired for the Graph account lookup, media container, and publish-stage fetch
  sequence, but this round still returns `dry-run blocks publish`.
- The upper social distribution pipeline now adds a second hold: if
  `distribution.enabled` is off or the target platform toggle is off, the
  publish request is forced back into dry-run before the connector publish path
  is reached.
- Non-dry-run publish attempts are rejected with `requires_explicit_live_go`
  even when auth is configured. Live posting remains outside the current lane.

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
