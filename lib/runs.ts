export interface RunRecord {
  id: string;
  repo: string;
  mode: string;
  files: number;
  tokens: number;
  peakSwarm: number;
  peakAgent: number;
  elapsedMs: number;
  agents: number;
  live: boolean;
  at: number;
}

const KEY = "rr-runs";

export function loadRuns(): RunRecord[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveRun(r: RunRecord) {
  try {
    const next = [r, ...loadRuns()].slice(0, 50);
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("rr-runs"));
  } catch {}
}

export function clearRuns() {
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("rr-runs"));
  } catch {}
}
