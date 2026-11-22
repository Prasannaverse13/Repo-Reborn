import { isLive, modelLabel, streamChat } from "@/lib/cerebras";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { prompt, system, maxTokens } = (await req.json()) as { prompt: string; system?: string; maxTokens?: number };
  if (!isLive()) {
    const tokens = Math.min(maxTokens || 2000, 2000);
    const tps = 1800 + Math.random() * 1200;
    return Response.json({ text: "Simulated output. Add CEREBRAS_API_KEY to measure real speed.", tokens, tps, ms: (tokens / tps) * 1000, model: "simulated" });
  }
  const messages = [
    ...(system ? [{ role: "system" as const, content: system }] : []),
    { role: "user" as const, content: prompt },
  ];
  const r = await streamChat({ messages, maxTokens: Math.min(maxTokens || 1500, 8000), temperature: 0 });
  return Response.json({ text: r.text.slice(0, 4000), tokens: r.completionTokens, tps: r.tps, ms: r.ms, model: r.model });
}
