import { cfg, isLive, modelLabel } from "@/lib/cerebras";
import { authConfigured } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    live: isLive(),
    model: isLive() ? modelLabel() : "simulated",
    harness: cfg.harness,
    base: cfg.base,
    effort: cfg.effort || null,
    maxWorkers: Number(process.env.SWARM_MAX_WORKERS || 12),
    maxFiles: Number(process.env.SWARM_MAX_FILES || 60),
    github: Boolean(process.env.GITHUB_TOKEN),
    signin: authConfigured(),
  });
}
