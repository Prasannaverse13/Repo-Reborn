# Submission kit

Rule: OpenClaw harness + Kimi K3.1 Pro on Cerebras. Demo video 60 seconds or less on X.
Tag @Cerebras and @Kimi_Moonshot. Use #KimiOnCerebras.
Votes are counted Tuesday Nov 24 10:00 AM PT (X impressions and Reddit upvotes).

## Before you record

1. OpenClaw Gateway running with Kimi (see openclaw/SETUP.md).
2. Dashboard badge shows `Live · OpenClaw · cerebras/moonshotai-kimi-k3.1-pro-trial`.
3. Run one Tiny sample first so nothing surprises you.
4. Use Balanced for the recording. It shows more agents and looks better.
5. Hide your keys and .env from the screen.

## 60 second video script

| Time | Screen | Voice or caption |
|---|---|---|
| 0 to 5s | Landing page hero | "Old repos die. We bring them back." |
| 5 to 10s | Paste a real old repo, pick Migrate to TypeScript, click Run | "One click. A swarm of Kimi K3.1 Pro agents on Cerebras." |
| 10 to 15s | OpenClaw badge and Scout card | "Every agent runs on the OpenClaw harness." |
| 15 to 35s | Swarm board with agents flying to files, tok/s climbing | "Agents split the repo and rewrite files in parallel at thousands of tokens per second." |
| 35 to 45s | Before and after diff, green check | "Each file is syntax checked. Broken ones get fixed by a fixer agent." |
| 45 to 52s | Findings tab or Ship tab with PR | "Then it writes the pull request." |
| 52 to 60s | Stats row: peak tok/s, time, tokens | "A whole repo reborn in seconds. Repo Reborn. #KimiOnCerebras" |

Optional 5 second extra: OpenClaw chat typing "migrate the sample repo to TypeScript" and the skill answering.

## X post

Old repos never die. They get reborn.

Repo Reborn is a swarm of Kimi K3.1 Pro agents on @Cerebras running through the OpenClaw harness.

Paste a repo. Agents map it, split the work and rewrite every file in parallel. Each file is checked. Then it opens the PR.

Built for the @Cerebras x @Kimi_Moonshot hackathon #KimiOnCerebras

## Reddit post (r/cerebras)

Title: Repo Reborn: a swarm of Kimi K3.1 Pro agents that modernizes old repos in seconds on Cerebras

Body:
I built Repo Reborn for the Cerebras x Kimi K3.1 Pro hackathon.

You give it a GitHub repo. A Scout agent maps it, a planner splits the work and a swarm of worker agents rewrites the files in parallel. Every result is syntax checked and a fixer agent repairs anything broken. Then a Shipper agent writes the pull request.

Four modes: migrate (for example jQuery or PHP 5 to modern code), secure (find and fix issues), docs and explore (ask questions about the code).

Every agent call runs through the OpenClaw harness on Kimi K3.1 Pro on Cerebras. There is also an OpenClaw skill so you can start a swarm from OpenClaw chat.

It has a credit saver with a hard token cap per run.

Video: <link>
Code: <link>

Happy to answer questions.
