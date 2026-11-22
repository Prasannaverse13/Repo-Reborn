import { getSession } from "@/lib/auth";
import { authConfigured } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  return Response.json({
    configured: authConfigured(),
    user: s ? { login: s.login, name: s.name, avatar: s.avatar } : null,
  });
}
