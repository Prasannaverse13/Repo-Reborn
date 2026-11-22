"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoMark } from "./Chrome";

const NAV = [
  { group: "Workspace", items: [
    { href: "/dashboard", label: "Dashboard", icon: "M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z" },
    { href: "/dashboard/runs", label: "Runs", icon: "M4 6h16 M4 12h16 M4 18h10" },
  ] },
  { group: "Tools", items: [
    { href: "/dashboard/tps", label: "TPS Lab", icon: "M4 18a8 8 0 1 1 16 0 M12 18l4-6" },
    { href: "/dashboard/settings", label: "Settings", icon: "M12 9a3 3 0 1 0 0 6a3 3 0 0 0 0-6z M19 12l2-1-1-3-2 .3-1.5-1.5L17 5l-3-1-1 2h-2l-1-2-3 1 .5 2.3L6 8.3 4 8l-1 3 2 1v0l-2 1 1 3 2-.3 1.5 1.5L7 19l3 1 1-2h2l1 2 3-1-.5-2.3 1.5-1.5 2 .3 1-3z" },
  ] },
];

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/runs": "Runs",
  "/dashboard/tps": "TPS Lab",
  "/dashboard/settings": "Settings",
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [status, setStatus] = useState<{ live: boolean; model: string }>();
  const [me, setMe] = useState<{ configured: boolean; user: { login: string; name: string; avatar: string } | null }>();
  useEffect(() => {
    fetch("/api/status").then((r) => r.json()).then(setStatus).catch(() => {});
    fetch("/api/auth/me").then((r) => r.json()).then(setMe).catch(() => {});
  }, []);

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/" className="sb-brand">
          <LogoMark size={30} />
          <div>
            <b>Repo Reborn</b>
            <span>Agent swarm</span>
          </div>
        </Link>
        <Link href="/dashboard" className="sb-new">+ New swarm</Link>
        {NAV.map((g) => (
          <div key={g.group} className="sb-group">
            <div className="sb-label">{g.group}</div>
            {g.items.map((it) => (
              <Link key={it.href} href={it.href} className={`sb-item ${path === it.href ? "on" : ""}`}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={it.icon} /></svg>
                {it.label}
              </Link>
            ))}
          </div>
        ))}
        <div className="sb-foot">
          {me?.user ? (
            <div className="sb-user">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={me.user.avatar} alt="" width={32} height={32} />
              <div>
                <b>{me.user.name}</b>
                <span>@{me.user.login}</span>
              </div>
              <a href="/api/auth/logout" title="Sign out">Sign out</a>
            </div>
          ) : me?.configured === false ? (
            <Link href="/login" className="sb-guest">Guest mode. Set up GitHub sign in</Link>
          ) : null}
          <span className={`pill-badge ${status?.live ? "" : "sim"}`}>
            <i /> {status ? (status.live ? `Live · ${status.model}` : "Simulated mode") : "Checking"}
          </span>
        </div>
      </aside>
      <div className="main">
        <div className="topbar">
          <span>Workspace</span>
          <span className="sep">›</span>
          <b>{TITLES[path] || "Dashboard"}</b>
          <div style={{ flex: 1 }} />
          <Link href="/" className="btn btn-light btn-sm">Home</Link>
        </div>
        <div className="main-in">{children}</div>
      </div>
    </div>
  );
}
