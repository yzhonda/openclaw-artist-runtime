# Operator runbook

This runbook covers operator-run maintenance helpers. The scripts are manual
tools: they do not install cron jobs, systemd timers, launch agents, or hidden
background workers.

See also: [OPERATOR_QUICKSTART.md](OPERATOR_QUICKSTART.md),
[TROUBLESHOOTING.md](TROUBLESHOOTING.md), [ERRORS.md](ERRORS.md), and
[RUNTIME_CLEANUP.md](RUNTIME_CLEANUP.md).

## Quick checks

Run the doctor from the package root:

```bash
scripts/openclaw-doctor.sh
```

Use JSON mode for automation that the operator controls:

```bash
scripts/openclaw-doctor.sh --json
```

The JSON shape is:

```json
{
  "checks": [
    { "name": "gateway", "status": "ok", "detail": "..." }
  ],
  "summary": { "ok": 1, "warn": 0, "fail": 0 }
}
```

Exit codes are `0` for all OK, `1` when at least one check is warning, and `2`
when at least one check fails. The doctor checks the gateway status endpoint,
X auth probe state from `runtime/config-overrides.json`, Suno budget state,
runtime disk usage, and the local Suno browser profile age.

Useful environment knobs:

- `OPENCLAW_GATEWAY_PORT` or `OPENCLAW_LOCAL_GATEWAY_PORT`: gateway port, default `43134`
- `OPENCLAW_DOCTOR_PROFILE_STALE_DAYS`: Suno profile stale threshold, default `30`
- `OPENCLAW_DOCTOR_DISK_WARN_GB`: runtime disk warning threshold, default `10`
- `OPENCLAW_DOCTOR_DISK_FAIL_GB`: runtime disk failure threshold, default `50`

## Autopilot mode

Archive-only mode is retired. The package default now starts the 8-stage
autopilot pipeline in dry-run-protected mode: `autopilot.enabled=true` and
`autopilot.dryRun=true`. This lets the runtime plan, create prompt packs, and
exercise the pipeline while Suno create and social publish remain blocked by
the existing authority gates.

Obsidian importer scripts remain available only as manual CLI tools for
operator-led archive work:

```bash
node scripts/import-obsidian-artist.mjs --help
node scripts/import-obsidian-song.mjs --help
```

The autopilot service does not call those importer scripts. If the operator
needs to preserve or import older Obsidian material, run the scripts manually
before or after an autopilot cycle and keep the resulting song status under
operator review.

## Telegram opt-in

Telegram is disabled by default. With default config and no token, the runtime
starts normally and the Telegram worker performs no fetches.

To opt in, the operator must provide all three gates:

1. Set `telegram.enabled=true` in config.
2. Put `TELEGRAM_BOT_TOKEN` in `.local/social-credentials.env` or the shell
   environment.
3. Put the owner Telegram user id in `TELEGRAM_OWNER_USER_IDS`.

`scripts/openclaw-local-env.sh print` masks the token body and shows only
whether it is set. To disable Telegram again, set `telegram.enabled=false` or
remove either local environment value, then restart the Gateway process that
owns the environment.

## Runtime log rotation

`scripts/rotate-runtime-logs.sh` rotates only top-level `runtime/*.log` files.
It moves matching logs into `runtime/logs-archive/<UTC>/` and recreates an empty
log file at the original path so appenders can continue writing.

Dry-run first:

```bash
scripts/rotate-runtime-logs.sh --dry-run
```

Then run manually when the candidate list is expected:

```bash
scripts/rotate-runtime-logs.sh
```

JSON mode reports the candidate paths and archive directory:

```bash
scripts/rotate-runtime-logs.sh --dry-run --json
```

Environment knobs:

- `OPENCLAW_LOG_MAX_SIZE_MB`: rotate logs larger than this size, default `100`
- `OPENCLAW_LOG_MAX_AGE_DAYS`: rotate logs older than this many days, default `14`

## Runtime state snapshots

`scripts/snapshot-runtime-state.sh` copies `runtime/state/` into
`runtime/state-snapshots/<UTC>/` and prunes snapshots older than 30 days. It
does not edit existing state files.

Dry-run:

```bash
scripts/snapshot-runtime-state.sh --dry-run
```

Create a snapshot:

```bash
scripts/snapshot-runtime-state.sh
```

JSON mode:

```bash
scripts/snapshot-runtime-state.sh --json
```

Environment knob:

- `OPENCLAW_STATE_SNAPSHOT_RETENTION_DAYS`: snapshot retention window, default `30`

## Cron examples

These examples are documentation only. The plugin does not register them for
you. If the operator wants scheduled checks, add entries manually with
`crontab -e`:

```cron
15 * * * * cd /path/to/artist-runtime && scripts/openclaw-doctor.sh --json >> runtime/doctor.jsonl 2>&1
30 2 * * * cd /path/to/artist-runtime && scripts/rotate-runtime-logs.sh --json >> runtime/log-rotation.jsonl 2>&1
45 2 * * * cd /path/to/artist-runtime && scripts/snapshot-runtime-state.sh --json >> runtime/state-snapshot.jsonl 2>&1
```

Keep cron output under `runtime/`; it is excluded from package artifacts and
public PRs.

## See also

- `docs/RUNTIME_CLEANUP.md`
- `docs/INCIDENT_RESPONSE.md`
- `docs/ERRORS.md`
- `docs/SUNO_BROWSER_DRIVER.md`
- `docs/OPERATOR_QUICKSTART.md`
- `docs/TROUBLESHOOTING.md`
