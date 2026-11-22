import { NextResponse } from "next/server";
import { authConfigured, GH_WEB, STATE_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!authConfigured()) return NextResponse.redirect(new URL("/login?error=not_configured", url.origin));
  const state = crypto.randomUUID();
  const next = url.searchParams.get("next") || "/dashboard";
  const auth = new URL(`${GH_WEB()}/login/oauth/authorize`);
  auth.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID!);
  auth.searchParams.set("redirect_uri", `${url.origin}/api/auth/callback`);
  auth.searchParams.set("scope", "repo read:user");
  auth.searchParams.set("state", state);
  const res = NextResponse.redirect(auth);
  res.cookies.set(STATE_COOKIE, `${state}|${next}`, { httpOnly: true, sameSite: "lax", secure: url.protocol === "https:", maxAge: 600, path: "/" });
  return res;
}
