"use client";
import { useEffect, useState } from "react";

interface Status { live: boolean; model: string; base: string; effort: string | null; maxWorkers: number; maxFiles: number; github: boolean; signin: boolean }

export default function Settings() {
  const [s, setS] = useState<Status>();
  useEffect(() => {
    fetch("/api/status").then((r) => r.json()).then(setS);
  }, []);
  const rows: [string, string, boolean | null][] = s
    ? [
        ["Cerebras API key", s.live ? "Connected" : "Missing. Running in simulated mode", s.live],
        ["Model", s.model, null],
        ["API base", s.base, null],
        ["Reasoning effort", s.effort || "Not sent", null],
        ["Max agents", String(s.maxWorkers), null],
        ["Max files per repo", String(s.maxFiles), null],
        ["GitHub sign in", s.signin ? "On. Sign in is required" : "Off. Guest mode. Set GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET and SESSION_SECRET", s.signin],
        ["GitHub token for reading", s.github ? "Set" : "Not set. Fine for small repos", s.github],
      ]
    : [];
  return (
    <div className="studio">
      <div className="studio-head">
        <div>
          <span className="script">Setup</span>
          <h1>Settings</h1>
          <p style={{ color: "var(--muted)", margin: "6px 0 0" }}>These come from your .env.local file. Restart the server after you change them.</p>
        </div>
      </div>
      <div className="results" style={{ padding: 8, marginTop: 0 }}>
        {rows.map(([k, v, ok]) => (
          <div className="set-row" key={k}>
            <span>{k}</span>
            <b style={{ color: ok === false ? "#a66b00" : ok ? "#1d8f55" : "var(--ink)" }}>{v}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
