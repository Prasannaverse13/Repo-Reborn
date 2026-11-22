"use client";
import { useEffect, useState } from "react";

interface Run { prompt: string; tps: number; tokens: number; ms: number; model: string; at: number }

const PRESETS = [
  { name: "Count up", prompt: "Write the numbers from 1 to 2000 in words, one per line. No other text." },
  { name: "Long list", prompt: "List 600 short, made up product names, one per line, numbered. No other text." },
  { name: "Code dump", prompt: "Write a complete TypeScript file with 120 small pure utility functions, each with a one line JSDoc. Code only." },
];

export default function TpsLab() {
  const [prompt, setPrompt] = useState(PRESETS[0].prompt);
  const [system, setSystem] = useState("Answer with the requested text only. Never think out loud.");
  const [maxTokens, setMaxTokens] = useState(1500);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<Run & { text?: string }>();
  const [runs, setRuns] = useState<Run[]>([]);

  useEffect(() => {
    try {
      setRuns(JSON.parse(localStorage.getItem("rr-tps-runs") || "[]"));
    } catch {}
  }, []);

  async function go(times = 1) {
    setBusy(true);
    for (let i = 0; i < times; i++) {
      const r = await fetch("/api/tps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, system, maxTokens }),
      }).then((x) => x.json());
      if (r.error) break;
      const run: Run = { prompt, tps: r.tps, tokens: r.tokens, ms: r.ms, model: r.model, at: Date.now() };
      setLast({ ...run, text: r.text });
      setRuns((prev) => {
        const next = [run, ...prev].sort((a, b) => b.tps - a.tps).slice(0, 30);
        try {
          localStorage.setItem("rr-tps-runs", JSON.stringify(next));
        } catch {}
        return next;
      });
    }
    setBusy(false);
  }

  return (
    <div className="studio">
      <div className="studio-head">
        <div>
          <span className="script">Bounty</span>
          <h1>TPS Lab</h1>
          <p style={{ color: "var(--muted)", margin: "6px 0 0" }}>Find the prompt that runs the fastest tokens per second. Best runs stay on top.</p>
        </div>
      </div>
      <div className="tps-grid">
        <div className="panel" style={{ display: "grid", gap: 12 }}>
          <div className="seg">
            {PRESETS.map((p) => (
              <button key={p.name} className={prompt === p.prompt ? "on" : ""} onClick={() => setPrompt(p.prompt)}>{p.name}</button>
            ))}
          </div>
          <textarea className="input" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <input className="input" value={system} onChange={(e) => setSystem(e.target.value)} placeholder="System prompt" />
          <label className="range">
            Max tokens <b style={{ color: "var(--ink)" }}>{maxTokens}</b>
            <input type="range" min={300} max={8000} step={100} value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} />
          </label>
          <div className="launch-row">
            <button className="btn btn-dark" onClick={() => go(1)} disabled={busy}>{busy ? "Running" : "Run once"}</button>
            <button className="btn btn-light" onClick={() => go(3)} disabled={busy}>Run 3 times</button>
          </div>
        </div>
        <div className="gauge">
          <div>
            <b>{last ? Math.round(last.tps).toLocaleString() : "0"}</b>
            <span>tokens per second</span>
            {last && (
              <p style={{ color: "#aaa", fontSize: 14 }}>
                {last.tokens.toLocaleString()} tokens in {(last.ms / 1000).toFixed(2)}s on {last.model}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="results" style={{ padding: 18 }}>
        <b>Best runs</b>
        <table className="runs">
          <thead>
            <tr><th>#</th><th>tok/s</th><th>tokens</th><th>time</th><th>prompt</th></tr>
          </thead>
          <tbody>
            {runs.map((r, i) => (
              <tr key={r.at}>
                <td>{i + 1}</td>
                <td><b>{Math.round(r.tps).toLocaleString()}</b></td>
                <td>{r.tokens.toLocaleString()}</td>
                <td>{(r.ms / 1000).toFixed(2)}s</td>
                <td style={{ color: "var(--muted)", maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.prompt}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {last?.text && <pre className="md" style={{ marginTop: 14, maxHeight: 220 }}>{last.text}</pre>}
      </div>
    </div>
  );
}
