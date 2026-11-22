import type { Mode, RepoFile } from "./types";

export const AGENT_NAMES = [
  "Nova", "Pixel", "Echo", "Bolt", "Iris", "Juno", "Kite", "Lumen", "Mako", "Onyx",
  "Rune", "Sol", "Vega", "Wren", "Zed", "Flux", "Halo", "Quill", "Taro", "Yuki",
  "Ash", "Brio", "Cove", "Dash",
];
export const AGENT_COLORS = [
  "#3898EC", "#F26B5B", "#2EB872", "#F5A623", "#9B6BF2", "#14B8C4", "#E85D9A", "#6C7A89",
  "#FF8A3D", "#3B40AF", "#00A884", "#D9479B",
];

export const TARGETS = [
  "Modern TypeScript + React + Node",
  "Python 3.12 with type hints",
  "ES2023 JavaScript modules",
  "Next.js App Router",
  "Go",
  "Rust",
];

export function scoutPrompt(name: string, files: RepoFile[], mode: Mode, target: string) {
  let budget = 15_000;
  const parts: string[] = [];
  for (const f of files) {
    const head = f.content.split("\n").slice(0, 12).join("\n");
    const block = `--- ${f.path} (${f.lang}, ${f.size} chars)\n${head}`;
    if (budget - block.length < 0) {
      parts.push(`--- ${f.path} (${f.lang})`);
      continue;
    }
    budget -= block.length;
    parts.push(block);
  }
  return [
    {
      role: "system" as const,
      content:
        "You are Scout, the first agent in a code swarm. You read a repo fast and map it. Reply with JSON only.",
    },
    {
      role: "user" as const,
      content: `Repo: ${name}\nMode: ${mode}\nTarget stack: ${target}\n\nFiles:\n${parts.join("\n\n")}\n\nReturn JSON:\n{"summary":"2 sentences on what the app does","stack":"current stack in a few words","order":["paths in the best order to process, leaf files first"],"plan":["5 to 8 short global rules every worker must follow for this mode and target"]}`,
    },
  ];
}

const MODE_TASK: Record<Mode, (target: string) => string> = {
  migrate: (t) =>
    `Rewrite this file for the target stack: ${t}. Keep behaviour the same. Use modern idioms, strong types where the target supports them, safe APIs, and clean names. Pick a sensible new path and extension for the target.`,
  secure: () =>
    `Audit this file for security bugs (injection, secrets, weak crypto, XSS, auth, unsafe input). List each finding. Then output the full patched file in the same language at the same path.`,
  docs: () =>
    `Write clear developer docs for this file in Markdown: purpose, main functions, inputs and outputs, side effects, and gotchas. New path must be docs/<original path>.md.`,
  explore: () =>
    `Explain this file for a new developer in Markdown: what it does in 2 lines, key symbols, how it connects to other files. New path must be notes/<original path>.md.`,
};

export function workerPrompt(file: RepoFile, mode: Mode, target: string, plan: string[], summary: string) {
  return [
    {
      role: "system" as const,
      content: `You are a worker agent in a fast code swarm. Follow the output format exactly. No extra talk.\nApp: ${summary}\nSwarm rules:\n- ${plan.join("\n- ")}`,
    },
    {
      role: "user" as const,
      content: `${MODE_TASK[mode](target)}\n\nFile: ${file.path}\n\`\`\`${file.lang}\n${file.content}\n\`\`\`\n\nOutput format:\n### PATH: <new path>\n### NOTES: <one line on what changed>\n### FINDINGS:\n- [high|medium|low] <title>: <detail>\n(write "- none" if there are no findings)\n### CODE\n\`\`\`<lang>\n<full file content>\n\`\`\``,
    },
  ];
}

export function fixerPrompt(path: string, code: string, error: string) {
  return [
    { role: "system" as const, content: "You are Fixer. You repair code so it parses. Reply with the full fixed file in one code block only." },
    { role: "user" as const, content: `File ${path} fails a check: ${error}\n\n\`\`\`\n${code}\n\`\`\`` },
  ];
}

export function shipPrompt(name: string, mode: Mode, target: string, notes: string[]) {
  return [
    { role: "system" as const, content: "You are Shipper. You write pull request text. Reply with JSON only." },
    {
      role: "user" as const,
      content: `Repo ${name}. Mode ${mode}. Target ${target}.\nFile notes:\n${notes.slice(0, 40).join("\n")}\n\nReturn JSON: {"title":"short PR title","body":"Markdown PR body with summary, changes list, and test notes","readme":"${mode === "docs" ? "a full README.md for the repo" : ""}"}`,
    },
  ];
}

export function askPrompt(question: string, summary: string, files: { path: string; content: string }[]) {
  const ctx = files.map((f) => `--- ${f.path}\n${f.content.slice(0, 12_000)}`).join("\n\n");
  return [
    {
      role: "system" as const,
      content: `You answer questions about a codebase. Be short and exact. Cite files as \`path\`. App summary: ${summary}`,
    },
    { role: "user" as const, content: `${ctx}\n\nQuestion: ${question}` },
  ];
}

export function parseWorker(text: string, fallbackPath: string) {
  const path = text.match(/###\s*PATH:\s*(.+)/)?.[1]?.trim().replace(/[`*]/g, "") || fallbackPath;
  const notes = text.match(/###\s*NOTES:\s*(.+)/)?.[1]?.trim() || "";
  const findBlock = text.match(/###\s*FINDINGS:([\s\S]*?)###\s*CODE/)?.[1] || "";
  const findings = findBlock
    .split("\n")
    .map((l) => l.match(/^\s*-\s*\[(high|medium|low)\]\s*([^:]+):\s*(.+)$/i))
    .filter(Boolean)
    .map((m) => ({ severity: m![1].toLowerCase() as "high" | "medium" | "low", title: m![2].trim(), detail: m![3].trim() }));
  const codeArea = text.split(/###\s*CODE/)[1] ?? text;
  const code = fenced(codeArea) ?? codeArea.trim();
  return { path, notes, findings, code };
}

export function fenced(text: string) {
  const m = text.match(/```[\w.+-]*\n([\s\S]*?)```/);
  if (m) return m[1].replace(/\n$/, "");
  const open = text.match(/```[\w.+-]*\n([\s\S]*)$/);
  return open ? open[1].trim() : null;
}
