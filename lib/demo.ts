// Simulated swarm. Used when no CEREBRAS_API_KEY is set so the UI can be built and filmed.
import type { AgentInfo, Finding, RepoFile, RunRequest, SwarmEvent } from "./types";

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((res, rej) => {
    const t = setTimeout(res, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      rej(new Error("aborted"));
    });
  });

function newPathFor(path: string, req: RunRequest) {
  if (req.mode === "docs") return `docs/${path}.md`;
  if (req.mode === "explore") return `notes/${path}.md`;
  if (req.mode === "secure") return path;
  const t = req.target.toLowerCase();
  if (t.includes("python")) return path.replace(/\.(py)$/, ".py");
  if (t.includes("typescript") || t.includes("next")) {
    if (path.endsWith(".php")) return path.replace(/^api\//, "server/").replace(/\.php$/, ".ts");
    if (path.endsWith(".js")) return path.replace(/\.js$/, ".ts");
    if (path.endsWith(".html")) return path.replace(/\.html$/, ".tsx");
  }
  return path;
}

function fakeOutput(f: RepoFile, req: RunRequest) {
  if (req.mode === "docs" || req.mode === "explore") {
    return `# ${f.path}\n\n**Purpose.** Handles ${f.group === "root" ? "app setup" : f.group} logic.\n\n## Key parts\n- ${f.content.split("\n").filter((l) => /function|def |class |\$\w+ =/.test(l)).slice(0, 4).map((l) => "`" + l.trim().slice(0, 60) + "`").join("\n- ") || "Static content"}\n\n## Notes\n- Simulated output. Add CEREBRAS_API_KEY for real docs.\n`;
  }
  let c = f.content
    .replace(/\bvar\s+/g, "const ")
    .replace(/print "([^"]*)"(.*)$/gm, 'print(f"$1"$2)')
    .replace(/except (\w+), (\w+):/g, "except $1 as $2:")
    .replace(/urllib2/g, "urllib.request")
    .replace(/raw_input/g, "input")
    .replace(/mysql_query\(/g, "db.query(")
    .replace(/\$\.ajax\(/g, "await fetchJson(");
  c = `// Reborn by the swarm (simulated). Add CEREBRAS_API_KEY for real output.\n${c}`;
  if (f.lang === "python") c = c.replace(/^\/\/ /, "# ");
  if (f.lang === "css") c = c.replace(/^\/\/ (.*)$/m, "/* $1 */");
  if (f.lang === "json") c = f.content;
  return c;
}

function fakeFindings(f: RepoFile): Finding[] {
  const out: Finding[] = [];
  if (/mysql_query\([^)]*\$/.test(f.content) || /\$_(GET|POST)\[[^\]]+\][\s\S]*mysql_query/.test(f.content))
    out.push({ path: f.path, severity: "high", title: "SQL injection", detail: "User input is joined into SQL. Use prepared statements." });
  if (/root123|dbPass/.test(f.content))
    out.push({ path: f.path, severity: "high", title: "Hardcoded secret", detail: "Database password is in source. Move it to env vars." });
  if (/md5\(/.test(f.content)) out.push({ path: f.path, severity: "medium", title: "Weak hash", detail: "md5 is not safe for passwords. Use bcrypt or argon2." });
  if (/\.html\(.*\+/.test(f.content) || /html \+= /.test(f.content))
    out.push({ path: f.path, severity: "medium", title: "XSS risk", detail: "Data is written as raw HTML. Escape it or use textContent." });
  if (/UPDATE .*%s/.test(f.content)) out.push({ path: f.path, severity: "high", title: "SQL injection", detail: "String formatting builds SQL. Use parameters." });
  return out;
}

export async function runDemo(
  req: RunRequest,
  name: string,
  files: RepoFile[],
  agents: AgentInfo[],
  emit: (e: SwarmEvent) => void,
  signal: AbortSignal
) {
  const t0 = Date.now();
  let tokens = 0;
  let peak = 0;
  let calls = 0;
  const timer = setInterval(() => {
    const el = Date.now() - t0;
    emit({ t: "stats", tokens, tps: tokens / Math.max(0.5, el / 1000), peakTps: peak, elapsedMs: el, calls });
  }, 200);

  try {
    emit({ t: "phase", phase: "scout", label: "Scout is mapping the repo" });
    emit({ t: "agent", id: "scout", state: "thinking", note: `Reading ${files.length} files` });
    await sleep(1400, signal);
    tokens += 900;
    calls++;
    emit({ t: "agent", id: "scout", state: "done", note: "Mapped in 1.4s" });
    const summary = `${name} is a small web app with ${files.length} files across ${new Set(files.map((f) => f.group)).size} folders.`;
    emit({ t: "log", agent: "Scout", text: summary });

    emit({ t: "phase", phase: "plan", label: "Maestro is splitting the work" });
    emit({ t: "agent", id: "planner", state: "thinking", note: "Writing swarm rules" });
    await sleep(900, signal);
    const plan = ["Keep behaviour the same", "Use modern safe APIs", "No secrets in code", "Typed inputs and outputs", "Small pure functions"];
    const order = [...files].sort((a, b) => a.size - b.size).map((f) => f.path);
    emit({ t: "map", summary, stack: "jQuery, PHP 5, Python 2", order, plan });
    const workers = agents.filter((a) => a.role === "worker");
    emit({ t: "agent", id: "planner", state: "done", note: `${order.length} tasks for ${workers.length} agents` });
    emit({ t: "log", agent: "Maestro", text: `Plan ready. ${plan.length} rules. ${order.length} files queued.` });

    emit({ t: "phase", phase: "work", label: "Swarm is working" });
    const byPath = new Map(files.map((f) => [f.path, f]));
    const queue = order.map((p) => byPath.get(p)!);
    const notes: string[] = [];

    await Promise.all(
      workers.map(async (agent, wi) => {
        await sleep(wi * 120, signal);
        while (queue.length) {
          const f = queue.shift()!;
          const newPath = newPathFor(f.path, req);
          const content = fakeOutput(f, req);
          emit({ t: "agent", id: agent.id, state: "working", file: f.path, note: `Rewriting ${f.path}` });
          emit({ t: "file", path: f.path, status: "working", agent: agent.id });
          const tps = 1400 + Math.random() * 1600;
          peak = Math.max(peak, tps);
          const steps = 8 + Math.floor(Math.random() * 6);
          const totalTok = Math.round(content.length / 3.5);
          for (let s = 1; s <= steps; s++) {
            await sleep(110 + Math.random() * 90, signal);
            const part = content.slice(0, Math.floor((content.length * s) / steps));
            tokens += Math.round(totalTok / steps);
            emit({ t: "file", path: f.path, status: "working", agent: agent.id, preview: part.slice(-420), tokens: Math.round((totalTok * s) / steps), tps });
          }
          calls++;
          for (const fd of req.mode === "secure" || req.mode === "migrate" ? fakeFindings(f) : []) emit({ t: "finding", finding: fd });
          let checked: "pass" | "skip" = "skip";
          if (req.mode === "migrate" || req.mode === "secure") {
            emit({ t: "file", path: f.path, status: "review", agent: agent.id });
            emit({ t: "agent", id: agent.id, state: "reviewing", file: f.path, note: "Running checks" });
            await sleep(250, signal);
            if (Math.random() < 0.18) {
              emit({ t: "file", path: f.path, status: "fixing", agent: agent.id });
              emit({ t: "log", agent: agent.name, text: `${newPath} failed check. Fixing.` });
              await sleep(600, signal);
              tokens += 300;
              calls++;
            }
            checked = ["javascript", "typescript", "json", "python"].includes(f.lang) ? "pass" : "skip";
          }
          emit({ t: "output", output: { path: f.path, newPath, content, notes: "Modernized (simulated)", checked }, original: f.content });
          emit({ t: "file", path: f.path, status: "done", agent: agent.id, tokens: totalTok, tps });
          emit({ t: "log", agent: agent.name, text: `${f.path} done at ${Math.round(tps)} tok/s` });
          notes.push(`- \`${f.path}\` to \`${newPath}\``);
        }
        emit({ t: "agent", id: agent.id, state: "done", note: "Queue empty" });
      })
    );

    emit({ t: "phase", phase: "verify", label: "Checks complete" });
    emit({ t: "log", agent: "Verifier", text: "All files passed syntax checks (simulated)." });
    emit({ t: "phase", phase: "ship", label: "Shipper is writing the PR" });
    emit({ t: "agent", id: "ship", state: "thinking", note: "Writing PR" });
    await sleep(700, signal);
    emit({ t: "agent", id: "ship", state: "done", note: "PR ready" });
    const el = Date.now() - t0;
    emit({ t: "stats", tokens, tps: tokens / (el / 1000), peakTps: peak, elapsedMs: el, calls });
    emit({ t: "phase", phase: "done", label: "Done" });
    emit({
      t: "done",
      summary: `${files.length} files in ${(el / 1000).toFixed(1)}s with ${workers.length} agents. Simulated run.`,
      prTitle: `Repo Reborn: ${req.mode} ${name}`,
      prBody: `## Repo Reborn\n\nMode: **${req.mode}**. Target: **${req.target}**.\n\n### Files\n${notes.join("\n")}\n\n_Simulated run. Add CEREBRAS_API_KEY for real output._`,
      readme: req.mode === "docs" ? `# ${name}\n\nSimulated README. Add CEREBRAS_API_KEY for a real one.` : undefined,
    });
  } finally {
    clearInterval(timer);
  }
}
