import { getSession } from "@/lib/auth";
import { runSwarm } from "@/lib/orchestrator";
import type { RunRequest, SwarmEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const session = await getSession();
  const body = { ...(await req.json()), ghToken: session?.token } as RunRequest;
  const enc = new TextEncoder();
  const ctrl = new AbortController();
  req.signal.addEventListener("abort", () => ctrl.abort());

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: SwarmEvent) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          /* client gone */
        }
      };
      try {
        await runSwarm(body, emit, ctrl.signal);
      } catch (e) {
        if (!ctrl.signal.aborted) emit({ t: "error", message: (e as Error).message });
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
    cancel() {
      ctrl.abort();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
