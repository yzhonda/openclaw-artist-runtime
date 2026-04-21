# Prompt Ledger Spec

## Requirement

Every work must preserve not only the final song but the full chain of prompts, inputs, outputs, payloads, settings, and public distribution steps.

## Principles

- Append-only.
- JSONL for machine reading.
- Markdown snapshots for human reading.
- No silent overwrite.
- Every public action references source song/take and ledger entries.
- Every Suno generation references exact payload hash.

## Required stages

- `artist_state_snapshot`
- `observation_to_song_idea`
- `song_brief_generation`
- `lyrics_generation`
- `lyrics_rewrite`
- `suno_style_generation`
- `suno_exclude_generation`
- `suno_yaml_generation`
- `suno_payload_build`
- `suno_browser_fill`
- `suno_create`
- `suno_result_import`
- `take_evaluation`
- `take_selection`
- `mastering` optional
- `social_asset_generation`
- `social_publish`

## Ledger entry

```ts
type PromptLedgerEntry = {
  id: string;
  timestamp: string;
  stage: string;
  songId?: string;
  runId?: string;
  actor: "artist" | "producer" | "system" | "connector";
  artistReason?: string;
  inputRefs: string[];
  outputRefs: string[];
  promptText?: string;
  promptHash?: string;
  outputSummary?: string;
  outputHash?: string;
  configSnapshot?: unknown;
  artistSnapshotHash?: string;
  currentStateHash?: string;
  knowledgePackHash?: string;
  policyDecision?: PolicyDecision;
  verification?: VerificationResult;
  error?: SerializedError;
};
```

## File layout

Global ledger optional:

```txt
artist/audit/global-prompt-ledger.jsonl
```

Per-song ledger required:

```txt
songs/<song-id>/prompts/prompt-ledger.jsonl
```

Public action ledger:

```txt
songs/<song-id>/social/social-publish.jsonl
```

## Write algorithm

1. Build entry with unique ID.
2. Serialize to one JSON line.
3. Append using filesystem append.
4. fsync if available / reasonable.
5. Return entry ID.
6. Never rewrite existing lines during normal operation.

## Recovery

If a ledger line is corrupt:

- do not delete it automatically,
- mark ledger unhealthy,
- create alert,
- continue only if the next append can safely proceed.