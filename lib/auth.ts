import { cookies } from "next/headers";
import { COOKIE, open, type Session } from "./session";

export async function getSession(): Promise<Session | null> {
  const c = await cookies();
  return open(c.get(COOKIE)?.value);
}
