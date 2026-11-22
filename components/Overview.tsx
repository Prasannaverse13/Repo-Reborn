"use client";
import { useEffect, useState } from "react";
import { loadRuns, type RunRecord } from "@/lib/runs";

export default function Overview() {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  useEffect(() => {
    const load = () => setRuns(loadRuns());
    load();
    window.addEventListener("rr-runs", load);
    return () => window.removeEventListener("rr-runs", load);
  }, []);

  const files = runs.reduce((n, r) => n + r.files, 0);
  const tokens = runs.reduce((n, r) => n + r.tokens, 0);
  const best = runs.reduce((n, r) => Math.max(n, r.peakSwarm), 0);
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="overview">
      <div className="ov-head">
        <div>
          <span className="script">{hello}!</span>
          <h1>Your swarm dashboard</h1>
          <p>Paste a repo below and watch the agents work. Every run lands in your history.</p>
        </div>
      </div>
      <div className="ov-kpis">
        <div className="stat"><span>Runs</span><b>{runs.length}</b></div>
        <div className="stat"><span>Files reborn</span><b>{files.toLocaleString()}</b></div>
        <div className="stat"><span>Tokens written</span><b>{tokens.toLocaleString()}</b></div>
        <div className="stat"><span>Best swarm speed</span><b>{Math.round(best).toLocaleString()}<small> tok/s</small></b></div>
      </div>
    </div>
  );
}
