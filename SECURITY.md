# Security Policy

## Supported versions

Only the latest minor version is supported until the implementation stabilizes.

## Reporting vulnerabilities

Report security issues privately through the repository security advisory feature or a dedicated security email before public disclosure.

## Security model

Artist Runtime is powerful. It can operate logged-in browser sessions, generate music, and publish publicly.
Therefore all external side effects must pass authority checks and audit logging.

## Credential handling

- Do not store Suno passwords.
- Do not store X, Instagram, TikTok passwords.
- Do not write OAuth refresh tokens, cookies, browser session headers, or API keys into Markdown ledgers.
- Store connector secrets only in OpenClaw-approved secret/runtime storage or the platform's dedicated browser profile.
- Redact secrets from logs and error messages.

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
