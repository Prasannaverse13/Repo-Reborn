import { getSession } from "@/lib/auth";
import { GH_API } from "@/lib/session";

export const dynamic = "force-dynamic";

// The signed in user's recent repos, for the repo picker.
export async function GET() {
  const s = await getSession();
  if (!s) return Response.json({ repos: [] });
  const r = await fetch(`${GH_API()}/user/repos?sort=pushed&per_page=50&affiliation=owner,collaborator`, {
    headers: { Authorization: `Bearer ${s.token}`, "User-Agent": "repo-reborn", Accept: "application/vnd.github+json" },
  });
  if (!r.ok) return Response.json({ repos: [] });
  const list = (await r.json()) as { full_name: string; private: boolean; permissions?: { push?: boolean } }[];
  return Response.json({ repos: list.map((x) => ({ name: x.full_name, private: x.private, push: x.permissions?.push ?? false })) });
}
