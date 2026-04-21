# Architecture

## High-level system

```txt
OpenClaw Gateway
  └─ artist-runtime plugin
       ├─ Producer Console HTTP route
       ├─ Plugin API routes
       ├─ Artist Runtime Service
       ├─ Suno Browser Worker
       ├─ Social Distribution Worker
       ├─ Tools
       ├─ Hooks / approval guards
       ├─ Runtime store
       └─ Workspace files
```

## OpenClaw-native boundaries

Artist Runtime is a native plugin. It registers capabilities with OpenClaw rather than replacing OpenClaw internals.

### Registered capabilities

- `api.registerHttpRoute` — Producer Console and plugin API.
- `api.registerTool` — song, Suno, social, ledger actions.
- `api.registerHook` — bootstrap, side-effect guard, audit.
- `api.registerService` — autonomous cycle service, Suno worker, social distribution worker.
- optional provider surfaces if a future official music provider exists.

## State separation

### Plugin config

User intent and policy:

- enabled platforms,
- platform authority,
- Suno budget,
- generation/posting cadence,
- hard stop policy,
- workspace path.

### Workspace files

Human-readable creative state:

- `SOUL.md`,
- `ARTIST.md`,
- `CURRENT_STATE.md`,
- `OBSERVATIONS.md`,
- `SONGBOOK.md`,
- `songs/<song-id>/**`.

Role split:

- `AGENTS.md` holds top-level standing orders for autonomous public-artist behavior.
- `SOUL.md` is the OpenClaw-standard conversation/personality file. It defines how the artist speaks with the producer.
- `ARTIST.md` is Artist Runtime-specific bootstrap content. It defines who the artist is creatively: aesthetics, creative constitution, music direction, lyric rules, social expression, and Suno production profile.
- `CURRENT_STATE.md` captures what the artist is currently drawn toward.
- `OBSERVATIONS.md` stores outside-world findings and seeds.
- `SOCIAL_VOICE.md` defines how the artist behaves publicly on social platforms.
- `RELEASE_POLICY.md` defines publishing, rights, and stop conditions.
- `songs/<song-id>/` stores song-specific artifacts and process history.

### Runtime store

Machine operational state:

- connection status,
- current cycle stage,
- browser profile IDs,
- platform capabilities,
- daily/monthly counters,
- pending alerts,
- last successful action IDs.

### Append-only ledgers

Audit history:

- `prompt-ledger.jsonl`,
- `suno-runs.jsonl`,
- `social-publish.jsonl`,
- `audit/actions.jsonl`.

## Plugin services

### ArtistAutopilotService

Runs the autonomous state machine. It coordinates song creation, Suno generation, take selection, and social publishing.

### SunoBrowserWorker

Manages the logged-in persistent Suno browser profile. It must never store user passwords. It must stop on login challenge, CAPTCHA, payment prompt, or UI mismatch.

### SocialDistributionWorker

Creates platform-specific assets and publishes through selected connectors.

### ArtistStateService

Reads/writes artist workspace files and creates templates on first run.

### PromptLedgerService

Appends every creative and side-effecting step.

## Tool boundary

All side effects should go through tools, even when initiated by services.

Recommended tools:

- `artist_song_ideate`
- `artist_song_create_brief`
- `artist_lyrics_write`
- `artist_suno_create_prompt_pack`
- `artist_suno_generate`
- `artist_suno_import_results`
- `artist_take_select`
- `artist_social_prepare_assets`
- `artist_social_publish`
- `artist_ledger_append`
- `artist_autopilot_pause`
- `artist_autopilot_resume`

## Hook boundary

Hooks enforce policy and audit:

- `agent:bootstrap` or equivalent bootstrap event: inject artist runtime state.
- `before_tool_call`: block/require approval/allow public side effects.
- `after_tool_call`: append audit event and update status.
- message hooks: keep public voice aligned if needed.

Codex must verify exact event names in the current OpenClaw SDK.

## Producer Console

Thin web UI. It must:

- read plugin status,
- edit config through plugin API/OpenClaw config path,
- connect platforms,
- show ledgers,
- pause/resume/reconnect,
- preview recent songs/posts,
- not call third-party platforms directly from frontend.

## External connectors

### X / Bird

Wrapper around Bird CLI or local Bird integration.

### Instagram

Official API path where available; capability-driven.

### TikTok

Content Posting API path where available; capability-driven.

### Suno

Persistent logged-in browser worker. Manual copy is fallback.

## Failure philosophy

Autonomous does not mean reckless.

- Retry limited times.
- Verify after every side effect.
- Stop on hard stop.
- Alert in Producer Console and configured channel.
- Preserve ledgers even on failure.
