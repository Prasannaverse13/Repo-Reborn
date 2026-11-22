import Link from "next/link";

export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <rect x="2" y="2" width="36" height="36" rx="11" fill="#292929" />
      <path d="M27 14a9 9 0 1 0 2 8" fill="none" stroke="#fafafa" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M28 8v7h-7" fill="none" stroke="#fafafa" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Nav() {
  return (
    <header className="nav">
      <div className="wrap nav-in">
        <Link href="/" className="nav-left">RR</Link>
        <Link href="/" aria-label="Repo Reborn home"><LogoMark /></Link>
        <nav className="nav-right">
          <Link href="/#modes">Modes</Link>
          <Link href="/dashboard/tps">TPS Lab</Link>
          <Link href="/dashboard" className="btn btn-dark btn-sm">Open Dashboard</Link>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <svg width="46" height="46" viewBox="0 0 40 40" aria-hidden>
        <rect x="2" y="2" width="36" height="36" rx="11" fill="#fafafa" />
        <path d="M27 14a9 9 0 1 0 2 8" fill="none" stroke="#222" strokeWidth="3.4" strokeLinecap="round" />
        <path d="M28 8v7h-7" fill="none" stroke="#222" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p>
        Old code in. New code out.<br />A swarm of Kimi K3.1 Pro agents running on Cerebras.
      </p>
      <div className="footer-row">
        <span>© 2026 Repo Reborn. Built for the Cerebras x Kimi hackathon.</span>
        <nav>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/dashboard/tps">TPS Lab</Link>
          <a href="https://cloud.cerebras.ai" target="_blank" rel="noreferrer">Cerebras</a>
        </nav>
      </div>
    </footer>
  );
}

export function Doodles() {
  const items = [
    { x: 4, y: 40, c: "#F26B5B", d: "M0 20 Q10 0 20 20 T40 20" },
    { x: 12, y: 80, c: "#3898EC", d: "M5 5 L35 35 M35 5 L5 35" },
    { x: 22, y: 30, c: "#F5A623", d: "M20 2 L24 16 L38 16 L27 25 L31 38 L20 30 L9 38 L13 25 L2 16 L16 16 Z" },
    { x: 78, y: 36, c: "#2EB872", d: "M2 20 C2 8 38 8 38 20 C38 32 2 32 2 20" },
    { x: 86, y: 76, c: "#9B6BF2", d: "M0 30 Q10 0 20 30 Q30 0 40 30" },
    { x: 94, y: 30, c: "#E85D9A", d: "M20 4 A16 16 0 1 0 20.1 4 M20 12 A8 8 0 1 0 20.1 12" },
    { x: 68, y: 86, c: "#14B8C4", d: "M4 36 L20 4 L36 36 Z" },
    { x: 32, y: 88, c: "#FF8A3D", d: "M0 20 H40 M20 0 V40" },
  ];
  return (
    <svg className="doodles" viewBox="0 0 100 120" preserveAspectRatio="none" aria-hidden>
      {items.map((it, i) => (
        <g key={i} transform={`translate(${it.x} ${it.y}) scale(0.32)`}>
          <path d={it.d} fill="none" stroke={it.c} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </g>
      ))}
    </svg>
  );
}
