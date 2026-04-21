# sunomanual Integration

`sunomanual` is treated as the Suno Production Knowledge Pack.

## Expected import path

```text
./sunomanual/skills/suno/knowledge/
```

Import or copy into:

```text
src/suno-production/knowledge/
```

Expected files:

- `lyric_craft.md`
- `song_structures.md`
- `style_catalog.md`
- `rap_and_flow.md`
- `english_lyrics.md`
- `suno_v55_reference.md`
- `yaml_template.md`

## Implementation rules

`artist_suno_create_prompt_pack` must always output:

- Style;
- Exclude;
- YAML lyrics;
- sliders;
- `suno-payload.json`;
- validation report;
- Prompt Ledger entries.
