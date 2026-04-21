# Architecture

```text
OpenClaw Gateway
  └─ Artist Runtime native plugin
      ├─ Manifest/config schema/ui hints
      ├─ Producer Console route
      ├─ Tools
      ├─ Hooks
      ├─ Services
      ├─ Connectors
      ├─ Repositories
      ├─ Ledgers
      └─ Workspace templates
```

## Data separation

- Config: producer intent and policy.
- Workspace files: artist identity, conversation voice, current state, songs, lyrics, prompts, public artifacts.
- Runtime store: connection status, counters, locks, token references.
- Browser profiles: dedicated service profiles, never creative Markdown files.

### Workspace markdown roles

- `AGENTS.md`: OpenClaw標準MD。agentが常に従う基本ルールを書く。Artist Runtimeでは「Public Artistとして自律活動する」という最上位の行動原則を置く。
- `SOUL.md`: OpenClaw標準MD。通常会話での人格・話し方・温度感を書く。`ARTIST.md` より日常的な応答トーン寄り。プロデューサーと話すときの声。
- `HEARTBEAT.md`: OpenClaw標準MD。heartbeat時の振る舞いを書く。何もなければ黙る、重要な制作進捗だけ報告する、など。
- `ARTIST.md`: Artist Runtime独自MD。OpenClaw標準ではない。pluginが明示的に読み込んで注入する、アーティスト人格の中核ファイル。音楽家としての美学・創作憲法・Suno制作プロファイルを書く。
- `artist/CURRENT_STATE.md`: いま何に惹かれているか。
- `artist/OBSERVATIONS.md`: 世の中から何を見つけたか。
- `artist/SOCIAL_VOICE.md`: SNSでどう振る舞うか。
- `artist/RELEASE_POLICY.md`: 公開・権利・停止条件。
- `songs/<song-id>/`: この曲をどう作ったか。

## Side effect path

```text
Autopilot or agent tool call
  -> Authority guard
  -> Risk/budget/cadence checks
  -> Connector execution
  -> Audit log
  -> Prompt Ledger link
```

Producer Console does not publish directly. It calls plugin APIs that use the same authority path.
