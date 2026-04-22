# Privacy

## Local data stored

Artist Runtime stores creative and operational data locally by default:

- `ARTIST.md` and artist state files;
- song briefs, lyrics, YAML lyrics, Style, Exclude, Suno payloads;
- prompt-ledger JSONL files;
- audit logs;
- Suno run URLs and take notes;
- social post drafts/results;
- connector status metadata.

## Data sent to external services

Depending on enabled platforms, the plugin sends:

- Suno prompt payloads to Suno;
- posts/media to X, Instagram, or TikTok;
- OAuth authorization requests to Instagram/TikTok;
- Bird commands to local Bird CLI for X.

Connector credential contracts are local-only:

- `OPENCLAW_INSTAGRAM_AUTH` / `OPENCLAW_INSTAGRAM_ACCESS_TOKEN` are read from the
  local shell environment when Instagram capability checks run.
- `OPENCLAW_TIKTOK_AUTH` / `OPENCLAW_TIKTOK_ACCESS_TOKEN` are read from the
  local shell environment when TikTok capability checks run.
- These environment variables are not copied into Prompt Ledgers, audit logs, or
  creative workspace files by design.
- X/Bird authentication stays inside the `bird` CLI's own cookie/token store;
  the plugin invokes the CLI but does not export, rewrite, or persist those
  cookies itself.

## Data not intentionally stored

- Passwords.
- Browser cookies in creative Markdown files.
- OAuth refresh tokens in Prompt Ledger or audit logs.
- Payment information.
- Connector environment-variable secrets in workspace files or package artifacts.

## Deletion

The implementation must provide documented deletion paths for:

- workspace creative files;
- Prompt Ledgers;
- audit logs;
- runtime connector state;
- dedicated browser profiles.

## Producer control

The producer must be able to pause autopilot and disable distribution from Producer Console without deleting the artist's creative archive.
