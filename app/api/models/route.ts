import { cfg, fallbackModel, modelLabel, streamChat } from "@/lib/cerebras";

export const dynamic = "force-dynamic";

// Open /api/models to see what your setup can use.
// Add ?probe=1 to send one tiny real request to the model (a few tokens).
export async function GET(req: Request) {
  const probe = new URL(req.url).searchParams.get("probe") === "1";
  const out: Record<string, unknown> = { harness: cfg.harness, base: cfg.base, model: cfg.model, backup: fallbackModel || null };
  try {
    const r = await fetch(`${cfg.base}/models`, { headers: cfg.key ? { Authorization: `Bearer ${cfg.key}` } : {} });
    const j = await r.json().catch(() => ({}));
    const ids: string[] = (j.data || []).map((m: { id: string }) => m.id);
    out.status = r.status;
    out.listed = ids;
    out.kimi = ids.filter((i) => /kimi|k3/i.test(i));
  } catch (e) {
    out.listError = (e as Error).message;
  }
  if (probe) {
    try {
      const r = await streamChat({ messages: [{ role: "user", content: "Reply with the word ok." }], maxTokens: 1500, session: "probe" });
      out.probe = { ok: true, ranOn: modelLabel(), reply: r.text.slice(0, 80), tokens: r.completionTokens, tps: Math.round(r.tps) };
    } catch (e) {
      out.probe = { ok: false, error: (e as Error).message.slice(0, 400) };
    }
  } else out.tip = "Add ?probe=1 to test the model with one tiny call. Trial models may not be listed but can still work.";
  return Response.json(out);
}
