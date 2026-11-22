// Thin streaming client for the Cerebras OpenAI compatible API.

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamResult {
  text: string;
  completionTokens: number;
  promptTokens: number;
  tps: number;
  ms: number;
  model: string;
}

// Two ways to reach Kimi on Cerebras:
// 1. OpenClaw harness (hackathon rule): set OPENCLAW_GATEWAY_URL. Every agent call runs as an OpenClaw agent turn.
// 2. Direct: only CEREBRAS_API_KEY. Handy for local tests.
const gateway = (process.env.OPENCLAW_GATEWAY_URL || "").replace(/\/$/, "");
export const cfg = {
  harness: gateway ? "openclaw" : "direct",
  key: gateway ? process.env.OPENCLAW_GATEWAY_TOKEN || "" : process.env.CEREBRAS_API_KEY || "",
  model: process.env.CEREBRAS_MODEL || "moonshotai-kimi-k3.1-pro-trial",
  agent: process.env.OPENCLAW_AGENT || "openclaw/default",
  base: gateway ? (gateway.endsWith("/v1") ? gateway : `${gateway}/v1`) : (process.env.CEREBRAS_BASE_URL || "https://api.cerebras.ai/v1").replace(/\/$/, ""),
  // Default low to save credits. Set to "off" to not send it.
  // Empty counts as low. Use "off" to not send it.
  effort: (process.env.CEREBRAS_REASONING_EFFORT || "low").trim() === "off" ? "" : (process.env.CEREBRAS_REASONING_EFFORT || "low").trim(),
};

export const isLive = () => Boolean(cfg.key || gateway);

// Backup model. Used only if the main model is not open to this key.
// Set CEREBRAS_FALLBACK_MODEL=off to turn the backup off.
const fb = process.env.CEREBRAS_FALLBACK_MODEL ?? "gpt-oss-120b";
export const fallbackModel = fb === "off" || fb === cfg.model ? "" : fb;
// "main" = try the main model. "backup" = main was refused, use the backup. Retries main every 5 minutes.
const state = { mode: "main" as "main" | "backup", since: 0 };
export const activeModel = () => {
  if (state.mode === "backup" && Date.now() - state.since > 5 * 60_000) state.mode = "main";
  return state.mode === "backup" && fallbackModel ? fallbackModel : cfg.model;
};
export const onBackup = () => activeModel() !== cfg.model;
// Always tells the truth about which model is running.
export const modelLabel = () => {
  const m = activeModel();
  const name = cfg.harness === "openclaw" ? `OpenClaw · cerebras/${m}` : m;
  return onBackup() ? `${name} (backup)` : name;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function streamChat(opts: {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  onToken?: (chunk: string, totalChars: number) => void;
  onThinking?: (totalChars: number) => void;
  session?: string;
  signal?: AbortSignal;
  model?: string;
  noFallback?: boolean;
}): Promise<StreamResult> {
  const viaClaw = cfg.harness === "openclaw";
  const model = opts.model || activeModel();
  const body: Record<string, unknown> = {
    // OpenClaw picks an agent by model. The provider model goes in a header.
    model: viaClaw ? cfg.agent : model,
    messages: opts.messages,
    max_completion_tokens: opts.maxTokens ?? 8192,
    temperature: opts.temperature ?? 0.2,
    stream: true,
  };
  // Under OpenClaw the thinking level comes from the OpenClaw config.
  if (cfg.effort && cfg.harness !== "openclaw") body.reasoning_effort = cfg.effort;
  if (viaClaw) {
    body.stream_options = { include_usage: true };
    // Fresh OpenClaw session per call so agents never share chat history.
    body.user = `reborn:${opts.session || "agent"}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.key) headers.Authorization = `Bearer ${cfg.key}`;
  if (viaClaw) headers["x-openclaw-model"] = `cerebras/${model}`;

  let res: Response | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    res = await fetch(`${cfg.base}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    if (res.status === 400 && body.reasoning_effort) {
      const t = await res.clone().text().catch(() => "");
      if (/reasoning/i.test(t)) {
        delete body.reasoning_effort; // this model does not take it. Retry without.
        continue;
      }
    }
    if (res.status === 429 || res.status >= 500) {
      await sleep(800 * 2 ** attempt + Math.random() * 400);
      continue;
    }
    break;
  }
  // Main model refused (not open to this key). Switch to the backup and run the same call again.
  let badModel = false;
  if (res && res.status === 400) {
    const bt = await res.clone().text().catch(() => "");
    badModel = /unknown model|model.{0,40}(not found|not supported|does not exist)/i.test(bt);
  }
  if (res && (res.status === 404 || res.status === 403 || badModel) && !opts.noFallback && !opts.model && fallbackModel && model === cfg.model) {
    state.mode = "backup";
    state.since = Date.now();
    return streamChat({ ...opts, model: fallbackModel, noFallback: true });
  }
  if (!res || !res.ok || !res.body) {
    const t = res ? await res.text().catch(() => "") : "";
    const hint = res?.status === 401 && cfg.harness === "openclaw" ? " Check OPENCLAW_GATEWAY_TOKEN." : res?.status === 404 ? ` Model "${model}" is not open to this key. Open /api/models to see what your key can use, then set CEREBRAS_MODEL in .env.` : "";
    throw new Error(`Cerebras error ${res?.status}: ${t.slice(0, 300)}${hint}`);
  }

  const start = Date.now();
  let firstAt = 0;
  let text = "";
  let completionTokens = 0;
  let promptTokens = 0;
  let completionTime = 0;
  let thinkChars = 0;

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      let j;
      try {
        j = JSON.parse(data);
      } catch {
        continue; // partial line
      }
      {
        const d0 = j.choices?.[0]?.delta;
        const think = d0?.reasoning ?? d0?.reasoning_content ?? d0?.reasoning_text;
        if (think) {
          thinkChars += String(think).length;
          opts.onThinking?.(thinkChars);
        }
        const delta = d0?.content;
        if (delta) {
          if (!firstAt) firstAt = Date.now();
          text += delta;
          opts.onToken?.(delta, text.length);
        }
        if (j.error) {
          const et = JSON.stringify(j.error);
          if (!text && !opts.noFallback && !opts.model && fallbackModel && model === cfg.model && /unknown model|model.{0,60}(not found|not supported|does not exist|no access)/i.test(et)) {
            state.mode = "backup";
            state.since = Date.now();
            reader.cancel().catch(() => {});
            return streamChat({ ...opts, model: fallbackModel, noFallback: true });
          }
          throw new Error(`Model error: ${et.slice(0, 300)}`);
        }
        if (j.usage) {
          completionTokens = j.usage.completion_tokens ?? completionTokens;
          promptTokens = j.usage.prompt_tokens ?? promptTokens;
        }
        if (j.time_info?.completion_time) completionTime = j.time_info.completion_time;
      }
    }
  }
  const end = Date.now();
  if (!completionTokens) completionTokens = Math.round(text.length / 4);
  const genSec = completionTime || Math.max(0.05, (end - (firstAt || start)) / 1000);
  return { text, completionTokens, promptTokens, tps: completionTokens / genSec, ms: end - start, model };
}

export function extractJson<T>(text: string, fallback: T): T {
  const cleaned = text.replace(/```json|```/g, "");
  const s = cleaned.indexOf("{");
  const e = cleaned.lastIndexOf("}");
  if (s < 0 || e < s) return fallback;
  try {
    return JSON.parse(cleaned.slice(s, e + 1)) as T;
  } catch {
    return fallback;
  }
}
