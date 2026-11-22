import { extractJson, isLive, modelLabel, onBackup, streamChat } from "./cerebras";
import { checkCode } from "./checker";
import { fetchRepo } from "./github";
import { AGENT_COLORS, AGENT_NAMES, fixerPrompt, fenced, parseWorker, scoutPrompt, shipPrompt, workerPrompt } from "./prompts";
import { SAMPLE_NAME, sampleFiles } from "./sample";
import { profile } from "./profiles";
import { runDemo } from "./demo";
import type { AgentInfo, FileOutput, RepoFile, RunRequest, SwarmEvent } from "./types";

type Emit = (e: SwarmEvent) => void;

export function buildAgents(workers: number): AgentInfo[] {
  const core: AgentInfo[] = [
    { id: "scout", name: "Scout", role: "scout", color: "#292929" },
    { id: "planner", name: "Maestro", role: "planner", color: "#3B40AF" },
  ];
  const ws: AgentInfo[] = Array.from({ length: workers }, (_, i) => ({
    id: `w${i}`,
    name: AGENT_NAMES[i % AGENT_NAMES.length],
    role: "worker",
    color: AGENT_COLORS[i % AGENT_COLORS.length],
  }));
  return [...core, ...ws, { id: "ship", name: "Shipper", role: "shipper", color: "#2EB872" }];
}

export async function loadFiles(req: RunRequest, maxFiles: number, maxChars: number) {
  if (req.source === "sample" || !req.repo) return { name: SAMPLE_NAME, files: sampleFiles().filter((f) => f.size <= maxChars).slice(0, maxFiles) };
  const r = await fetchRepo(req.repo, maxFiles, req.ghToken, maxChars);
  return { name: r.name, files: r.files };
}

export async function runSwarm(req: RunRequest, emit: Emit, signal: AbortSignal) {
  const prof = profile(req.saver);
  const workers = Math.max(1, Math.min(prof.workers, req.workers || prof.workers));
  const shipReserve = 3_200; // the Shipper call at the end
  let committed = 0; // worst case tokens of calls that are still running
  const live = isLive();
  emit({ t: "config", live, model: live ? modelLabel() : "simulated" });

  emit({ t: "phase", phase: "fetch", label: "Pulling the repo" });
  const { name, files } = await loadFiles(req, prof.files, prof.fileChars);
  if (!files.length) throw new Error("No code files found in this repo");
  emit({ t: "repo", name, files: files.map(({ path, lang, size, group }) => ({ path, lang, size, group })) });

  const agents = buildAgents(Math.min(workers, files.length));
  emit({ t: "agents", agents });

  if (!live) return runDemo(req, name, files, agents, emit, signal);

  // Shared stats
  const t0 = Date.now();
  let tokens = 0;
  let peakTps = 0;
  let calls = 0;
  let liveChars = 0;
  let shownModel = modelLabel();
  const syncModel = () => {
    if (modelLabel() === shownModel) return;
    shownModel = modelLabel();
    emit({ t: "config", live, model: shownModel });
    if (onBackup()) emit({ t: "log", agent: "Router", text: `Main model is not open to this key. Switched to ${shownModel}.` });
  };
  const statTimer = setInterval(() => {
    syncModel();
    const el = Date.now() - t0;
    const total = tokens + Math.round(liveChars / 4);
    emit({ t: "stats", tokens: total, tps: total / Math.max(0.5, el / 1000), peakTps, elapsedMs: el, calls, budget: prof.budget });
  }, 250);
  const account = (r: { completionTokens: number; tps: number }) => {
    syncModel();
    tokens += r.completionTokens;
    calls++;
    peakTps = Math.max(peakTps, r.tps);
  };

  try {
    // 1. Scout
    emit({ t: "phase", phase: "scout", label: "Scout is mapping the repo" });
    emit({ t: "agent", id: "scout", state: "thinking", note: `Reading ${files.length} files` });
    // Tiny skips the Scout call. It saves credits and the wait before work starts.
    let scoutRes = { ms: 0, completionTokens: 0, tps: 0 };
    let map = { summary: "", stack: "", order: [] as string[], plan: [] as string[] };
    if (prof.quick) {
      const langs = [...new Set(files.map((f) => f.lang))].slice(0, 4).join(", ");
      map = { summary: `${name}: ${files.length} files in ${langs}`, stack: langs, order: [], plan: [] };
    } else {
      const sr = await streamChat({ messages: scoutPrompt(name, files, req.mode, req.target), maxTokens: 3000, signal, session: "scout", onThinking: (n) => (liveChars = Math.max(liveChars, n)) });
      account(sr);
      scoutRes = sr;
      map = extractJson(sr.text, map);
    }
    const known = new Set(files.map((f) => f.path));
    const order = [...(map.order || []).filter((p) => known.has(p)), ...files.map((f) => f.path)].filter(
      (p, i, a) => a.indexOf(p) === i
    );
    emit({ t: "agent", id: "scout", state: "done", note: prof.quick ? "Skipped to save credits" : `Mapped in ${(scoutRes.ms / 1000).toFixed(1)}s` });
    emit({ t: "log", agent: "Scout", text: map.summary || "Repo mapped" });

    // 2. Plan
    emit({ t: "phase", phase: "plan", label: "Maestro is splitting the work" });
    emit({ t: "agent", id: "planner", state: "thinking", note: "Writing swarm rules" });
    const plan = map.plan?.length ? map.plan : ["Keep behaviour the same", "Use modern safe APIs", "Keep files self contained"];
    emit({ t: "map", summary: map.summary || "", stack: map.stack || "", order, plan });
    emit({ t: "agent", id: "planner", state: "done", note: `${order.length} tasks for ${agents.length - 3} agents` });
    emit({ t: "log", agent: "Maestro", text: `Plan ready. ${plan.length} rules. ${order.length} files queued.` });

    // 3. Work
    emit({ t: "phase", phase: "work", label: "Swarm is working" });
    const byPath = new Map(files.map((f) => [f.path, f]));
    const queue = order.map((p) => byPath.get(p)!).filter(Boolean);
    const notes: string[] = [];
    const outputs: FileOutput[] = [];
    const workerAgents = agents.filter((a) => a.role === "worker");

    await Promise.all(
      workerAgents.map(async (agent) => {
        while (queue.length && !signal.aborted) {
          // Credit saver: reserve the worst case for this file before it starts.
          // The reserve covers fix retries. Total spend can never pass the budget.
          const room = prof.budget - shipReserve - tokens - committed;
          const cap = Math.min(capFor(queue[0], req.mode), room / (1 + prof.fixes));
          if (cap < 1_500) {
            if (committed > 0) {
              await new Promise((r) => setTimeout(r, 150)); // others may free budget
              continue;
            }
            break;
          }
          const file = queue.shift()!;
          const reserved = cap * (1 + prof.fixes);
          committed += reserved;
          try {
            const out = await workFile(file, agent, req, plan, map.summary || "", emit, signal, account, (d) => (liveChars += d), { maxTokens: cap, fixes: prof.fixes });
            outputs.push(out);
            notes.push(`${file.path} -> ${out.newPath}: ${out.notes}`);
          } catch (e) {
            emit({ t: "file", path: file.path, status: "failed", agent: agent.id });
            emit({ t: "log", agent: agent.name, text: `Failed on ${file.path}: ${(e as Error).message.slice(0, 120)}` });
          } finally {
            committed -= reserved;
          }
        }
        emit({ t: "agent", id: agent.id, state: "done", note: "Queue empty" });
      })
    );

    const skipped = queue.length;
    if (skipped) emit({ t: "log", agent: "Credit saver", text: `Token budget reached. ${skipped} files skipped. Pick a bigger saver level to do more.` });

    // 4. Verify summary
    emit({ t: "phase", phase: "verify", label: "Checks complete" });
    const pass = outputs.filter((o) => o.checked === "pass").length;
    const skip = outputs.filter((o) => o.checked === "skip").length;
    emit({ t: "log", agent: "Verifier", text: `${pass} files passed syntax checks. ${skip} not checkable. ${outputs.length - pass - skip} need a human.` });

    // 5. Ship
    emit({ t: "phase", phase: "ship", label: "Shipper is writing the PR" });
    emit({ t: "agent", id: "ship", state: "thinking", note: "Writing PR" });
    const fallbackShip = { title: `Repo Reborn: ${req.mode} ${name}`, body: notes.join("\n"), readme: "" };
    let ship = fallbackShip;
    if (!prof.quick) {
      const shipRes = await streamChat({ messages: shipPrompt(name, req.mode, req.target, notes), maxTokens: 3000, signal, session: "ship" });
      account(shipRes);
      ship = extractJson(shipRes.text, fallbackShip);
    }
    emit({ t: "agent", id: "ship", state: "done", note: "PR ready" });

    const el = Date.now() - t0;
    emit({ t: "stats", tokens, tps: tokens / (el / 1000), peakTps, elapsedMs: el, calls, budget: prof.budget });
    syncModel();
    emit({ t: "phase", phase: "done", label: "Done" });
    emit({
      t: "done",
      summary: `${outputs.length} of ${files.length} files in ${(el / 1000).toFixed(1)}s with ${workerAgents.length} agents. ${tokens.toLocaleString()} of ${prof.budget.toLocaleString()} tokens used.${skipped ? ` ${skipped} files skipped to save credits.` : ""}`,
      prTitle: ship.title,
      prBody: ship.body,
      readme: ship.readme || undefined,
    });
  } finally {
    clearInterval(statTimer);
  }
}

async function workFile(
  file: RepoFile,
  agent: AgentInfo,
  req: RunRequest,
  plan: string[],
  summary: string,
  emit: Emit,
  signal: AbortSignal,
  account: (r: { completionTokens: number; tps: number }) => void,
  onChars: (d: number) => void,
  limits: { maxTokens: number; fixes: number }
): Promise<FileOutput> {
  emit({ t: "agent", id: agent.id, state: "working", file: file.path, note: `Rewriting ${file.path}` });
  emit({ t: "file", path: file.path, status: "working", agent: agent.id });

  let last = 0;
  let counted = 0;
  let acc = "";
  const started = Date.now();
  const res = await streamChat({
    messages: workerPrompt(file, req.mode, req.target, plan, summary),
    maxTokens: limits.maxTokens,
    signal,
    session: agent.id,
    onThinking: (n) => {
      const now = Date.now();
      if (now - last > 400) {
        last = now;
        emit({ t: "file", path: file.path, status: "working", agent: agent.id, preview: `Thinking… ${Math.round(n / 4)} tokens`, tokens: Math.round(n / 4) });
      }
    },
    onToken: (c, total) => {
      acc += c;
      onChars(total - counted);
      counted = total;
      const now = Date.now();
      if (now - last > 120) {
        last = now;
        emit({ t: "file", path: file.path, status: "working", agent: agent.id, preview: acc.slice(-420), tokens: Math.round(total / 4), tps: total / 4 / Math.max(0.05, (now - started) / 1000) });
      }
    },
  });
  onChars(-counted);
  account(res);
  const parsed = parseWorker(res.text, file.path);
  let code = parsed.code;
  for (const f of parsed.findings) emit({ t: "finding", finding: { ...f, path: file.path } });

  let checked: FileOutput["checked"] = "skip";
  if (req.mode === "migrate" || req.mode === "secure") {
    emit({ t: "file", path: file.path, status: "review", agent: agent.id, tokens: res.completionTokens, tps: res.tps });
    emit({ t: "agent", id: agent.id, state: "reviewing", file: file.path, note: "Running checks" });
    let r = checkCode(parsed.path, code);
    for (let attempt = 0; !r.ok && attempt < limits.fixes; attempt++) {
      emit({ t: "file", path: file.path, status: "fixing", agent: agent.id });
      emit({ t: "log", agent: agent.name, text: `${parsed.path} failed check (${r.error}). Fixing.` });
      const fx = await streamChat({ messages: fixerPrompt(parsed.path, code, r.error || ""), maxTokens: limits.maxTokens, signal, session: `${agent.id}-fix` });
      account(fx);
      code = fenced(fx.text) ?? code;
      r = checkCode(parsed.path, code);
    }
    checked = r.skipped ? "skip" : r.ok ? "pass" : "fail";
  }

  const output: FileOutput = { path: file.path, newPath: parsed.path, content: code, notes: parsed.notes, checked };
  emit({ t: "output", output, original: file.content });
  emit({ t: "file", path: file.path, status: checked === "fail" ? "failed" : "done", agent: agent.id, tokens: res.completionTokens, tps: res.tps });
  emit({ t: "log", agent: agent.name, text: `${file.path} done at ${Math.round(res.tps)} tok/s${checked === "pass" ? ". Check passed" : ""}` });
  return output;
}

// Output cap per file. Adds room for the model to think.
function capFor(file: RepoFile, mode: RunRequest["mode"]) {
  if (mode === "docs" || mode === "explore") return 2_500;
  return Math.ceil((file.content.length / 3.2) * 1.3) + 2_000;
}
