# Repo Reborn

A swarm of Kimi K3.1 Pro agents on Cerebras that rebuilds old repos.

Paste a GitHub link. Scout maps the repo. Maestro writes the plan. Up to 20 worker agents rewrite files at the same time. Every file goes through a real syntax check and gets fixed if it fails. Shipper writes the pull request. You download the new repo or open the PR.

## Modes (covers every hackathon track)

| Mode | Track | What it does |
| --- | --- | --- |
| Migrate | Refactor legacy code | Moves old code (jQuery, PHP 5, Python 2) to a target stack |
| Secure | Refactor legacy code | Finds security bugs and patches each file |
| Docs | Explore codebases | Docs for every file plus a README |
| Explore | Explore codebases | Explains each file, then lets you ask questions about the repo |
| All | Build agents | Multi agent orchestration with a live swarm board |
| TPS Lab | TPS bounty | Finds the prompt with the fastest tokens per second |

## Run it

```bash
npm install
copy .env.example .env.local   # Windows. Use cp on Mac or Linux
# put your Cerebras key in .env.local
npm run dev
```

Open http://localhost:3000 for the landing page. The dashboard with the swarm is at http://localhost:3000/dashboard

Without a key the app runs a simulated swarm so you can still see the full flow.

## Environment

| Name | Needed | Notes |
| --- | --- | --- |
| CEREBRAS_API_KEY | Yes for real runs | From cloud.cerebras.ai |
| CEREBRAS_MODEL | Yes | Default `moonshotai-kimi-k3.1-pro-trial` (the hackathon id) |
| CEREBRAS_BASE_URL | No | Default `https://api.cerebras.ai/v1` |
| CEREBRAS_REASONING_EFFORT | No | `low` makes agents faster. Leave empty if the API rejects it |
| SWARM_MAX_WORKERS | No | Default 12. Raise if your rate limit allows |
| SWARM_MAX_FILES | No | Default 60 |
| GITHUB_CLIENT_ID | For sign in | From a GitHub OAuth App (github.com/settings/developers) |
| GITHUB_CLIENT_SECRET | For sign in | Same page. Press Generate a new client secret |
| SESSION_SECRET | For sign in | Long random text. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| GITHUB_TOKEN | No | Only if you skip sign in and want higher read limits |

## GitHub sign in

Set the three sign in vars and the dashboard needs a GitHub login. The swarm then reads your private repos and opens PRs with your login. No token to paste. Your token lives in an encrypted httpOnly cookie. Without the vars the app runs in guest mode.

OAuth App settings: Homepage `http://localhost:3000`. Callback `http://localhost:3000/api/auth/callback`. Always open the app at `localhost:3000` and not the network address.


## How the swarm works

```
fetch  -> pulls up to 60 code files from GitHub (or the built in old shop demo)
scout  -> one call maps the repo and picks the order
plan   -> shared rules for every worker
work   -> N workers pull from one queue and stream their file
verify -> TypeScript parser for JS/TS, JSON parse, Python 3 checks. Fixer loop up to 2 tries
ship   -> PR title, body and README
```

Main files:

- `lib/orchestrator.ts` the agent pipeline
- `lib/cerebras.ts` streaming client with tokens per second
- `lib/checker.ts` real syntax checks
- `components/SwarmBoard.tsx` the live swarm board
- `app/api/run/route.ts` server sent events stream

## Deploy

Push to GitHub and import in Vercel. Add the env vars. Long runs need a plan that allows 300 second functions.

## Credit saver

Cerebras credits are limited, so every run has a hard token cap.

- Tiny (default): 8 files, 30k tokens max
- Balanced: 15 files, 80k tokens max
- Full: 60 files, 400k tokens max

Reasoning is set to low by default (CEREBRAS_REASONING_EFFORT=low). Set TOKEN_BUDGET_MAX to lower every cap. Start with Tiny to check your key and model id.

## OpenClaw harness

Repo Reborn runs on the OpenClaw harness. Set `OPENCLAW_GATEWAY_URL` and every agent call becomes an OpenClaw agent turn on Kimi K3.1 Pro on Cerebras. The `openclaw/skills/repo-reborn` skill lets you start a swarm from OpenClaw chat. Full steps are in `openclaw/SETUP.md`.

Check your setup at `/api/models?probe=1`.

## Backup model

Kimi is always tried first. If Cerebras says the model is not open to your key (404), the app runs the same call on `CEREBRAS_FALLBACK_MODEL` (default `gpt-oss-120b`) and tries Kimi again after 5 minutes. The status badge and the run header always show the model that really ran, with "(backup)" when it is the backup.
