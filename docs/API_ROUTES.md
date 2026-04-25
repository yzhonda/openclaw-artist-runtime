# API Routes

`src/routes/index.ts` exposes the Producer Console shell and the plugin-backed
`/plugins/artist-runtime/api/*` surface below.

See also: [OPERATOR_QUICKSTART.md](OPERATOR_QUICKSTART.md),
[TROUBLESHOOTING.md](TROUBLESHOOTING.md), [ERRORS.md](ERRORS.md),
[CONNECTOR_AUTH.md](CONNECTOR_AUTH.md), and
[GATEWAY_AUTH.md](GATEWAY_AUTH.md).

This catalog is consumer-facing: it shows the stable HTTP paths, the primary
payload/response fields, and the route-family notes that matter under the
current OpenClaw Gateway.

## Conventions

- All routes are rooted at `/plugins/artist-runtime`.
- Most read and mutating routes accept an optional `config?: Partial<ArtistRuntimeConfig>`
  in the request payload. The plugin resolves that against persisted
  `runtime/config-overrides.json` before executing.
- Dynamic-looking paths such as `/api/songs/:songId` are preserved at the URL
  layer, but are dispatched under family-level prefix routes internally because
  the current OpenClaw Gateway treats `:param` literally at mount time.
- Platform ids are `x`, `instagram`, and `tiktok`.
- `POST /api/platforms/x/simulate-reply` is always dry-run.
- `safeRegisterRoute()` currently defaults `auth` to `plugin`, and the routes in
  `src/routes/index.ts` do not override that default today.
- For the operator-facing meaning of that `plugin` boundary, see
  `docs/GATEWAY_AUTH.md`.

## Console shell

| Method | Path | Auth | Purpose | Payload | Response | Notes |
|---|---|---|---|---|---|---|
| `GET` | `/plugins/artist-runtime` | `plugin` | Serve the Producer Console. | none | HTML document | Returns the bundled React UI when `ui/dist` is fresh; otherwise returns the inline fallback Console shell. |

## Read routes

| Method | Path | Auth | Purpose | Payload | Response | Notes |
|---|---|---|---|---|---|---|
| `GET` | `/api/status` | `plugin` | Dashboard summary for the Console. | optional `config` override | `StatusResponse` with `config`, `dryRun`, `autopilot`, `ticker`, `sunoWorker`, `distributionWorker`, `platforms`, `musicSummary`, `distributionSummary`, `setupReadiness`, `alerts` | Primary polling surface for the dashboard. |
| `GET` | `/api/config` | `plugin` | Read the resolved runtime config. | optional `config` override | `ArtistRuntimeConfig` | Merges defaults, persisted overrides, and payload overrides. |
| `GET` | `/api/artist-mind` | `plugin` | Show artist identity/workspace-facing state. | optional `config` override | object with artist profile, state files, and readiness-facing summaries | Read-only Console view. |
| `GET` | `/api/audit` | `plugin` | Read recent audit events. | optional `config` override | array of `AuditEvent` | Uses the same persisted-config resolver as status/routes. |
| `GET` | `/api/recovery` | `plugin` | Show recovery diagnostics and last known failure state. | optional `config` override | object with diagnostics, ledger health, and recent alerts/audit hints | Read-only recovery surface. |
| `GET` | `/api/songs` | `plugin` | List songs in the workspace. | optional `config` override | `SongState[]` | Family-dispatched under `/api/songs`. |
| `GET` | `/api/songs/:songId` | `plugin` | Read a single song detail. | optional `config` override | `SongState` plus detail fields used by the Console | `:songId` is preserved at the URL layer. |
| `GET` | `/api/songs/:songId/ledger` | `plugin` | Read prompt/social/audit detail for one song. | optional `config` override | per-song ledger detail object | Used by the Songs detail view. |
| `GET` | `/api/prompt-ledger` | `plugin` | Read append-only prompt ledger entries. | optional `config`, optional `songId` | prompt-ledger entry array | Returns all entries or filters by `songId`. |
| `GET` | `/api/alerts` | `plugin` | Read outstanding and acked alerts. | optional `config` override | `AlertRecord[]` | Family-dispatched under `/api/alerts`. |
| `GET` | `/api/platforms` | `plugin` | Read all platform statuses. | optional `config` override | `Record<SocialPlatform, PlatformStatus>` | Includes authority, capability summary, account label, and last action. |
| `GET` | `/api/platforms/:id` | `plugin` | Read one platform detail. | optional `config` override | `PlatformStatus` | `:id` must be `x`, `instagram`, or `tiktok`. |
| `GET` | `/api/suno/status` | `plugin` | Read Suno worker/runtime state. | optional `config` override | `SunoStatusResponse` with `worker`, `currentSongId`, `latestRun`, `recentRuns`, `currentRunId`, `lastImportedRunId`, `lastCreateOutcome`, `lastImportOutcome` | Main Suno card data source for the Console. |
| `GET` | `/api/suno/runs` | `plugin` | Read Suno runs for a song. | optional `config`, optional `songId` | `SunoRunRecord[]` | If `songId` is omitted, the latest song is used when available. |
| `GET` | `/api/suno/artifacts` | `plugin` | Page through local imported Suno artifacts. | optional `config`, `offset?`, `limit?` | `{ artifacts, totalCount, offset, limit, hasMore }` | Defaults to `offset=0&limit=20`; `limit` is clamped to `100`. |
| `GET` | `/api/suno/diagnostics/export` | `plugin` | Export local Suno diagnostics as JSON. | optional `config`, `days?` | `{ generatedAt, days, profile, budgetResetHistory, importOutcomes }` | Defaults to `days=7`; `days` is clamped to `30` and excludes credentials/cookies/tokens. |

## Mutating routes

| Method | Path | Auth | Purpose | Payload | Response | Notes |
|---|---|---|---|---|---|---|
| `POST` | `/api/config/update` | `plugin` | Persist config overrides. | `{ patch?: Partial<ArtistRuntimeConfig>, config?: Partial<ArtistRuntimeConfig> }` | resolved `ArtistRuntimeConfig` | `patch` is preferred; `config` also acts as fallback patch input. |
| `POST` | `/api/pause` | `plugin` | Pause autopilot. | optional `config`, optional `reason` | paused autopilot state | Uses resolved workspace root before writing runtime state. |
| `POST` | `/api/resume` | `plugin` | Resume autopilot. | optional `config` | resumed autopilot state | Clears pause state in runtime storage. |
| `POST` | `/api/run-cycle` | `plugin` | Manually trigger one autopilot cycle. | optional `config` | autopilot state plus `tickerOutcome` and `tickerLastTickAt` | Also updates ticker getters through `AutopilotTicker.runNow()`. |
| `POST` | `/api/alerts/:id/ack` | `plugin` | Acknowledge an alert. | optional `config` | ack result object | Family-dispatched under `/api/alerts`. |
| `POST` | `/api/platforms/:id/test` | `plugin` | Probe one platform status. | optional `config` | `{ platform, status, testedAt }` | Live paths are supported for `x`, `instagram`, and `tiktok`; see the platform-specific anchors below. |
| `POST` | `/api/platforms/:id/connect` | `plugin` | Mark a platform enabled in config overrides. | optional `config` | updated `PlatformStatus` | Writes `distribution.platforms.<id>.enabled = true`. |
| `POST` | `/api/platforms/:id/disconnect` | `plugin` | Mark a platform disabled in config overrides. | optional `config` | updated `PlatformStatus` | Writes `distribution.platforms.<id>.enabled = false`. |
| `POST` | `/api/platforms/x/simulate-reply` | `plugin` | Dry-run an X reply from the Console. | optional `config`, `songId?`, `text?`, `targetId?`, `targetUrl?` | `{ result, entry }` from social publishing | Forces `autopilot.dryRun = true` before dispatch. |
| `POST` | `/api/songs/ideate` | `plugin` | Create a new song brief/idea. | optional `config`, `title?`, `artistReason?` | `SongIdeaResult` | Creates song folder, brief, and prompt-ledger entries. |
| `POST` | `/api/songs/:songId/select-take` | `plugin` | Mark the selected Suno take. | optional `config`, `runId?`, `selectedTakeId?`, `reason?` | selected-take record | Family-dispatched under `/api/songs`. |
| `POST` | `/api/songs/:songId/social-assets` | `plugin` | Build social asset files for a song. | optional `config` | social-asset result object | Uses the resolved workspace root. |
| `POST` | `/api/suno/connect` | `plugin` | Move the Suno worker toward a connected state. | optional `config` | `SunoWorkerStatus` | Uses the persisted worker file, not a real browser in tests. |
| `POST` | `/api/suno/reconnect` | `plugin` | Request a reconnect/login handoff cycle. | optional `config` | `SunoWorkerStatus` | Used after login handoff or worker loss. |
| `POST` | `/api/suno/generate/:songId` | `plugin` | Kick one Suno generation run for a song. | optional `config` | Suno run result / run record | Family-dispatched under `/api/suno`. |

## Platform test route anchors

### POST /api/platforms/x/test

- Auth: `plugin`
- Purpose: run the X/Bird connector probe and return `{ platform, status, testedAt }`
- Notes: uses the same persisted config resolution path as the rest of the platform family
- Common reasons: [bird_cli_not_installed](ERRORS.md#bird_cli_not_installed), [bird_auth_expired](ERRORS.md#bird_auth_expired), [bird_probe_failed](ERRORS.md#bird_probe_failed)

### POST /api/platforms/instagram/test

- Auth: `plugin`
- Purpose: run the Instagram connector probe and return `{ platform, status, testedAt }`
- Notes: reports env-configured / fail-closed state without performing real external posting
- Common reasons: [instagram_auth_not_configured](ERRORS.md#instagram_auth_not_configured); the lane is currently frozen by operator decision

### POST /api/platforms/tiktok/test

- Auth: `plugin`
- Purpose: run the TikTok connector probe and return `{ platform, status, testedAt }`
- Notes: reports env-configured / fail-closed state without performing real external posting
- Common reasons: [account_not_created](ERRORS.md#account_not_created), [tiktok_account_not_created](ERRORS.md#tiktok_account_not_created)

## Notes for implementers

- Route family dispatch currently exists for `songs`, `alerts`, `platforms`, and
  `suno` because the OpenClaw Gateway still mounts `:param` paths literally.
- Read and mutating routes both use `resolveRuntimeConfig()` so multi-workspace
  and persisted-override behavior stays consistent across the Console.
- Gateway/plugin auth boundary notes live in `docs/GATEWAY_AUTH.md`.
- The route catalog here is intentionally higher-level than `src/types.ts`; when
  exact field-level contracts matter, treat `src/types.ts` as the canonical
  machine-readable source.
