import { NextResponse, type NextRequest } from "next/server";
import { authConfigured, COOKIE, open } from "@/lib/session";

// When GitHub sign in is set up, the dashboard and the paid APIs need a session.
export async function middleware(req: NextRequest) {
  if (!authConfigured()) return NextResponse.next();
  const session = await open(req.cookies.get(COOKIE)?.value);
  if (session) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return Response.json({ error: "Sign in with GitHub first" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/run", "/api/ask", "/api/tps", "/api/ship", "/api/auth/repos"],
};
