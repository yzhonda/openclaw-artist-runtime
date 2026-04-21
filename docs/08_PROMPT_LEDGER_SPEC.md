# Prompt Ledger Spec

Prompt Ledger is append-only and song-scoped.

## Location

```text
songs/<song-id>/prompts/prompt-ledger.jsonl
```

## Entry fields

- id
- timestamp
- stage
- songId
- artistReason
- input references
- prompt text or path
- output references
- payload hash
- model/provider/manual version metadata
- validation result
- authority decision

## Rule

No external generation or publication may occur without a ledger entry linking the prompt/payload that caused it.
