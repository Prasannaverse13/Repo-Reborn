import { NextResponse } from "next/server";
import { COOKIE, GH_API, GH_WEB, seal, STATE_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fail = (why: string) => NextResponse.redirect(new URL(`/login?error=${why}`, url.origin));
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const saved = (req.headers.get("cookie") || "").split(/;\s*/).find((c) => c.startsWith(`${STATE_COOKIE}=`))?.slice(STATE_COOKIE.length + 1);
  const [savedState, next = "/dashboard"] = decodeURIComponent(saved || "").split("|");
  if (!code || !state || state !== savedState) return fail("bad_state");

  const tokenRes = await fetch(`${GH_WEB()}/login/oauth/access_token`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${url.origin}/api/auth/callback`,
    }),
  });
  const tok = await tokenRes.json().catch(() => ({}));
  if (!tok.access_token) return fail("token_failed");

  const uRes = await fetch(`${GH_API()}/user`, { headers: { Authorization: `Bearer ${tok.access_token}`, "User-Agent": "repo-reborn", Accept: "application/vnd.github+json" } });
  if (!uRes.ok) return fail("user_failed");
  const u = await uRes.json();

  const value = await seal({
    login: u.login,
    name: u.name || u.login,
    avatar: u.avatar_url || "",
    token: tok.access_token,
    exp: Date.now() + 7 * 24 * 3600 * 1000,
  });
  const dest = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  const res = NextResponse.redirect(new URL(dest, url.origin));
  res.cookies.set(COOKIE, value, { httpOnly: true, sameSite: "lax", secure: url.protocol === "https:", maxAge: 7 * 24 * 3600, path: "/" });
  res.cookies.delete(STATE_COOKIE);
  return res;
}
