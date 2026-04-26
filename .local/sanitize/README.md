# Internal Docs History Sanitize Runbook

This runbook prepares the repository for public visibility by moving internal
planning/spec history into a separate private repository and removing those paths
from the public repository history.

This is a destructive history rewrite. The script defaults to dry-run mode. The
operator must run the apply and force-push steps manually.

## Scope

The sanitize target is limited to internal planning and workbench material:

- `docs/full-spec/`
- `docs/codex-detailed-specs/`
- `AGENTS.md`
- `AGENTS.distribution-short.md`
- `CODEX_START_HERE.md`
- `SPEC_INDEX.md`
- `docs/log/`
- `docs/ask/`
- `docs/SOURCE_NOTES.md`
- `docs/00_*.md` through `docs/15_*.md`
- `reference/original-starter-scaffold/`

Runtime code, CI, package metadata, and public operator docs are not part of the
sanitize target list.

## Preconditions

Run these checks before using `--apply`:

```bash
git status --short --branch
gh pr list --state open --limit 100
git fetch origin main
git rev-list --left-right --count origin/main...HEAD
git filter-repo --help >/dev/null
```

Expected state:

- Working tree is clean.
- Current branch is `main`.
- Open PR count is `0`.
- `origin/main...HEAD` returns `0 0`.
- `git filter-repo` is installed.

## Step 1: Dry-run the full plan

```bash
bash .local/sanitize/run-history-sanitize.sh --dry-run
```

Rationale: prints the backup branch, mirror extraction, source sanitize, and
operator-only push commands without rewriting history.

## Step 2: Create the private destination repository

```bash
gh repo create yzhonda/openclaw-artist-runtime-internal-specs --private
```

Rationale: the extracted internal specs need a private mirror target before the
public repository history is rewritten.

## Step 3: Apply the local extraction and sanitize

```bash
bash .local/sanitize/run-history-sanitize.sh --apply
```

The script will ask for `SANITIZE` before running `git filter-repo`.

Rationale: this creates a local backup branch, extracts the internal docs into
`/tmp/openclaw-spec-extract`, and rewrites the local `main` history to remove the
sanitize target paths. It does not push.

## Step 4: Push the extracted internal specs

```bash
cd /tmp/openclaw-spec-extract
git remote set-url origin git@github.com:yzhonda/openclaw-artist-runtime-internal-specs.git
git push --mirror origin
cd -
```

Rationale: stores the removed planning/spec history in a private repository for
future operator and agent reference.

## Step 5: Inspect the sanitized public repository

```bash
git log --oneline --decorate --graph --max-count=20
git ls-tree -r --name-only HEAD | rg '^(docs/full-spec|docs/codex-detailed-specs|AGENTS.md|CODEX_START_HERE.md|SPEC_INDEX.md|docs/(log|ask|SOURCE_NOTES.md|0[0-9]_|1[0-5]_)|reference/original-starter-scaffold/)'
npm run typecheck
npm test
npm run build
npm run pack:verify
```

Expected result: the `rg` command prints no sanitized paths, and checks pass.

## Step 6: Force-push the sanitized public history

```bash
git push --force origin main
```

Rationale: publishes the rewritten public history. This requires admin override
because branch protection normally rejects direct history rewrites.

## Recovery

The script creates a local branch named like:

```text
main-pre-sanitize-YYYY-MM-DD
```

To abandon the sanitize result before force-push:

```bash
git checkout main
git reset --hard main-pre-sanitize-YYYY-MM-DD
```

To recover after a force-push:

```bash
git checkout main
git reset --hard main-pre-sanitize-YYYY-MM-DD
git push --force origin main
```

If the private extraction push failed, rerun the dry-run first, inspect
`/tmp/openclaw-spec-extract`, then repeat Step 4.

## Expected impact

- All rewritten commit SHAs change.
- Open PRs become invalid, so they must be merged or closed before applying.
- Release tags would need to be recreated after the rewrite. There are currently
  no release tags expected for this package.
- Branch protection and CI definitions are not edited by this runbook, but the
  force-push requires an operator/admin decision.
