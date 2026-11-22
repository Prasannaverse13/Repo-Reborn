import Link from "next/link";
import { LogoMark } from "@/components/Chrome";
import { authConfigured } from "@/lib/session";

export const metadata = { title: "Sign in · Repo Reborn" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  bad_state: "The sign in link expired. Try again.",
  token_failed: "GitHub did not give a token. Check your client secret.",
  user_failed: "Could not read your GitHub profile.",
  not_configured: "GitHub sign in is not set up yet.",
};

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const sp = await searchParams;
  const ready = authConfigured();
  const next = sp.next && sp.next.startsWith("/") ? sp.next : "/dashboard";
  return (
    <main className="login">
      <Link href="/" className="login-logo"><LogoMark size={44} /></Link>
      <span className="script">Welcome</span>
      <h1>Sign in to Repo Reborn</h1>
      <p className="sub">Use GitHub to run swarms on your repos. We use it to read your code and to open pull requests for you.</p>
      {sp.error && <div className="err" style={{ maxWidth: 420 }}>{ERRORS[sp.error] || "Sign in failed."}</div>}
      {ready ? (
        <a className="btn btn-dark login-btn" href={`/api/auth/login?next=${encodeURIComponent(next)}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#fafafa"><path d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0C17 5 18 5.3 18 5.3c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5z" /></svg>
          Continue with GitHub
        </a>
      ) : (
        <div className="setup-card">
          <b>Set up GitHub sign in</b>
          <ol>
            <li>Open github.com/settings/developers and press New OAuth App.</li>
            <li>Homepage URL: <code>http://localhost:3000</code></li>
            <li>Callback URL: <code>http://localhost:3000/api/auth/callback</code></li>
            <li>Copy the Client ID. Press Generate a new client secret and copy it.</li>
            <li>Add <code>GITHUB_CLIENT_ID</code> and <code>GITHUB_CLIENT_SECRET</code> and <code>SESSION_SECRET</code> to <code>.env.local</code> and restart.</li>
          </ol>
          <Link href="/dashboard" className="btn btn-light btn-sm">Continue as guest for now</Link>
        </div>
      )}
      <p className="fine">We ask for the repo scope so the swarm can read private repos and open PRs. Your token stays in an encrypted cookie. It is never shown in the browser.</p>
    </main>
  );
}
