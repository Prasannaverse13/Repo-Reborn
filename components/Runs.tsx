"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { clearRuns, loadRuns, type RunRecord } from "@/lib/runs";

export default function Runs() {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  useEffect(() => {
    const load = () => setRuns(loadRuns());
    load();
    window.addEventListener("rr-runs", load);
    return () => window.removeEventListener("rr-runs", load);
  }, []);

  return (
    <div className="studio">
      <div className="studio-head">
        <div>
          <span className="script">History</span>
          <h1>Runs</h1>
        </div>
        {runs.length > 0 && <button className="btn btn-light btn-sm" onClick={clearRuns}>Clear history</button>}
      </div>
      <div className="results" style={{ padding: 18, marginTop: 0 }}>
        {runs.length === 0 ? (
          <div className="empty-state">
            <span className="script">Nothing yet</span>
            <p>Start your first swarm and it shows up here.</p>
            <Link href="/dashboard" className="btn btn-dark btn-sm">Start a swarm</Link>
          </div>
        ) : (
          <table className="runs">
            <thead>
              <tr><th>Repo</th><th>Mode</th><th>Files</th><th>Agents</th><th>Time</th><th>Peak swarm</th><th>Tokens</th><th>When</th></tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.repo}</b> {!r.live && <span className="chip">sim</span>}</td>
                  <td><span className="chip">{r.mode}</span></td>
                  <td>{r.files}</td>
                  <td>{r.agents}</td>
                  <td>{(r.elapsedMs / 1000).toFixed(1)}s</td>
                  <td><b>{Math.round(r.peakSwarm).toLocaleString()}</b> tok/s</td>
                  <td>{r.tokens.toLocaleString()}</td>
                  <td style={{ color: "var(--soft)" }}>{new Date(r.at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
