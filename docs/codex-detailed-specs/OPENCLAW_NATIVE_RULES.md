# OpenClaw-native Rules

## Why this matters

The plugin should survive OpenClaw updates. Therefore it must stay on public plugin contracts and avoid internal shortcuts.

## Rules

1. No OpenClaw fork.
2. No `openclaw/src/*` imports.
3. No bundled plugin private helper imports.
4. No deprecated `openclaw/plugin-sdk` root imports unless current docs explicitly require them.
5. Use focused SDK subpaths after checking the current SDK.
6. Every user-facing config key belongs under `plugins.entries.artist-runtime.config`.
7. Declare config schema and UI hints in `openclaw.plugin.json`.
8. Producer Console uses Gateway-auth plugin HTTP routes.
9. Public side effects go through tools.
10. Tool side effects go through policy guards and audit logging.
11. Platform-specific integration code stays in connectors.
12. Suno-specific prompting stays in `packages/suno-production`.
13. Scheduled work should use OpenClaw Cron/Heartbeat/Tasks where possible. If a registered service loops internally, it must be inspectable, configurable, and pausable.
14. Do not create a hidden second agent loop.

## Compatibility procedure

At the start of implementation:

- Check current OpenClaw docs and local package exports.
- Confirm SDK import paths.
- Confirm hook event names and decision semantics.
- Confirm runtime store API.
- Confirm HTTP route handler shape.
- Update scaffold imports and stubs.
- Add comments for any temporary compatibility shim.

## Upgrade procedure

Before upgrading OpenClaw:

1. Run unit tests.
2. Run connector contract tests with mock providers.
3. Run Suno worker in dry-run mode.
4. Run Producer Console smoke test.
5. Verify config schema migration.
6. Verify ledgers remain readable.