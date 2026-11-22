import Link from "next/link";
import { Doodles, Footer, Nav } from "@/components/Chrome";
import { Features, HeroStack, LiveCounter } from "@/components/Landing";

const WHY = [
  { c: "#3898EC", t: "Speed Is The Feature", d: "Cerebras runs Kimi K3.1 Pro at thousands of tokens a second. A file is rewritten before you finish reading its name." },
  { c: "#F26B5B", t: "Many Hands, One Plan", d: "Scout maps the repo. Maestro writes the rules. A swarm of workers rewrites files side by side." },
  { c: "#2EB872", t: "It Checks Its Own Work", d: "Every file runs through a real syntax check. If it fails, the agent fixes it and tries again." },
  { c: "#F5A623", t: "Ship, Don't Stare", d: "Download the new repo as a zip or open a pull request straight from the studio." },
];

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <section className="hero">
          <div className="wrap">
            <span className="script">Reborn!</span>
            <h1>Your Code Is Old.<br />Give It A Second Life.</h1>
            <p className="sub">
              Drop a GitHub link. A swarm of Kimi K3.1 Pro agents on Cerebras maps it, rewrites it, checks it and ships it. In minutes, not months.
            </p>
            <div className="hero-cta">
              <Link href="/dashboard" className="btn btn-dark">Start a swarm</Link>
              <Link href="/dashboard?sample=1" className="btn btn-light">Try the old shop demo</Link>
            </div>
            <HeroStack />
          </div>
          <Doodles />
        </section>

        <section className="wrap letter">
          <div>
            <span className="script">Open Letter</span>
            <h2>Hey Builder!<br /><span>That old repo is not dead. It is just waiting.</span></h2>
          </div>
          <div className="body">
            <p>You know the one. <b>jQuery 1.7. PHP 5. Python 2.</b> Nobody wants to touch it, and everybody depends on it.</p>
            <p>Rewrites take months because one person can only read one file at a time. <b>A swarm can read all of them at once.</b></p>
            <p>Repo Reborn splits your repo across a team of agents. Each one owns a file. They share one plan, check their work and hand you a pull request.</p>
          </div>
        </section>

        <section className="dark-block">
          <div className="head">
            <span className="script">Hear it out</span>
            <h2>Why A Swarm?</h2>
            <p>Because one agent is fast. Twenty agents on Cerebras feel like magic.</p>
          </div>
          <div className="dark-grid">
            {WHY.map((w) => (
              <div className="dark-card" key={w.t}>
                <div className="dot" style={{ background: w.c }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12l4 4 10-10" /></svg>
                </div>
                <h3>{w.t}</h3>
                <p>{w.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section wrap" id="modes">
          <div className="section-head">
            <span className="script">Modes</span>
            <h2>Four Jobs. One Swarm.</h2>
            <p>Build agents, refactor legacy code and explore new codebases. Every track, one studio.</p>
          </div>
          <Features />
        </section>

        <section className="section gridlined">
          <div className="wrap" style={{ textAlign: "center" }}>
            <span className="script">The Deal</span>
            <h2 style={{ fontSize: "clamp(32px,4vw,48px)", letterSpacing: "-0.03em", margin: "14px 0 10px", fontWeight: 600 }}>Watch It Work</h2>
            <p style={{ color: "var(--muted)", maxWidth: 560, margin: "0 auto 10px" }}>
              Every file is a card. Every agent is a dot. You see each one fly to its file, stream new code and turn green.
            </p>
            <div className="stats-strip">
              <div className="stat"><b>20</b><span>agents at once</span></div>
              <div className="stat"><b><LiveCounter /></b><span>files rebuilt live</span></div>
              <div className="stat"><b>2k+</b><span>tokens per second per agent</span></div>
              <div className="stat"><b>1</b><span>pull request at the end</span></div>
            </div>
            <div style={{ marginTop: 30 }}>
              <Link href="/dashboard?sample=1" className="btn btn-dark">See the swarm</Link>
            </div>
          </div>
        </section>

        <section className="cta wrap">
          <span className="script">Go!</span>
          <h2>Your Repo Is Ready To Be Reborn.</h2>
          <p>Paste a link. Pick a mode. Watch the swarm. It takes less time than reading this page.</p>
          <Link href="/dashboard" className="btn btn-dark">Open Dashboard</Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
