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

## First-run experience: Telegram artist persona

Use this after plugin install, before turning the revived autopilot into a real
production loop. The goal is a lean first-run path where the artist identity is
created from Telegram while all external side effects remain opt-in.

1. Install and enable the plugin as usual. Keep the distributed safety defaults:
   `telegram.enabled=false`, `autopilot.dryRun=true`, and `aiReview.provider`
   left at the mock/default provider.
2. Configure Telegram as described above: create the bot with BotFather, put
   `TELEGRAM_BOT_TOKEN` and `TELEGRAM_OWNER_USER_IDS` in the local environment,
   then set `telegram.enabled=true`. Only the allowlisted owner can drive the
   setup conversation.
3. Send `/setup` to the bot. Answer the six lean ARTIST questions, review the
   preview, then send `/confirm`. This writes only the Telegram-managed
   `ARTIST.md` block and the local `runtime/persona-completed.json` marker.
4. Optional: send `/setup soul` and answer the two SOUL questions for the
   producer-facing conversational voice. `/persona show` summarizes the current
   ARTIST/SOUL fields, `/persona edit <field>` edits one managed field after a
   preview, and `/persona reset` requires `/confirm reset` before removing only
   Telegram-managed persona blocks.

After the persona is saved, start or resume autopilot in the usual staged way:
keep `autopilot.dryRun=true` for the first cycle, watch Telegram stage events,
and only consider real Suno or social side effects under their existing operator
GO rules.

Obsidian importer coexistence: `scripts/import-obsidian-artist.mjs` preserves
Telegram-managed ARTIST/SOUL marker blocks by default. Use
`--no-preserve-telegram-persona` only when the operator intentionally wants the
Obsidian import to replace the managed persona blocks.

## Persona audit & migrate (Plan v9.7)

Use this flow after importing an existing Obsidian artist file that has no
Telegram-managed markers or is missing some of the lean persona fields.

1. Send `/persona check` to see which ARTIST/SOUL fields are filled, thin, or
   missing. Custom Obsidian sections are reported separately and are not deleted.
2. If only a few fields need work, send `/persona check fill` and answer the
   chained prompts. Each field still uses preview plus `/confirm`; `/skip`
   leaves the current field unchanged and moves to the next candidate.
3. If the imported files should become marker-managed, send `/persona migrate`.
   Review the backup paths, marker sections, custom sections, and warnings.
4. Send `/confirm migrate` only after the preview is expected. The migrator
   writes backups first, inserts Telegram-managed marker blocks, preserves
   custom sections outside those blocks, and leaves songs, ledgers, budgets,
   profiles, and publish gates untouched.
5. Optional: send `/persona check suggest` for a mock-safe suggestion pass. The
   default provider is still `mock`; no external AI provider is called unless a
   future operator-selected provider is explicitly configured.

## Production Telegram command path (Plan v9.8)

Plan v9.8 wires the persona commands into OpenClaw's native plugin command
registry. This means the main OpenClaw Telegram plugin handles the bot polling
and invokes artist-runtime directly for `/persona ...` and `/setup` instead of
letting those messages fall through to the model.

1. Restart the Gateway after installing the package or rebuilding `dist/` so
   OpenClaw reloads the artist-runtime command registry.
2. Send `/persona check`. The expected response is the artist-runtime audit
   summary with filled/thin/missing fields and custom sections. It should not
   produce an OpenAI-provider error.
3. Send `/persona migrate` only when the preview is expected, then use
   `/confirm migrate` to execute. The migrator now preserves custom SOUL.md
   prose and headings outside the Telegram-managed marker block.
4. For setup/edit flows on the OpenClaw native command path, use `/answer <text>`
   for free-text wizard answers. Session control commands remain `/confirm`,
   `/cancel`, `/skip`, and `/back`.

The older artist-runtime `TelegramBotWorker` remains as a mockable service
module for tests and non-OpenClaw harnesses, but production should not start a
second Telegram long-poll worker against the same bot token. OpenClaw owns the
polling loop.

## Persona migrate with operator intent (Plan v9.9)

Use this when `/persona check` reports missing or thin fields, but the imported
Obsidian sections already contain enough direction for the artist. Add the
operator guidance directly after `/persona migrate`; the preview will keep the
normal backup and marker plan, then add draft values for the missing fields.

Examples:

```text
/persona migrate make the social voice short, unsalesy, and blunt. Use the SOUL prose for refusal style.
/persona migrate socialVoice: keep as-is, skip. Draft soul-refusal from the imported Listener section.
```

The preview includes:

- `Operator intent`, normalized to a single line so it is readable in Telegram.
- `Proposed drafts`, generated through the configured debug AI review provider.
  The distributed default remains `aiReview.provider="mock"`, which produces
  explicit placeholder drafts and performs no external model call.
- `skip per operator intent` for field-specific directives such as
  `socialVoice: keep as-is, skip`.

Send `/confirm migrate` only after the preview looks right. Confirmation writes
the proposed draft values into the Telegram-managed ARTIST/SOUL marker blocks,
creates the usual backups first, and still preserves custom imported sections
outside the managed blocks. If no intent is supplied, `/persona migrate` keeps
the older placeholder fallback behavior.

## Persona migrate field directives (Plan v9.10)

Plan v9.10 adds two operator-facing safeguards for the native Telegram command
path:

1. Gateway startup should log one registration line for each runtime slash
   command, for example `[artist-runtime] registered runtime-slash command:
   persona`.
2. If OpenClaw exposes plugin command specs during registration, startup should
   also log a snapshot like `[artist-runtime] telegram plugin command specs:
   persona,setup,... (count=7, persona=true)`.

For migration guidance, prefer explicit `field: value` lines after
`/persona migrate`. Values may span multiple lines until the next recognized
field key. Lines such as `Genre: dark folk` are treated as part of the previous
value unless the key is one of the recognized aliases below. Use `keep ...`,
`keep as-is`, `keep as is`, or `skip` to leave a field unchanged.

```text
/persona migrate obsessions: 日本社会の風刺、批評、皮肉
socialVoice: 短く、刺さるように、過剰な売り込みは避ける
soul-tone: 御大に対しては率直、ぶっきらぼう、必要なら反論
soul-refusal: できないことは「できない」と即答、言い訳しない
artistName: keep used::honda
```

| Field | Recognized aliases |
|---|---|
| `artistName` | `artistName`, `artist name`, `name` |
| `identityLine` | `identityLine`, `identity`, `manifesto` |
| `soundDna` | `soundDna`, `sound` |
| `obsessions` | `obsessions`, `themes`, `theme` |
| `lyricsRules` | `lyricsRules`, `lyrics`, `lyrics rule` |
| `socialVoice` | `socialVoice`, `social voice`, `voice` |
| `soul-tone` | `soul-tone`, `soul tone`, `conversation tone`, `tone` |
| `soul-refusal` | `soul-refusal`, `soul refusal`, `refusal style`, `refusal` |

The old mock echo wrapper is intentionally gone. If no recognized directive is
found for a missing field, the preview shows `(no value extracted; provide
directive in next /persona migrate)` instead of writing the whole operator
intent into the field.

## Persona AI auto-fill (Plan v9.11)

Plan v9.11 keeps the Telegram persona flow default-safe while reducing first-run
typing. The proposer is enabled by default and uses the configured persona AI
provider; the distributed default is the deterministic `mock` provider, so no
external model call is made unless the operator opts into a real provider later.

Journey A, fresh setup:

1. Send `/setup`.
2. Reply with a rough artist sketch, for example `和風 hip-hop で社会風刺がメインの男性アーティスト、20代`.
3. Review each proposed field with `/confirm`, or use `/answer <text>` to
   override the current field.
4. `/skip` asks for one alternative. A second `/skip` on the same field asks for
   `/confirm skip`, which stores the built-in default for that field.
5. The final `/confirm` writes ARTIST.md, SOUL.md, and the local persona
   completion marker.

Journey B, filling an imported persona:

1. Send `/persona check`.
2. If fields are thin or missing, send `/persona check fill`.
3. Review each AI draft with `/confirm`, override with `/answer <text>`, or use
   the same two-step `/skip` behavior.
4. Before the first write in a session, ARTIST.md and/or SOUL.md are backed up
   once per file. Repeated fields in the same session do not create backup spam.
5. `/persona check suggest` returns the same proposed drafts in read-only mode;
   it does not create a session and does not write files.

Historical retreat flag: before Plan v9.13, `OPENCLAW_PERSONA_PROPOSER=off`
forced the older handwritten wizard for `/setup` and `/persona check fill`.
Plan v9.13 removes that wizard implementation; the flag now only disables
persona proposer calls on any remaining proposer-backed path. It does not rename
commands or change OpenClaw permissions. Secret-like input or AI responses are
rejected for the affected field and surfaced as warnings instead of being
written to ARTIST.md or SOUL.md.

## Conversational artist and distribution polling (Plan v9.13)

Plan v9.13 changes Telegram from chained wizard prompts into producer-to-artist
conversation. The OpenClaw artist-runtime is the artist, the operator is the
producer, and Telegram is the channel between them. The artist answers as
itself, proposes ChangeSets when files should change, and waits for producer
confirmation before writing managed files.

Core journeys:

1. Persona refinement: talk to the artist with `/persona ...` or plain text.
   When a ChangeSet is proposed, use `/yes` to apply, `/no` to discard, or
   `/edit <field> <value>` to revise before applying.
2. Song discussion: use `/song <id> ...` to discuss a song. The artist can
   propose brief, lyric, note, status, or public-link changes using the same
   ChangeSet confirmation path.
3. Autonomous production: autopilot can observe, generate a theme, build a song,
   and report completed takes. `autopilot.dryRun=true` remains the protected
   default for real Suno and social side effects.
4. Distribution autoupdate: scheduled songs are polled against UnitedMasters,
   Spotify, and Apple Music/iTunes lookup. When a public DSP link appears, the
   runtime emits a distribution-change event so the artist can ask whether
   SONGBOOK should be updated.

Operational flags:

- `OPENCLAW_LEGACY_WIZARD=on`: keeps legacy command surfaces safe, but the
  removed wizard implementation is not revived in new builds.
- `OPENCLAW_PERSONA_PROPOSER=off`: disables persona AI proposer calls.
- `OPENCLAW_SONG_PROPOSER=off`: disables song proposer flows that still depend
  on the proposer service.

Runtime safety knobs:

- Suno daily budget: set `runtime/config-overrides.json` under
  `suno.dailyBudget`, or set `OPENCLAW_SUNO_DAILY_BUDGET`.
- X observation pacing: set `bird.rateLimits.dailyMax` and
  `bird.rateLimits.minIntervalMinutes` in `runtime/config-overrides.json`, or
  use `OPENCLAW_BIRD_DAILY_MAX` and `OPENCLAW_BIRD_MIN_INTERVAL_MINUTES`.
  Defaults are deliberately slow to reduce X/Bird ban risk.
- Apple Music lookup: the default used::honda profile uses iTunes artist id
  `1889924232` with JP locale. The poller calls
  `https://itunes.apple.com/lookup?id=1889924232&entity=song&limit=200` and
  matches scheduled song titles.

The older `/answer` wizard flow is gone. `/skip` and `/back` are no longer
production runtime command registrations; if typed, the bot should steer the
producer back to natural conversation.

### Debug AI review command

`/review <songId>` is a Telegram debug command for inspecting a song's current
brief, latest lyrics, Suno take metadata, selected take, and prompt-pack summary.
It is outside the normal autopilot path: it does not change `selected-take.json`,
does not publish, and does not influence the autopilot publish gate.

The default provider is `aiReview.provider="mock"`, which returns a placeholder
review and writes the result to `runtime/debug-ai-reviews/<songId>-<UTC>.json`.
If a future provider is selected but not configured, the command returns a safe
"provider not configured" response rather than calling an external model.

## Plan v9.5 dogfood sequence

Use this sequence after changing the autopilot or Telegram control surface. Keep
real Suno create and social publish disabled unless a separate operator GO says
otherwise.

1. Start with `autopilot.enabled=false` and `telegram.enabled=true`, then send
   `/status`. This proves the bot worker and owner allowlist without running a
   cycle.
2. Send `/pause` and `/resume`; verify `runtime/autopilot-state.json` changes
   and no external create/publish action starts.
3. Temporarily run one cycle with `autopilot.enabled=true` and
   `autopilot.dryRun=true`.
4. Confirm the stage transition appears through RuntimeEventBus and Telegram
   notification. Automated tests cover this with mock Telegram fetch; live
   Telegram smoke is optional because Phase 2B already proved `/status`.
5. Send `/songs`, `/song <songId>`, and `/review <songId>` against the generated
   dry-run song. `/review` writes only `runtime/debug-ai-reviews/` evidence.
6. Keep `music.suno.submitMode="skip"` for form-fill style validation. Do not
   click Suno `Create` in this dogfood pass.
7. Review budget, profile, and MusicAuthority status before any later live Suno
   GO. Live create remains a separate operator decision.
8. Keep social publishing behind the existing global arm, platform arm, and
   connector edge. Telegram has no command that changes `liveGoArmed` or any
   platform arm.

### Rollback to archive-only behavior

If the operator needs the pre-revival posture, use config rather than deleting
runtime state:

```bash
node -e 'const fs=require("fs"); const p="runtime/config-overrides.json"; const c=fs.existsSync(p)?JSON.parse(fs.readFileSync(p,"utf8")):{}; c.autopilot={...(c.autopilot||{}), enabled:false, dryRun:true}; fs.mkdirSync("runtime",{recursive:true}); fs.writeFileSync(p, JSON.stringify(c,null,2)+"\n");'
```

Then restart the Gateway process that owns the runtime. Existing songs,
ledgers, Suno budget/profile files, and Telegram inbox/debug-review records are
left in place for audit and recovery.

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
