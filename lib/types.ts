export type Mode = "migrate" | "secure" | "docs" | "explore";

export type FileStatus = "queued" | "working" | "review" | "fixing" | "done" | "failed";
export type AgentState = "idle" | "thinking" | "working" | "reviewing" | "done" | "error";

export interface RepoFile {
  path: string;
  content: string;
  lang: string;
  size: number;
  group: string;
}

export interface AgentInfo {
  id: string;
  name: string;
  role: "scout" | "planner" | "worker" | "verifier" | "fixer" | "shipper";
  color: string;
}

export interface Finding {
  path: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
}

export interface FileOutput {
  path: string;
  newPath: string;
  content: string;
  notes: string;
  checked: "pass" | "fail" | "skip";
}

export interface RunRequest {
  source: "github" | "sample";
  repo?: string;
  mode: Mode;
  target: string;
  workers: number;
  saver?: "tiny" | "balanced" | "full";
  ghToken?: string; // set on the server from the session. Never trusted from the client.
}

export type SwarmEvent =
  | { t: "phase"; phase: "fetch" | "scout" | "plan" | "work" | "verify" | "ship" | "done"; label: string }
  | { t: "config"; live: boolean; model: string }
  | { t: "repo"; name: string; files: { path: string; lang: string; size: number; group: string }[] }
  | { t: "agents"; agents: AgentInfo[] }
  | { t: "agent"; id: string; state: AgentState; file?: string; note?: string }
  | { t: "file"; path: string; status: FileStatus; agent?: string; preview?: string; tokens?: number; tps?: number }
  | { t: "map"; summary: string; stack: string; order: string[]; plan: string[] }
  | { t: "output"; output: FileOutput; original: string }
  | { t: "finding"; finding: Finding }
  | { t: "log"; agent: string; text: string }
  | { t: "stats"; tokens: number; tps: number; peakTps: number; elapsedMs: number; calls: number; budget?: number }
  | { t: "done"; summary: string; prTitle: string; prBody: string; readme?: string }
  | { t: "error"; message: string };
