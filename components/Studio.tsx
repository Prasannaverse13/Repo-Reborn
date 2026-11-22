"use client";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import JSZip from "jszip";
import SwarmBoard, { type AgentView, type FileView } from "./SwarmBoard";
import type { FileOutput, Finding, Mode, SwarmEvent } from "@/lib/types";
import { saveRun } from "@/lib/runs";

const TARGETS = [
  "Modern TypeScript + React + Node",
  "Python 3.12 with type hints",
  "ES2023 JavaScript modules",
  "Next.js App Router",
  "Go",
  "Rust",
];
const MODES: { k: Mode; label: string }[] = [
  { k: "migrate", label: "Migrate" },
  { k: "secure", label: "Secure" },
  { k: "docs", label: "Docs" },
  { k: "explore", label: "Explore" },
];
const SAVERS: { k: "tiny" | "balanced" | "full"; label: string; hint: string }[] = [
  { k: "tiny", label: "Tiny", hint: "Credit saver · 8 files · 30k tokens max" },
  { k: "balanced", label: "Balanced", hint: "15 files · 80k tokens max" },
  { k: "full", label: "Full", hint: "60 files · 400k tokens max" },
];
const PHASES = ["fetch", "scout", "plan", "work", "verify", "ship", "done"] as const;

interface State {
  live?: boolean;
  model?: string;
  repoName?: string;
  phase?: string;
  phaseLabel: string;
  files: Record<string, FileView>;
  order: string[];
  agents: AgentView[];
  logs: { agent: string; text: string; at: number }[];
  outputs: Record<string, FileOutput>;
  originals: Record<string, string>;
  findings: Finding[];
  stats: { tokens: number; tps: number; peakTps: number; elapsedMs: number; calls: number; budget?: number };
  summary?: string;
  map?: { summary: string; stack: string; plan: string[] };
  done?: { summary: string; prTitle: string; prBody: string; readme?: string };
  error?: string;
}

const empty = (): State => ({
  phaseLabel: "",
  files: {},
  order: [],
  agents: [],
  logs: [],
  outputs: {},
  originals: {},
  findings: [],
  stats: { tokens: 0, tps: 0, peakTps: 0, elapsedMs: 0, calls: 0 },
});

function apply(s: State, e: SwarmEvent): State {
  switch (e.t) {
    case "config":
      return { ...s, live: e.live, model: e.model };
    case "phase":
      return { ...s, phase: e.phase, phaseLabel: e.label };
    case "repo": {
      const files: Record<string, FileView> = {};
      for (const f of e.files) files[f.path] = { ...f, status: "queued" };
      return { ...s, repoName: e.name, files, order: e.files.map((f) => f.path) };
    }
    case "agents":
      return { ...s, agents: e.agents.map((a) => ({ ...a, state: "idle" })) };
    case "agent":
      return { ...s, agents: s.agents.map((a) => (a.id === e.id ? { ...a, state: e.state, file: e.file, note: e.note } : a)) };
    case "file": {
      const cur = s.files[e.path];
      if (!cur) return s;
      return {
        ...s,
        files: {
          ...s.files,
          [e.path]: {
            ...cur,
            status: e.status,
            agent: e.agent ?? cur.agent,
            preview: e.preview ?? cur.preview,
            tokens: e.tokens ?? cur.tokens,
            tps: e.tps ?? cur.tps,
          },
        },
      };
    }
    case "map":
      return { ...s, map: { summary: e.summary, stack: e.stack, plan: e.plan } };
    case "output":
      return {
        ...s,
        outputs: { ...s.outputs, [e.output.path]: e.output },
        originals: { ...s.originals, [e.output.path]: e.original },
      };
    case "finding":
      return { ...s, findings: [...s.findings, e.finding] };
    case "log":
      return { ...s, logs: [{ agent: e.agent, text: e.text, at: Date.now() }, ...s.logs].slice(0, 120) };
    case "stats":
      return { ...s, stats: { tokens: e.tokens, tps: e.tps, peakTps: e.peakTps, elapsedMs: e.elapsedMs, calls: e.calls, budget: e.budget } };
    case "done":
      return { ...s, done: { summary: e.summary, prTitle: e.prTitle, prBody: e.prBody, readme: e.readme } };
    case "error":
      return { ...s, error: e.message };
  }
}

// Run state lives at module level so it survives page changes inside the app.
type Form = { repo: string; useSample: boolean; mode: Mode; target: string; workers: number; saver: "tiny" | "balanced" | "full" };
const EMPTY = empty();
const store = {
  st: EMPTY,
  running: false,
  ctrl: null as AbortController | null,
  queue: [] as SwarmEvent[],
  timer: null as ReturnType<typeof setInterval> | null,
  peak: 0,
  saved: "",
  listeners: new Set<() => void>(),
};
const notify = () => store.listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  store.listeners.add(l);
  return () => store.listeners.delete(l);
};
function pump() {
  if (!store.queue.length) return;
  const batch = store.queue;
  store.queue = [];
  store.st = batch.reduce(apply, store.st);
  notify();
}

async function startRun(f: Form) {
  store.ctrl?.abort();
  const ctrl = new AbortController();
  store.ctrl = ctrl;
  store.queue = [];
  store.st = empty();
  store.peak = 0;
  store.running = true;
  notify();
  if (!store.timer) store.timer = setInterval(pump, 80);
  try {
    const res = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: f.useSample ? "sample" : "github", repo: f.repo, mode: f.mode, target: f.target, workers: f.workers, saver: f.saver }),
      signal: ctrl.signal,
    });
    if (!res.body) throw new Error("No stream");
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() || "";
      for (const p of parts) {
        const line = p.trim();
        if (line.startsWith("data:")) {
          try {
            store.queue.push(JSON.parse(line.slice(5)));
          } catch {}
        }
      }
    }
  } catch (e) {
    if (!ctrl.signal.aborted) store.queue.push({ t: "error", message: (e as Error).message });
  } finally {
    pump();
    if (store.ctrl === ctrl) {
      store.running = false;
      notify();
    }
  }
}

function stopRun() {
  store.ctrl?.abort();
  store.running = false;
  notify();
}

// Keeps form choices when the person leaves this page and comes back.
const mem = new Map<string, unknown>();
function usePersist<T>(key: string, init: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => (mem.has(key) ? (mem.get(key) as T) : init));
  const set = useCallback(
    (n: T) => {
      mem.set(key, n);
      setV(n);
    },
    [key]
  );
  return [v, set];
}

export default function Studio({ sample }: { sample: boolean }) {
  const [repo, setRepo] = usePersist("repo", "");
  const [useSample, setUseSample] = usePersist("useSample", sample);
  const [mode, setMode] = usePersist<Mode>("mode", "migrate");
  const [target, setTarget] = usePersist("target", TARGETS[0]);
  const [workers, setWorkers] = usePersist("workers", 6);
  const [saver, setSaver] = usePersist<"tiny" | "balanced" | "full">("saver", "tiny");
  const [selected, setSelected] = usePersist<string | undefined>("selected", undefined);
  const [tab, setTab] = usePersist<"diff" | "findings" | "docs" | "ask" | "ship">("tab", "diff");
  const st = useSyncExternalStore(subscribe, () => store.st, () => EMPTY);
  const running = useSyncExternalStore(subscribe, () => store.running, () => false);
  const [myRepos, setMyRepos] = useState<{ name: string; private: boolean; push: boolean }[]>([]);
  useEffect(() => {
    fetch("/api/auth/repos").then((r) => r.json()).then((j) => setMyRepos(j.repos || [])).catch(() => {});
  }, []);
  useEffect(() => {
    if (sample) setUseSample(true);
  }, [sample]); // eslint-disable-line react-hooks/exhaustive-deps

  function start() {
    if (!useSample && !repo.trim()) return;
    setSelected(undefined);
    setTab(mode === "secure" ? "findings" : mode === "explore" ? "ask" : mode === "docs" ? "docs" : "diff");
    startRun({ repo, useSample, mode, target, workers, saver });
  }
  const stop = stopRun;

  const files = useMemo(() => st.order.map((p) => st.files[p]).filter(Boolean), [st.order, st.files]);
  const liveSwarm = files.reduce((n, f) => n + (f.status === "working" ? f.tps || 0 : 0), 0);
  if (!st.repoName) store.peak = 0;
  store.peak = Math.max(store.peak, liveSwarm);
  const swarmShown = running && liveSwarm > 0 ? liveSwarm : store.peak;
  const phaseIdx = PHASES.indexOf((st.phase as (typeof PHASES)[number]) || "fetch");
  const outputs = Object.values(st.outputs);
  const sel = selected && st.outputs[selected] ? selected : outputs[0]?.path;

  useEffect(() => {
    if (!st.done || !st.repoName) return;
    const id = `${st.repoName}-${st.done.summary}`;
    if (store.saved === id) return;
    store.saved = id;
    saveRun({
      id: String(Date.now()),
      repo: st.repoName,
      mode,
      files: Object.keys(st.outputs).length,
      tokens: st.stats.tokens,
      peakSwarm: store.peak,
      peakAgent: st.stats.peakTps,
      elapsedMs: st.stats.elapsedMs,
      agents: st.agents.filter((a) => a.role === "worker").length,
      live: Boolean(st.live),
      at: Date.now(),
    });
  }, [st.done]); // eslint-disable-line react-hooks/exhaustive-deps

  async function downloadZip() {
    const zip = new JSZip();
    for (const o of outputs) zip.file(o.newPath, o.content);
    if (st.done?.readme) zip.file("README.md", st.done.readme);
    if (st.done) zip.file("REBORN_PR.md", `# ${st.done.prTitle}\n\n${st.done.prBody}`);
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(st.repoName || "repo").replace(/\//g, "-")}-reborn.zip`;
    a.click();
  }

  return (
    <div className="studio" id="swarm">
      <div className="studio-head">
        <div>
          <span className="script">Core workflow</span>
          <h2 className="h2">Start a swarm</h2>
        </div>
        {st.live !== undefined && (
          <span className={`pill-badge ${st.live ? "" : "sim"}`}>
            <i /> {st.live ? `Live · ${st.model}` : "Simulated · add CEREBRAS_API_KEY"}
          </span>
        )}
      </div>

      <div className="launch">
        <div className="launch-row">
          <div className="field">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#696969"><path d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0C17 5 18 5.3 18 5.3c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5z" /></svg>
            <input
              list="my-repos"
              placeholder={useSample ? "Using the old shop demo repo" : myRepos.length ? "Pick one of your repos or paste a link" : "github.com/owner/repo"}
              value={useSample ? "" : repo}
              disabled={useSample}
              onChange={(e) => setRepo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !running && start()}
            />
            <datalist id="my-repos">
              {myRepos.map((r) => <option key={r.name} value={r.name}>{r.private ? "private" : "public"}</option>)}
            </datalist>
          </div>
          <button className={`btn ${useSample ? "btn-dark" : "btn-light"} btn-sm`} onClick={() => setUseSample(!useSample)}>
            {useSample ? "Demo repo on" : "Use demo repo"}
          </button>
          {running ? (
            <button className="btn btn-light" onClick={stop}>Stop</button>
          ) : (
            <button className="btn btn-dark" onClick={start} disabled={!useSample && !repo.trim()}>Start swarm</button>
          )}
        </div>
        <div className="launch-row">
          <div className="seg">
            {MODES.map((m) => (
              <button key={m.k} className={mode === m.k ? "on" : ""} onClick={() => setMode(m.k)}>{m.label}</button>
            ))}
          </div>
          {mode === "migrate" && (
            <select className="select" value={target} onChange={(e) => setTarget(e.target.value)}>
              {TARGETS.map((t) => <option key={t}>{t}</option>)}
            </select>
          )}
          <div className="seg" title="Credit saver">
            {SAVERS.map((x) => (
              <button key={x.k} className={saver === x.k ? "on" : ""} onClick={() => setSaver(x.k)}>{x.label}</button>
            ))}
          </div>
          <span className="saver-hint">{SAVERS.find((x) => x.k === saver)?.hint}</span>
          <label className="range">
            Agents <b style={{ color: "var(--ink)" }}>{workers}</b>
            <input type="range" min={2} max={20} value={workers} onChange={(e) => setWorkers(Number(e.target.value))} />
          </label>
        </div>
      </div>

      {st.error && <div className="err">{st.error}</div>}

      <div className="hud">
        <div className="stat big"><b>{Math.round(swarmShown).toLocaleString()}</b><span>{running ? "live swarm tok/s" : "peak swarm tok/s"}</span></div>
        <div className="stat"><b>{Math.round(st.stats.peakTps).toLocaleString()}</b><span>peak agent tok/s</span></div>
        <div className="stat"><b>{st.stats.tokens.toLocaleString()}</b><span>{st.stats.budget ? `tokens of ${st.stats.budget.toLocaleString()} cap` : "tokens written"}</span></div>
        <div className="stat"><b>{(st.stats.elapsedMs / 1000).toFixed(1)}s</b><span>elapsed</span></div>
        <div className="stat"><b>{st.stats.calls}</b><span>model calls · {Math.round(st.stats.tps).toLocaleString()} avg tok/s</span></div>
      </div>

      <div className="phases">
        {PHASES.map((p, i) => (
          <span key={p} className={st.phase ? (i < phaseIdx || st.phase === "done" ? "past" : i === phaseIdx ? "on" : "") : ""}>
            {p}
          </span>
        ))}
      </div>

      <div className="board-wrap">
        <SwarmBoard
          files={files}
          agents={st.agents}
          phaseLabel={st.phaseLabel}
          running={running}
          tps={swarmShown}
          selected={sel}
          onSelect={(p) => {
            setSelected(p);
            setTab("diff");
          }}
        />
        <div className="side">
          <div className="panel">
            <h4>Agents <span>{st.agents.length}</span></h4>
            <div className="roster">
              {st.agents.map((a) => (
                <div className="ag" key={a.id}>
                  <div className="av" style={{ background: a.color }}>{a.name[0]}</div>
                  <div className="meta">
                    <b>{a.name}</b> <span style={{ color: "var(--soft)", fontSize: 11 }}>{a.role}</span>
                    <div>{a.note || "Waiting"}</div>
                  </div>
                  <span className={`st ${a.state}`}>{a.state}</span>
                </div>
              ))}
              {!st.agents.length && <div style={{ color: "var(--soft)", fontSize: 13 }}>The team shows up here.</div>}
            </div>
          </div>
          <div className="panel">
            <h4>Hive log <span>{st.logs.length}</span></h4>
            <div className="log">
              {st.logs.map((l, i) => (
                <div key={i}><b>{l.agent}</b> {l.text}</div>
              ))}
              {st.map && (
                <div>
                  <b>Plan</b> {st.map.plan.join(" · ")}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {st.done && (
        <div className="done-banner">
          <span>✓ {st.done.summary}</span>
          <button className="btn btn-dark btn-sm" onClick={downloadZip}>Download new repo</button>
        </div>
      )}

      {(outputs.length > 0 || st.done) && (
        <div className="results">
          <div className="tabs">
            <button className={tab === "diff" ? "on" : ""} onClick={() => setTab("diff")}>Before and after</button>
            <button className={tab === "findings" ? "on" : ""} onClick={() => setTab("findings")}>Findings ({st.findings.length})</button>
            <button className={tab === "docs" ? "on" : ""} onClick={() => setTab("docs")}>Docs and README</button>
            <button className={tab === "ask" ? "on" : ""} onClick={() => setTab("ask")}>Ask the repo</button>
            <button className={tab === "ship" ? "on" : ""} onClick={() => setTab("ship")}>Ship</button>
          </div>
          <div className="tab-body">
            {tab === "diff" && (
              <div className="diff">
                <div className="flist">
                  {outputs.map((o) => (
                    <button key={o.path} className={sel === o.path ? "on" : ""} onClick={() => setSelected(o.path)}>
                      <span>{o.path}</span>
                      <em style={{ color: o.checked === "pass" ? "#1d8f55" : o.checked === "fail" ? "#c0392b" : "#a3a3a3" }}>
                        {o.checked === "pass" ? "✓" : o.checked === "fail" ? "✕" : "·"}
                      </em>
                    </button>
                  ))}
                </div>
                {sel && st.outputs[sel] ? (
                  <>
                    <div>
                      <div className="code-h"><span>Before · {sel}</span></div>
                      <pre className="code">{st.originals[sel]}</pre>
                    </div>
                    <div>
                      <div className="code-h"><span>After · {st.outputs[sel].newPath}</span><span>{st.outputs[sel].notes}</span></div>
                      <pre className="code">{st.outputs[sel].content}</pre>
                    </div>
                  </>
                ) : (
                  <div style={{ color: "var(--soft)" }}>Files show up here as agents finish them.</div>
                )}
              </div>
            )}
            {tab === "findings" && (
              <div className="find">
                {st.findings.length === 0 && <div style={{ color: "var(--soft)" }}>No findings yet. Run Secure mode for a full audit.</div>}
                {[...st.findings]
                  .sort((a, b) => ["high", "medium", "low"].indexOf(a.severity) - ["high", "medium", "low"].indexOf(b.severity))
                  .map((f, i) => (
                    <div className="find-item" key={i}>
                      <span className={`sev ${f.severity}`}>{f.severity}</span>
                      <div>
                        <b>{f.title}</b> <span className="mono" style={{ color: "var(--soft)", fontSize: 12 }}>{f.path}</span>
                        <div style={{ color: "var(--muted)" }}>{f.detail}</div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
            {tab === "docs" && (
              <div style={{ display: "grid", gap: 14 }}>
                {st.map && (
                  <pre className="md">{`What it is\n${st.map.summary}\n\nStack\n${st.map.stack}`}</pre>
                )}
                {st.done?.readme && <pre className="md">{st.done.readme}</pre>}
                {(mode === "docs" || mode === "explore") &&
                  outputs.map((o) => <pre className="md" key={o.path}>{o.content}</pre>)}
                {!st.map && <div style={{ color: "var(--soft)" }}>Run Docs mode for docs on every file.</div>}
              </div>
            )}
            {tab === "ask" && <Ask summary={st.map?.summary || ""} originals={st.originals} />}
            {tab === "ship" && (
              <Ship
                repo={useSample ? "" : repo}
                canPush={myRepos.find((r) => repo.includes(r.name))?.push}
                title={st.done?.prTitle || ""}
                body={st.done?.prBody || ""}
                files={outputs.map((o) => ({ path: o.newPath, content: o.content }))}
                onZip={downloadZip}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Ask({ summary, originals }: { summary: string; originals: Record<string, string> }) {
  const [q, setQ] = useState("");
  const [msgs, setMsgs] = useState<{ q: string; a: string; meta?: string }[]>([]);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!q.trim()) return;
    const question = q;
    setQ("");
    setBusy(true);
    const words = question.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
    const ranked = Object.entries(originals)
      .map(([path, content]) => {
        const hay = (path + " " + content).toLowerCase();
        const score = words.reduce((n, w) => n + (hay.split(w).length - 1) + (path.toLowerCase().includes(w) ? 5 : 0), 0);
        return { path, content, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    try {
      const r = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, summary, files: ranked.map(({ path, content }) => ({ path, content })) }),
      }).then((x) => x.json());
      setMsgs((m) => [...m, { q: question, a: r.answer || r.error, meta: r.tps ? `${Math.round(r.tps)} tok/s · ${(r.ms / 1000).toFixed(2)}s` : "" }]);
    } catch (e) {
      setMsgs((m) => [...m, { q: question, a: (e as Error).message }]);
    }
    setBusy(false);
  }

  return (
    <div className="chat">
      {!Object.keys(originals).length && <div style={{ color: "var(--soft)" }}>Run any mode first. Explore mode is best for this.</div>}
      {msgs.map((m, i) => (
        <div key={i} style={{ display: "grid", gap: 8 }}>
          <div className="msg q">{m.q}</div>
          <div className="msg a">{m.a}{m.meta && <small>{m.meta}</small>}</div>
        </div>
      ))}
      <div className="launch-row">
        <div className="field">
          <input placeholder="Where does login happen? What would break if I remove jQuery?" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        </div>
        <button className="btn btn-dark" onClick={send} disabled={busy || !Object.keys(originals).length}>{busy ? "Thinking" : "Ask"}</button>
      </div>
    </div>
  );
}

function Ship(props: { canPush?: boolean; repo: string; title: string; body: string; files: { path: string; content: string }[]; onZip: () => void }) {
  const [token, setToken] = useState("");
  const [repo, setRepo] = useState(props.repo);
  const [title, setTitle] = useState(props.title);
  const [body, setBody] = useState(props.body);
  const [res, setRes] = useState<{ url?: string; error?: string }>();
  const [busy, setBusy] = useState(false);
  const [who, setWho] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((j) => setWho(j.user?.login || null)).catch(() => {});
  }, []);
  useEffect(() => setRepo(props.repo), [props.repo]);
  useEffect(() => setTitle(props.title), [props.title]);
  useEffect(() => setBody(props.body), [props.body]);

  async function openPr() {
    setBusy(true);
    setRes(undefined);
    const r = await fetch("/api/ship", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo, token, title, body, files: props.files }),
    }).then((x) => x.json());
    setRes(r);
    setBusy(false);
  }

  return (
    <div className="ship-grid">
      <div style={{ display: "grid", gap: 10 }}>
        <b>Open a pull request</b>
        <span style={{ color: "var(--muted)", fontSize: 14 }}>
          {who ? `Signed in as @${who}. You need write access to the repo. For other people's repos fork them first.` : "Sign in with GitHub or paste a token with write access. A pasted token is sent once and never saved."}
        </span>
        {props.canPush === false && <div className="err" style={{ margin: 0 }}>You only have read access to this repo. Fork it first.</div>}
        <input className="input" placeholder="github.com/owner/repo" value={repo} onChange={(e) => setRepo(e.target.value)} />
        {!who && <input className="input" type="password" placeholder="GitHub token (or sign in)" value={token} onChange={(e) => setToken(e.target.value)} />}
        <input className="input" placeholder="PR title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className="btn btn-dark" onClick={openPr} disabled={busy || (!token && !who) || !repo || !props.files.length}>
          {busy ? "Opening PR" : "Open pull request"}
        </button>
        <button className="btn btn-light" onClick={props.onZip} disabled={!props.files.length}>Download as zip</button>
        {res?.url && <a className="done-banner" href={res.url} target="_blank" rel="noreferrer">PR opened. View it on GitHub</a>}
        {res?.error && <div className="err">{res.error}</div>}
      </div>
      <div>
        <b style={{ display: "block", marginBottom: 10 }}>PR body</b>
        <textarea className="input" style={{ minHeight: 320 }} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
    </div>
  );
}
