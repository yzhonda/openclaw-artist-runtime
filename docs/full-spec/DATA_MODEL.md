# Data Model

## Config

See `plugin/openclaw.plugin.json` for JSON Schema.

Primary config sections:

```ts
type ArtistRuntimeConfig = {
  workspace: { path: string };
  artist: { mode: "public_artist"; profilePath: string };
  autopilot: { enabled: boolean; cadence: string; maxSongsPerWeek: number };
  music: { engine: "suno"; suno: SunoConfig };
  publicPresence: { platforms: Record<string, PlatformConfig> };
  distribution: DistributionConfig;
  safety: SafetyConfig;
  console: ConsoleConfig;
};
```

## Song state

```ts
type SongStatus =
  | "idea"
  | "brief"
  | "lyrics"
  | "suno_prompt_pack"
  | "suno_running"
  | "takes_imported"
  | "take_selected"
  | "social_assets"
  | "published"
  | "archived"
  | "failed";
```

## Song directory

```txt
songs/<song-id>/
  song.json
  song.md
  brief.md
  lyrics/
    lyrics.v1.md
    lyrics.v2.md
    yaml-suno.md
  suno/
    style.md
    exclude.md
    sliders.json
    suno-payload.json
    validation.json
    runs.jsonl
    takes/
      take-001.md
      take-selection.md
  social/
    distribution-set.json
    x-post.json
    instagram-post.json
    tiktok-post.json
    social-publish.jsonl
  prompts/
    prompt-ledger.jsonl
  audit/
    actions.jsonl
```

## Runtime status

```ts
type RuntimeStatus = {
  artist: { id: string; active: boolean; currentStateSummary: string };
  autopilot: { enabled: boolean; currentCycle?: AutopilotCycleStatus };
  suno: { connected: boolean; workerState: string; budget: BudgetStatus };
  platforms: Record<string, PlatformStatus>;
  alerts: Alert[];
};
```

## Alert

```ts
type Alert = {
  id: string;
  severity: "info" | "warning" | "error" | "critical";
  source: "suno" | "x" | "instagram" | "tiktok" | "autopilot" | "ledger";
  title: string;
  message: string;
  createdAt: string;
  resolvedAt?: string;
  suggestedAction?: string;
};
```