---
name: repo-reborn
description: Migrate, secure, document or explore an old GitHub repo with the Repo Reborn agent swarm running Kimi K3.1 Pro on Cerebras. Use when the user asks to modernize, migrate, upgrade, audit, secure or document a repository.
---

# Repo Reborn

Repo Reborn is a swarm of Kimi K3.1 Pro agents on Cerebras. It reads a repo, plans the work, rewrites files in parallel, checks the syntax of each result and writes a pull request summary.

## When to use

- "Migrate github.com/owner/repo to TypeScript"
- "Find security issues in owner/repo"
- "Write docs for owner/repo"
- "Explain how owner/repo works"

## How to run

The Repo Reborn app must be running on this machine (default http://localhost:3000) with `REBORN_API_KEY` set.

Call it with one POST request. Use the exec tool:

```bash
curl -s -X POST http://localhost:3000/api/reborn \
  -H "Content-Type: application/json" \
  -H "x-reborn-key: $REBORN_API_KEY" \
  -d '{"repo":"owner/repo","mode":"migrate","target":"TypeScript","saver":"tiny"}'
```

Fields:

- `repo`: GitHub `owner/repo` or a full URL. Leave it out to run the built-in sample repo.
- `mode`: `migrate`, `secure`, `docs` or `explore`.
- `target`: what to migrate to. Examples: `TypeScript`, `Python 3`, `PHP 8`.
- `saver`: `tiny` (default, 30k tokens max), `balanced` (80k) or `full` (400k). Keep `tiny` unless the user asks for more.

The call can take up to a few minutes. It returns JSON with `summary`, `prTitle`, `tokens`, `peakTps`, a `files` list and a `findings` list.

## How to answer

1. Say how many files were done and the peak tokens per second.
2. List the changed files as `old path -> new path` with the check result.
3. For secure mode list high severity findings first.
4. Tell the user to open http://localhost:3000/dashboard to see the diffs and open a pull request.

If the response has `error`, show it and stop. Never invent results.
