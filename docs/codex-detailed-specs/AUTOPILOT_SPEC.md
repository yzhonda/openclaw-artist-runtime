# Autopilot Spec

## Purpose

Autopilot makes the artist act without the user watching the Mac.

## State machine

```txt
IDLE
  -> OBSERVING
  -> IDEA_FOUND
  -> SONG_BRIEF_CREATED
  -> LYRICS_CREATED
  -> SUNO_PROMPT_PACK_CREATED
  -> SUNO_GENERATION_STARTED
  -> SUNO_RESULTS_IMPORTED
  -> TAKES_EVALUATED
  -> BEST_TAKE_SELECTED
  -> SOCIAL_ASSETS_CREATED
  -> SOCIAL_PUBLISHED
  -> LEDGER_FINALIZED
  -> IDLE
```

## Cycle trigger

Possible triggers:

- scheduled cron,
- heartbeat due check,
- plugin service timer,
- manual “run cycle now”,
- new observation or producer note.

Prefer OpenClaw Cron/Heartbeat where possible. If a plugin service uses its own timer, it must be:

- visible in Console,
- configurable,
- pausable,
- idempotent by run ID,
- audited.

## Policy checks before each phase

- autopilot enabled?
- artist not paused?
- within quiet windows?
- within Suno budget?
- within social posting caps?
- platform connected and capable?
- no hard stop active?
- no unresolved high-risk alert?

## Default cadence

```json
{
  "autopilot": {
    "enabled": true,
    "cycleCadence": "daily",
    "preferredWorkWindows": ["09:00-12:00", "20:00-24:00"],
    "quietWindows": ["01:00-07:00"],
    "maxSongsPerWeek": 3
  }
}
```

## Verification

Every side effect follows:

1. Execute.
2. Verify.
3. Log.
4. Report only if policy says to report.

## Hard stops

Autopilot must pause the relevant worker and create an alert on:

- login expired,
- CAPTCHA,
- payment/credit prompt,
- browser UI mismatch,
- repeated failed generation,
- repeated failed posting,
- connector authentication error,
- content risk high,
- platform capability changed,
- file ledger write failure.

## Reporting

Do not spam. Use dashboard and daily digest.

Immediate alerts only for:

- hard stops,
- successful new song cycle if configured,
- public posting failure,
- budget exhaustion,
- high audience reaction spike.