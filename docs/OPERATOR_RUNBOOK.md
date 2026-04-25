# Operator runbook

This runbook covers operator-run maintenance helpers. The scripts are manual
tools: they do not install cron jobs, systemd timers, launch agents, or hidden
background workers.

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
