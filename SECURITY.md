# Security Policy

## Supported versions

Only the latest minor version is supported until the implementation stabilizes.

## Reporting vulnerabilities

Report security issues privately through the repository security advisory feature or a dedicated security email before public disclosure.

## Security model

Artist Runtime is powerful. It can operate logged-in browser sessions, generate music, and publish publicly.
Therefore all external side effects must pass authority checks and audit logging.

## Gateway auth boundary

The plugin route surface currently relies on the OpenClaw Gateway's plugin-level
access boundary rather than per-route auth logic inside the plugin. See
`docs/GATEWAY_AUTH.md` for the operator-facing explanation and deployment
recommendations.

## Credential handling

- Do not store Suno passwords.
- Do not store X, Instagram, TikTok passwords.
- Do not write OAuth refresh tokens, cookies, browser session headers, or API keys into Markdown ledgers.
- Store connector secrets only in OpenClaw-approved secret/runtime storage or the platform's dedicated browser profile.
- Redact secrets from logs and error messages.

### Connector secret contract

For platform-by-platform setup and refresh flow, see `docs/CONNECTOR_AUTH.md`.

- `XBirdConnector` does not read passwords from plugin config. It depends on the
  local `bird` CLI and that CLI's own authenticated cookie/token store.
- `InstagramConnector` currently checks only these environment variables:
  - `OPENCLAW_INSTAGRAM_AUTH`
  - `OPENCLAW_INSTAGRAM_ACCESS_TOKEN`
- `TikTokConnector` currently checks only these environment variables:
  - `OPENCLAW_TIKTOK_AUTH`
  - `OPENCLAW_TIKTOK_ACCESS_TOKEN`
- These values must be treated as secrets:
  - do not commit them
  - do not place them in `workspace-template/**`
  - do not echo them in shell history, screenshots, Prompt Ledger entries, audit logs, or error text
- Missing or expired connector credentials must fail closed. The plugin should
  surface a diagnostic reason rather than attempting a best-effort publish.

## Browser profile handling

The Suno Browser Worker uses a dedicated browser profile. It must not read the operator's ordinary browser profile.
It must stop on login challenge, CAPTCHA, payment prompt, or unexpected UI.

## Public side effects

Public actions include Suno generation, X posts, Instagram posts, TikTok posts, replies, quote posts, and release announcements.
All public actions require:

1. authority decision;
2. risk classification;
3. budget/cadence check;
4. audit log event;
5. Prompt Ledger link where applicable.

## Marketplace note

Because plugin marketplaces are sensitive surfaces, this package must not ask users to run arbitrary shell commands beyond standard install/build/test instructions. Avoid obfuscated scripts and lifecycle `postinstall` behavior.
