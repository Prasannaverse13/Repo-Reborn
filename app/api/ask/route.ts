import { isLive, streamChat } from "@/lib/cerebras";
import { askPrompt } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { question, summary, files } = (await req.json()) as {
    question: string;
    summary: string;
    files: { path: string; content: string }[];
  };
  if (!isLive()) {
    const list = files.slice(0, 4).map((f) => `\`${f.path}\``).join(", ");
    return Response.json({
      answer: `Simulated answer. The most related files are ${list}. Add CEREBRAS_API_KEY to get real answers.`,
      tps: 0,
      ms: 0,
    });
  }
  const r = await streamChat({ messages: askPrompt(question, summary, files.slice(0, 4).map((f) => ({ path: f.path, content: f.content.slice(0, 5000) }))), maxTokens: 1500 });
  return Response.json({ answer: r.text, tps: r.tps, ms: r.ms, tokens: r.completionTokens });
}
