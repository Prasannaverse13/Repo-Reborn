# Run Repo Reborn on the OpenClaw harness

The hackathon rule: all projects must use the OpenClaw harness with Kimi K3.1 Pro on Cerebras.

Repo Reborn does this in two ways.

1. **Harness mode.** Every Scout, worker, fixer and Shipper call goes through the OpenClaw Gateway as an OpenClaw agent turn. OpenClaw talks to Kimi K3.1 Pro on Cerebras.
2. **Skill.** OpenClaw users can type "migrate owner/repo to TypeScript" in OpenClaw chat. The `repo-reborn` skill starts the swarm.

```
OpenClaw chat ──skill──► Repo Reborn app ──► OpenClaw Gateway /v1/chat/completions ──► Cerebras Kimi K3.1 Pro
Repo Reborn dashboard ─────────────────────► OpenClaw Gateway ──────────────────────► Cerebras Kimi K3.1 Pro
```

## 1. Install OpenClaw and add Cerebras

```bash
npm install -g openclaw@latest
openclaw onboard --auth-choice cerebras-api-key
openclaw plugins install @openclaw/cerebras-provider
```

Set `CEREBRAS_API_KEY` in the shell that runs OpenClaw.

## 2. Add Kimi and the HTTP endpoint

Merge `openclaw.repo-reborn.json5` into `~/.openclaw/openclaw.json`. Put a long random token in `gateway.auth.token`.

If `openclaw models list --provider cerebras` does not show Kimi, add it to the Cerebras provider models list:

```json
"models": [ { "id": "moonshotai-kimi-k3.1-pro-trial", "name": "Kimi K3.1 Pro" } ]
```

Kimi rejects the thinking levels `none`, `minimal` and `xhigh`. Use `low`.

## 3. Start the Gateway

```bash
openclaw gateway restart
```

Check it:

```bash
curl -s http://127.0.0.1:18789/v1/models -H "Authorization: Bearer YOUR_TOKEN"
```

## 4. Point Repo Reborn at OpenClaw

In Repo Reborn `.env`:

```
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=YOUR_TOKEN
CEREBRAS_MODEL=moonshotai-kimi-k3.1-pro-trial
REBORN_API_KEY=any-long-random-value
```

Restart `npm run dev`. The dashboard badge now says `Live · OpenClaw · cerebras/moonshotai-kimi-k3.1-pro-trial`.

Test with one tiny call: open http://localhost:3000/api/models?probe=1

## 5. Install the skill

Copy `openclaw/skills/repo-reborn` into your OpenClaw workspace skills folder (`~/.openclaw/workspace/skills/`). Set `REBORN_API_KEY` in the OpenClaw shell too. Then in OpenClaw chat:

> Migrate the Repo Reborn sample repo to TypeScript

## Speed Bounty (Santa's Speedy Shopper)

This is a separate task done in patched OpenClaw, not in Repo Reborn. Entries close Sunday Nov 22 10:00 AM PT.

1. Build patched OpenClaw:
   ```bash
   git clone https://github.com/openclaw/openclaw.git
   cd openclaw
   git checkout 8b18b55
   # download openclaw-cerebras-kimi-on-8b18b55.patch from github.com/wkasekende/openclaw-speed-patch
   git am openclaw-cerebras-kimi-on-8b18b55.patch
   ```
   Install and start it with the OpenClaw README steps. Merge `dev/cerebras-kimi/openclaw.json` into your config.
2. Open the web chat at http://127.0.0.1:18789 in a fresh session. Allow only `web_fetch`.
3. Use temperature 1.0 and low thinking.
4. Start screen recording. Ask it to find 5 real Christmas gifts from real shopping sites with product links.
5. Record the `tok/s mean` readout next to the message box and open all 5 links.
6. Post the video in `#share-your-demo` on the Cerebras Discord with `Speed Bounty entry: <mean> TPS`.

Real products only. Made up or hard coded results are disqualified.
