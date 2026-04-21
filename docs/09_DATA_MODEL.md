# Data Model

## Song folder

```text
songs/<song-id>/
  song.md
  brief.md
  lyrics/
  suno/
  prompts/
  assets/
  social/
  audit/
```

## Runtime store

Use runtime store for machine state:

- connection status;
- token references;
- locks;
- counters;
- last run timestamps;
- connector capabilities.

Do not store secrets in workspace Markdown.
