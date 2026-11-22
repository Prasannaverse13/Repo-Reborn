import { runSwarm } from "@/lib/orchestrator";
import type { FileOutput, Finding, RunRequest, SwarmEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// One shot JSON version of /api/run. Used by the OpenClaw skill.
// Auth: header x-reborn-key must match REBORN_API_KEY.
export async function POST(req: Request) {
  const want = process.env.REBORN_API_KEY;
  if (!want || req.headers.get("x-reborn-key") !== want) {
    return Response.json({ error: "Set REBORN_API_KEY in .env and send it as x-reborn-key" }, { status: 401 });
  }
  const b = (await req.json().catch(() => ({}))) as Partial<RunRequest>;
  const body: RunRequest = {
    source: b.repo ? "github" : "sample",
    repo: b.repo || "",
    mode: b.mode || "migrate",
    target: b.target || "TypeScript",
    workers: b.workers || 4,
    saver: b.saver || "tiny",
    ghToken: process.env.GITHUB_TOKEN,
  };
  const outputs: FileOutput[] = [];
  const findings: Finding[] = [];
  let done: Extract<SwarmEvent, { t: "done" }> | undefined;
  let error = "";
  let stats: Extract<SwarmEvent, { t: "stats" }> | undefined;
  const emit = (e: SwarmEvent) => {
    if (e.t === "output") outputs.push(e.output);
    if (e.t === "finding") findings.push(e.finding);
    if (e.t === "done") done = e;
    if (e.t === "stats") stats = e;
    if (e.t === "error") error = e.message;
  };
  try {
    await runSwarm(body, emit, req.signal);
  } catch (e) {
    error = (e as Error).message;
  }
  return Response.json({
    ok: !error && Boolean(done),
    error: error || undefined,
    summary: done?.summary,
    prTitle: done?.prTitle,
    tokens: stats?.tokens,
    peakTps: stats ? Math.round(stats.peakTps) : undefined,
    files: outputs.map((o) => ({ from: o.path, to: o.newPath, check: o.checked, notes: o.notes })),
    findings: findings.slice(0, 20).map((f) => ({ path: f.path, severity: f.severity, title: f.title })),
  });
}
