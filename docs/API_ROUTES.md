# API Routes

`src/routes/index.ts` exposes the Producer Console shell and the plugin-backed
`/plugins/artist-runtime/api/*` surface below.

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

## Console shell

| Method | Path | Purpose | Payload | Response | Notes |
|---|---|---|---|---|---|
| `GET` | `/plugins/artist-runtime` | Serve the Producer Console. | none | HTML document | Returns the bundled React UI when `ui/dist` is fresh; otherwise returns the inline fallback Console shell. |

## Read routes

| Method | Path | Purpose | Payload | Response | Notes |
|---|---|---|---|---|---|
| `GET` | `/api/status` | Dashboard summary for the Console. | optional `config` override | `StatusResponse` with `config`, `dryRun`, `autopilot`, `ticker`, `sunoWorker`, `distributionWorker`, `platforms`, `musicSummary`, `distributionSummary`, `setupReadiness`, `alerts` | Primary polling surface for the dashboard. |
| `GET` | `/api/config` | Read the resolved runtime config. | optional `config` override | `ArtistRuntimeConfig` | Merges defaults, persisted overrides, and payload overrides. |
| `GET` | `/api/artist-mind` | Show artist identity/workspace-facing state. | optional `config` override | object with artist profile, state files, and readiness-facing summaries | Read-only Console view. |
| `GET` | `/api/audit` | Read recent audit events. | optional `config` override | array of `AuditEvent` | Uses the same persisted-config resolver as status/routes. |
| `GET` | `/api/recovery` | Show recovery diagnostics and last known failure state. | optional `config` override | object with diagnostics, ledger health, and recent alerts/audit hints | Read-only recovery surface. |
| `GET` | `/api/songs` | List songs in the workspace. | optional `config` override | `SongState[]` | Family-dispatched under `/api/songs`. |
| `GET` | `/api/songs/:songId` | Read a single song detail. | optional `config` override | `SongState` plus detail fields used by the Console | `:songId` is preserved at the URL layer. |
| `GET` | `/api/songs/:songId/ledger` | Read prompt/social/audit detail for one song. | optional `config` override | per-song ledger detail object | Used by the Songs detail view. |
| `GET` | `/api/prompt-ledger` | Read append-only prompt ledger entries. | optional `config`, optional `songId` | prompt-ledger entry array | Returns all entries or filters by `songId`. |
| `GET` | `/api/alerts` | Read outstanding and acked alerts. | optional `config` override | `AlertRecord[]` | Family-dispatched under `/api/alerts`. |
| `GET` | `/api/platforms` | Read all platform statuses. | optional `config` override | `Record<SocialPlatform, PlatformStatus>` | Includes authority, capability summary, account label, and last action. |
| `GET` | `/api/platforms/:id` | Read one platform detail. | optional `config` override | `PlatformStatus` | `:id` must be `x`, `instagram`, or `tiktok`. |
| `GET` | `/api/suno/status` | Read Suno worker/runtime state. | optional `config` override | `SunoStatusResponse` with `worker`, `currentSongId`, `latestRun`, `recentRuns`, `currentRunId`, `lastImportedRunId`, `lastCreateOutcome`, `lastImportOutcome` | Main Suno card data source for the Console. |
| `GET` | `/api/suno/runs` | Read Suno runs for a song. | optional `config`, optional `songId` | `SunoRunRecord[]` | If `songId` is omitted, the latest song is used when available. |

## Mutating routes

| Method | Path | Purpose | Payload | Response | Notes |
|---|---|---|---|---|---|
| `POST` | `/api/config/update` | Persist config overrides. | `{ patch?: Partial<ArtistRuntimeConfig>, config?: Partial<ArtistRuntimeConfig> }` | resolved `ArtistRuntimeConfig` | `patch` is preferred; `config` also acts as fallback patch input. |
| `POST` | `/api/pause` | Pause autopilot. | optional `config`, optional `reason` | paused autopilot state | Uses resolved workspace root before writing runtime state. |
| `POST` | `/api/resume` | Resume autopilot. | optional `config` | resumed autopilot state | Clears pause state in runtime storage. |
| `POST` | `/api/run-cycle` | Manually trigger one autopilot cycle. | optional `config` | autopilot state plus `tickerOutcome` and `tickerLastTickAt` | Also updates ticker getters through `AutopilotTicker.runNow()`. |
| `POST` | `/api/alerts/:id/ack` | Acknowledge an alert. | optional `config` | ack result object | Family-dispatched under `/api/alerts`. |
| `POST` | `/api/platforms/:id/test` | Probe one platform status. | optional `config` | `{ platform, status, testedAt }` | Live paths are supported for `x`, `instagram`, and `tiktok`. |
| `POST` | `/api/platforms/:id/connect` | Mark a platform enabled in config overrides. | optional `config` | updated `PlatformStatus` | Writes `distribution.platforms.<id>.enabled = true`. |
| `POST` | `/api/platforms/:id/disconnect` | Mark a platform disabled in config overrides. | optional `config` | updated `PlatformStatus` | Writes `distribution.platforms.<id>.enabled = false`. |
| `POST` | `/api/platforms/x/simulate-reply` | Dry-run an X reply from the Console. | optional `config`, `songId?`, `text?`, `targetId?`, `targetUrl?` | `{ result, entry }` from social publishing | Forces `autopilot.dryRun = true` before dispatch. |
| `POST` | `/api/songs/ideate` | Create a new song brief/idea. | optional `config`, `title?`, `artistReason?` | `SongIdeaResult` | Creates song folder, brief, and prompt-ledger entries. |
| `POST` | `/api/songs/:songId/select-take` | Mark the selected Suno take. | optional `config`, `runId?`, `selectedTakeId?`, `reason?` | selected-take record | Family-dispatched under `/api/songs`. |
| `POST` | `/api/songs/:songId/social-assets` | Build social asset files for a song. | optional `config` | social-asset result object | Uses the resolved workspace root. |
| `POST` | `/api/suno/connect` | Move the Suno worker toward a connected state. | optional `config` | `SunoWorkerStatus` | Uses the persisted worker file, not a real browser in tests. |
| `POST` | `/api/suno/reconnect` | Request a reconnect/login handoff cycle. | optional `config` | `SunoWorkerStatus` | Used after login handoff or worker loss. |
| `POST` | `/api/suno/generate/:songId` | Kick one Suno generation run for a song. | optional `config` | Suno run result / run record | Family-dispatched under `/api/suno`. |

## Notes for implementers

- Route family dispatch currently exists for `songs`, `alerts`, `platforms`, and
  `suno` because the OpenClaw Gateway still mounts `:param` paths literally.
- Read and mutating routes both use `resolveRuntimeConfig()` so multi-workspace
  and persisted-override behavior stays consistent across the Console.
- The route catalog here is intentionally higher-level than `src/types.ts`; when
  exact field-level contracts matter, treat `src/types.ts` as the canonical
  machine-readable source.
