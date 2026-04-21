# Autopilot Spec

Autopilot runs the artist's autonomous production cycle.

## Cycle

```text
Observe
  -> metabolize
  -> create song idea
  -> write brief
  -> write lyrics
  -> create Suno prompt pack
  -> generate with Suno
  -> select take
  -> create social assets
  -> publish within authority
  -> log everything
```

## Requirements

- Enforce dry-run.
- Enforce monthly and daily Suno budgets.
- Enforce per-platform post limits.
- Enforce min time between posts/generations.
- Stop on hard-stop states.
- Emit digest/alerts according to config.

## States

`idle`, `planning`, `prompt_pack`, `suno_generation`, `take_selection`, `asset_generation`, `publishing`, `completed`, `paused`, `failed_closed`.
