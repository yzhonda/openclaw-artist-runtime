# Product Spec — Artist Runtime

## One-liner

Artist Runtime turns OpenClaw into a public autonomous musician that creates songs with Suno and shares its work on selected social platforms.

## Primary user

The user is a producer. They do not manually instruct every action. They configure the artist, connect accounts, set boundaries, and occasionally inspect or steer.

## Product promise

After setup, the artist can run on a Mac without the user watching the screen. It can create music and share public outputs automatically within configured authority.

## User journey

### 1. Install plugin

The user installs/enables the OpenClaw plugin.

### 2. Open Producer Console

The plugin exposes a Gateway-authenticated web UI.

### 3. Create artist

The user defines:

- artist name,
- public identity,
- aesthetic obsessions,
- musical profile,
- social voice,
- topics to avoid,
- default language and sound.

The system creates workspace files from `workspace-template/`.

### 4. Connect accounts

The user chooses platforms:

- X — public voice, via Bird.
- Instagram — visual identity and Reels.
- TikTok — short-video discovery.
- Suno — music generation engine.

Each platform has its own connection flow and capability check.

### 5. Choose autonomy

Defaults should make the artist useful:

- Suno: autonomous generation with budget.
- X: auto daily sharing.
- Instagram: auto visual sharing if connected and capable.
- TikTok: auto clip sharing if connected and capable.
- Official releases: initially approval-gated.

### 6. Autopilot begins

The autonomous cycle runs:

```txt
observe -> ideate -> brief -> lyrics -> Suno prompt pack -> Suno create -> import takes -> evaluate -> select -> create social assets -> publish -> log
```

### 7. Producer Console is used only when needed

The producer returns to:

- review what happened,
- pause/resume,
- reconnect services,
- change cadence/budget,
- inspect prompt ledger,
- adjust artist direction.

## User-facing settings

### Platform selection

```txt
Where should this artist live?
[x] X          Words, voice, lyrics, studio notes
[x] Instagram  Visual identity, lyric cards, Reels
[x] TikTok     Short video, hooks, discovery
```

### Suno generation

```txt
How much can the artist do in Suno?
( ) Prepare prompts only
( ) Fill Suno only
(x) Create tracks automatically within budget
(x) Select best takes automatically
```

### Distribution

```txt
Daily sharing:
(x) Auto

Official releases:
(x) Ask / manual approval
```

### Budgets

- Suno generations per month.
- Max generations per day.
- Max posts per platform per day.
- Minimum time between posts.
- Quiet windows.

### Hard stops

Always user-visible, always on by default:

- login expired,
- CAPTCHA / anti-bot challenge,
- payment or credit purchase prompt,
- platform API failure,
- repeated publish failure,
- legal/rights uncertainty,
- third-party imitation / voice clone risk,
- UI changed and automation confidence is low.

## Content model

A creative item should generate multiple platform outputs:

```txt
Song: ghost station
  X: lyric fragment + studio note
  Instagram: lyric card + Reel teaser
  TikTok: 15-30s hook clip
```

## Success criteria

- The artist can complete at least one unattended cycle after setup.
- Every song has a complete prompt/run/social ledger.
- Producer Console can explain what the artist did and why.
- User can pause the entire artist in one click.
- Platform failure does not corrupt song state or ledgers.