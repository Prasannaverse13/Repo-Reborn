import type { Metadata } from "next";
import "@fontsource-variable/figtree";
import "@fontsource/caveat/400.css";
import "@fontsource/caveat/500.css";
import "@fontsource/jetbrains-mono/400.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Repo Reborn: a swarm of agents rebuilds your repo",
  description: "A swarm of Kimi K3.1 Pro agents on Cerebras moves old repos to modern code, audits them, documents them and explains them. In minutes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
