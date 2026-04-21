# Producer Console Spec

## Role

Producer Console is the web control tower for the public artist. It is not a daily manual control panel.

## Pages

### Dashboard

Shows:

- artist status,
- autopilot status,
- current cycle stage,
- Suno connection,
- platform connections,
- monthly Suno budget usage,
- posts today,
- latest song,
- latest public post,
- alerts.

Actions:

- Pause artist,
- Resume artist,
- Quiet mode,
- Run one cycle now,
- Open current song,
- View ledgers.

### Platforms

Select and connect:

- X via Bird,
- Instagram,
- TikTok.

Each platform card displays:

- enabled/disabled,
- connection status,
- account handle,
- capability check,
- daily quota/counters,
- authority level,
- last publish.

### Music / Suno

Shows:

- Suno connection mode,
- browser worker status,
- logged-in state,
- current generation authority,
- monthly generation budget,
- hard stop status,
- recent runs,
- current prompt pack.

Actions:

- Connect Suno,
- Reconnect,
- Pause Suno,
- Run prompt pack dry-run,
- Start generation cycle,
- View run ledger.

### Content Pipeline

Shows how a song becomes social assets:

```txt
Song -> X post -> Instagram lyric card/Reel -> TikTok hook clip
```

For each asset:

- source song/take,
- caption/text,
- media file,
- platform status,
- policy decision,
- publish URL.

### Songs

Song list with statuses:

- idea,
- brief,
- lyrics,
- prompt pack ready,
- Suno running,
- takes imported,
- selected,
- mastered,
- shared.

### Song Detail

- Why this song exists,
- brief,
- lyrics versions,
- Suno prompt pack,
- Suno runs/takes,
- prompt ledger,
- social assets,
- public links.

### Prompt Ledger

Read-only viewer for append-only ledgers.

Filters:

- song,
- stage,
- date,
- platform,
- run ID.

### Artist Mind

Shows/editable:

- current obsessions,
- emotional weather,
- current works,
- refusals this week,
- producer notes,
- social voice.

### Settings

- artist profile path,
- workspace path,
- autopilot enabled,
- Suno authority and budgets,
- platform authority,
- cadence,
- quiet windows,
- hard stops,
- audit retention.

## API endpoints

Recommended plugin routes:

```txt
GET    /plugins/artist-runtime/api/status
GET    /plugins/artist-runtime/api/config
PATCH  /plugins/artist-runtime/api/config
POST   /plugins/artist-runtime/api/pause
POST   /plugins/artist-runtime/api/resume
POST   /plugins/artist-runtime/api/run-cycle

GET    /plugins/artist-runtime/api/platforms
POST   /plugins/artist-runtime/api/platforms/:id/connect
POST   /plugins/artist-runtime/api/platforms/:id/disconnect
POST   /plugins/artist-runtime/api/platforms/:id/test

GET    /plugins/artist-runtime/api/suno/status
POST   /plugins/artist-runtime/api/suno/connect
POST   /plugins/artist-runtime/api/suno/reconnect
POST   /plugins/artist-runtime/api/suno/generate/:songId

GET    /plugins/artist-runtime/api/songs
GET    /plugins/artist-runtime/api/songs/:songId
GET    /plugins/artist-runtime/api/songs/:songId/ledger

GET    /plugins/artist-runtime/api/alerts
POST   /plugins/artist-runtime/api/alerts/:id/ack
```

Codex must adapt handler signatures to current SDK.

## UX copy principle

Do not expose low-level terms first.

Bad:

- `heartbeatIntervalMinutes`
- `playwrightContextPath`
- `registerHttpRoute`

Good:

- “How often may the artist publish?”
- “Suno account connection”
- “Pause public activity”

## First-run setup wizard

1. Create artist.
2. Choose platforms.
3. Connect Suno.
4. Connect selected social platforms.
5. Choose budgets/cadence.
6. Confirm hard stops.
7. Run dry-run cycle.
8. Turn on autopilot.