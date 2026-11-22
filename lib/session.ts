// Encrypted cookie session. Works in the Edge runtime and in Node.
export const COOKIE = "rr_session";
export const STATE_COOKIE = "rr_state";

export interface Session {
  login: string;
  name: string;
  avatar: string;
  token: string;
  exp: number;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export const authConfigured = () =>
  Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET && process.env.SESSION_SECRET);

export const GH_WEB = () => (process.env.GITHUB_WEB_URL || "https://github.com").replace(/\/$/, "");
export const GH_API = () => (process.env.GITHUB_API_URL || "https://api.github.com").replace(/\/$/, "");

async function key() {
  const h = await crypto.subtle.digest("SHA-256", enc.encode(process.env.SESSION_SECRET || ""));
  return crypto.subtle.importKey("raw", h, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function b64(u: Uint8Array) {
  let s = "";
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function seal(s: Session): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), enc.encode(JSON.stringify(s))));
  return `${b64(iv)}.${b64(ct)}`;
}

export async function open(v?: string | null): Promise<Session | null> {
  if (!v || !process.env.SESSION_SECRET) return null;
  try {
    const [iv, ct] = v.split(".");
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await key(), unb64(ct));
    const s = JSON.parse(dec.decode(pt)) as Session;
    return s.exp > Date.now() ? s : null;
  } catch {
    return null;
  }
}
