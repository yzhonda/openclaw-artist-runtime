# Suno Spec

## Goal

Use Suno as the primary music engine while preserving full production history.

## Modes

### Manual copy fallback

- Generate Style / Exclude / YAML / payload.
- User copies into Suno manually.
- User pastes generated URL back.

### Background browser worker — default

- Dedicated persistent browser profile.
- Human logs in once.
- Worker uses logged-in session.
- Worker fills Suno Create page and starts generation if policy allows.
- Worker imports URLs/takes when possible.
- Worker stops on challenges.

### API/provider mode — future

Only use official or explicitly permitted API/provider paths. Do not default to unofficial reverse-engineered APIs.

## Suno authority levels

```ts
type SunoAuthority =
  | "prepare_only"
  | "autofill_only"
  | "auto_create_with_budget"
  | "auto_create_and_select_take";
```

Default for this product:

```txt
auto_create_and_select_take
```

with hard stops and budgets enabled.

## Required prompt pack

A Suno prompt pack is valid only if it contains:

- song ID,
- song title,
- artist reason,
- Style,
- Exclude,
- YAML lyrics,
- sliders,
- payload JSON,
- validation report,
- source lyric version,
- ARTIST.md snapshot/hash,
- CURRENT_STATE snapshot/hash,
- sunomanual knowledge version/hash if available.

## Prompt pack files

```txt
songs/<song-id>/
  suno/
    style.md
    exclude.md
    sliders.json
    suno-payload.json
    validation.json
    runs.jsonl
  lyrics/
    lyrics.v1.md
    yaml-suno.md
  prompts/
    prompt-ledger.jsonl
```

## Worker sequence

1. Load valid prompt pack.
2. Append `suno_prepare_to_create` ledger entry.
3. Check budget and caps.
4. Open Suno persistent profile.
5. Verify login.
6. Navigate to Create page.
7. Fill fields.
8. Verify fields match payload.
9. If authority permits, click Create.
10. Wait for generation or record pending state.
11. Import result URLs/take metadata if possible.
12. Append run ledger.
13. Evaluate takes.
14. Select best take if authority permits.
15. Create social assets.

## Hard stops

Stop and alert, never bypass:

- not logged in,
- CAPTCHA / bot challenge,
- payment prompt,
- credit purchase prompt,
- terms/update modal that blocks Create,
- selector mismatch,
- form did not retain input,
- unknown model/settings UI,
- repeated failed creates,
- potential policy/legal/rights issue.

## Budget accounting

Track:

- monthly generation budget,
- daily generation cap,
- min minutes between creates,
- failed run count,
- pending run count,
- unknown run count.

## Take evaluation

The artist may rank takes using:

- fit to brief,
- vocal character,
- hook strength,
- emotional core,
- artifact severity,
- social-share potential.

Store evaluation in:

```txt
songs/<song-id>/suno/takes/take-001.md
songs/<song-id>/suno/takes/take-selection.md
```

## Integration with sunomanual

Vendor or import `sunomanual` into `packages/suno-production/knowledge`.

Expected files include:

- `lyric_craft.md`,
- `song_structures.md`,
- `style_catalog.md`,
- `rap_and_flow.md`,
- `english_lyrics.md`,
- `suno_v55_reference.md`,
- `yaml_template.md`.

The package should expose:

- `createSunoPromptPack(input)`,
- `validateSunoPromptPack(pack)`,
- `buildSunoPayload(pack)`,
- `hashKnowledgePack()`.