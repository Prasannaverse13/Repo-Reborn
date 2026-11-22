import type { RepoFile } from "./types";

const CODE_EXT: Record<string, string> = {
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "typescript", py: "python", php: "php", rb: "ruby",
  java: "java", go: "go", rs: "rust", cs: "csharp", cpp: "cpp", c: "c", h: "c",
  html: "html", htm: "html", css: "css", scss: "scss", vue: "vue", svelte: "svelte",
  sol: "solidity", kt: "kotlin", swift: "swift", json: "json", sh: "shell", sql: "sql",
};

const SKIP = /(^|\/)(node_modules|vendor|dist|build|\.git|\.next|coverage|__pycache__|bower_components|third_party)\//i;
const SKIP_FILE = /(\.min\.(js|css)$|package-lock\.json$|yarn\.lock$|pnpm-lock\.yaml$|\.map$)/i;

export function langOf(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return CODE_EXT[ext] || "";
}

export function groupOf(path: string) {
  const parts = path.split("/");
  return parts.length > 1 ? parts[0] : "root";
}

export function parseRepo(input: string) {
  const m = input.trim().replace(/\.git$/, "").match(/(?:github\.com\/)?([\w.-]+)\/([\w.-]+)/);
  if (!m) throw new Error("Use a GitHub link like github.com/owner/repo");
  return { owner: m[1], repo: m[2] };
}

function headers(token?: string) {
  const h: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "repo-reborn" };
  const t = token || process.env.GITHUB_TOKEN;
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

export async function fetchRepo(input: string, maxFiles: number, token?: string, maxChars = 40_000): Promise<{ name: string; branch: string; files: RepoFile[] }> {
  const { owner, repo } = parseRepo(input);
  const meta = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: headers(token) });
  if (!meta.ok) throw new Error(`GitHub repo not found or rate limited (${meta.status})`);
  const branch = (await meta.json()).default_branch as string;
  const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, { headers: headers(token) });
  if (!treeRes.ok) throw new Error(`Could not read repo tree (${treeRes.status})`);
  const tree = (await treeRes.json()).tree as { path: string; type: string; size?: number }[];

  const picked = tree
    .filter((n) => n.type === "blob" && langOf(n.path) && !SKIP.test(n.path) && !SKIP_FILE.test(n.path))
    .filter((n) => (n.size ?? 0) > 0 && (n.size ?? 0) < maxChars)
    .sort((a, b) => (a.path.split("/").length - b.path.split("/").length) || a.path.localeCompare(b.path))
    .slice(0, maxFiles);

  const files: RepoFile[] = [];
  const queue = [...picked];
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (queue.length) {
        const n = queue.shift()!;
        const t = token || process.env.GITHUB_TOKEN;
        const r = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encodeURI(n.path)}`, t ? { headers: { Authorization: `token ${t}` } } : undefined);
        if (!r.ok) continue;
        const content = await r.text();
        files.push({ path: n.path, content, lang: langOf(n.path), size: content.length, group: groupOf(n.path) });
      }
    })
  );
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { name: `${owner}/${repo}`, branch, files };
}

// Opens a pull request with the given files using the Git data API.
export async function openPullRequest(opts: {
  repo: string;
  token: string;
  title: string;
  body: string;
  files: { path: string; content: string }[];
}) {
  const { owner, repo } = parseRepo(opts.repo);
  const h = { ...headers(), Authorization: `Bearer ${opts.token}`, "Content-Type": "application/json" };
  const api = `https://api.github.com/repos/${owner}/${repo}`;
  const j = async (r: Response) => {
    if (!r.ok) throw new Error(`GitHub ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r.json();
  };
  const meta = await j(await fetch(api, { headers: h }));
  const base = meta.default_branch as string;
  const ref = await j(await fetch(`${api}/git/ref/heads/${base}`, { headers: h }));
  const baseSha = ref.object.sha as string;
  const baseCommit = await j(await fetch(`${api}/git/commits/${baseSha}`, { headers: h }));

  const tree = await j(
    await fetch(`${api}/git/trees`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        base_tree: baseCommit.tree.sha,
        tree: opts.files.map((f) => ({ path: f.path, mode: "100644", type: "blob", content: f.content })),
      }),
    })
  );
  const commit = await j(
    await fetch(`${api}/git/commits`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ message: opts.title, tree: tree.sha, parents: [baseSha] }),
    })
  );
  const branch = `repo-reborn/${Date.now()}`;
  await j(await fetch(`${api}/git/refs`, { method: "POST", headers: h, body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }) }));
  const pr = await j(
    await fetch(`${api}/pulls`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ title: opts.title, body: opts.body, head: branch, base }),
    })
  );
  return pr.html_url as string;
}
