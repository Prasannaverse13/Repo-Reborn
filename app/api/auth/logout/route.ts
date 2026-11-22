import { NextResponse } from "next/server";
import { COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

async function out(req: Request) {
  const res = NextResponse.redirect(new URL("/", new URL(req.url).origin), 303);
  res.cookies.delete(COOKIE);
  return res;
}
export const GET = out;
export const POST = out;
