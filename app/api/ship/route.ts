import { getSession } from "@/lib/auth";
import { openPullRequest } from "@/lib/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { repo, token: typed, title, body, files } = await req.json();
    const session = await getSession();
    const token = session?.token || typed;
    if (!repo || !token) return Response.json({ error: "Sign in with GitHub or add a token" }, { status: 400 });
    const url = await openPullRequest({ repo, token, title, body, files });
    return Response.json({ url });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
