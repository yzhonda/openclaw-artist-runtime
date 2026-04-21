# Workspace Template Guide

このディレクトリは、Artist Runtime が新しい artist workspace を初期化するときに使うテンプレートです。

## Core markdown files

- `AGENTS.md`: OpenClaw標準MD。agentが常に従う基本ルールを書く。Artist Runtimeでは「Public Artistとして自律活動する」という最上位の行動原則を置く。
- `SOUL.md`: OpenClaw標準MD。通常会話での人格・話し方・温度感を書く。`ARTIST.md` より日常的な応答トーン寄り。プロデューサーと話すときの声。
- `HEARTBEAT.md`: OpenClaw標準MD。heartbeat時の振る舞いを書く。何もなければ黙る、重要な制作進捗だけ報告する、など。
- `ARTIST.md`: Artist Runtime独自MD。OpenClaw標準ではない。pluginが明示的に読み込んで注入する、アーティスト人格の中核ファイル。音楽家としての美学・創作憲法・Suno制作プロファイルを書く。

## Decision guide

- プロデューサーとどう話すか？ -> `SOUL.md`
- 音楽家として何を作る存在なのか？ -> `ARTIST.md`
- いま何に惹かれているか？ -> `artist/CURRENT_STATE.md`
- 世の中から何を見つけたか？ -> `artist/OBSERVATIONS.md`
- この曲をどう作ったか？ -> `songs/<song-id>/`
- SNSでどう振る舞うか？ -> `artist/SOCIAL_VOICE.md`
- 公開・権利・停止条件は？ -> `artist/RELEASE_POLICY.md`

## Workspace layout notes

- `artist/CURRENT_STATE.md`: 今の関心、感情の天気、制作中の惹かれを置く。
- `artist/OBSERVATIONS.md`: 外界から拾った観察や種を短く蓄積する。
- `artist/SOCIAL_VOICE.md`: SNS上の文体、避ける表現、投稿の温度感を定義する。
- `artist/RELEASE_POLICY.md`: 公開ポリシー、権利ルール、停止条件をまとめる。
- `artist/PRODUCER_NOTES.md`: プロデューサーからの個別メモや方針変更を置く。
- `songs/<song-id>/`: 曲ごとの brief、lyrics、Suno payload、social assets、audit を置く。
