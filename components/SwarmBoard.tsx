"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { AgentInfo, AgentState, FileStatus } from "@/lib/types";

export interface FileView {
  path: string;
  lang: string;
  size: number;
  group: string;
  status: FileStatus;
  agent?: string;
  preview?: string;
  tokens?: number;
  tps?: number;
}
export interface AgentView extends AgentInfo {
  state: AgentState;
  file?: string;
  note?: string;
}

interface Props {
  files: FileView[];
  agents: AgentView[];
  phaseLabel: string;
  running: boolean;
  tps: number;
  selected?: string;
  onSelect: (p: string) => void;
}

type Pt = { x: number; y: number };

export default function SwarmBoard({ files, agents, phaseLabel, running, tps, selected, onSelect }: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const [pos, setPos] = useState<Record<string, Pt>>({});
  const [size, setSize] = useState({ w: 0, h: 0 });
  const groupsRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [full, setFull] = useState(false);

  const groups = useMemo(() => {
    const g = new Map<string, FileView[]>();
    for (const f of files) {
      if (!g.has(f.group)) g.set(f.group, []);
      g.get(f.group)!.push(f);
    }
    return [...g.entries()];
  }, [files]);

  const measure = useCallback(() => {
    const b = boardRef.current;
    if (!b) return;
    const br = b.getBoundingClientRect();
    const next: Record<string, Pt> = {};
    cardRefs.current.forEach((el, path) => {
      const r = el.getBoundingClientRect();
      next[path] = { x: r.left - br.left + r.width / 2, y: r.top - br.top + r.height / 2 };
    });
    setPos(next);
    setSize({ w: br.width, h: br.height });
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [files.length, measure, zoom, full]);

  // Make the whole hive fit the board. Used on full screen and by the Fit button.
  const fit = useCallback(() => {
    const b = boardRef.current;
    const g = groupsRef.current;
    if (!b || !g || !g.offsetWidth || !g.offsetHeight) return;
    const z = Math.min((b.clientWidth - 60) / g.offsetWidth, (b.clientHeight - 190) / g.offsetHeight);
    setZoom(Math.max(0.35, Math.min(2.2, Math.round(z * 100) / 100)));
  }, []);

  function toggleFull() {
    setFull((f) => !f);
  }
  useEffect(() => {
    if (!full) {
      setZoom(1);
      return;
    }
    const t = setTimeout(fit, 60); // wait for the board to grow
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [full, fit]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const core: Pt = { x: size.w / 2, y: 38 };
  const done = files.filter((f) => f.status === "done").length;
  const workers = agents.filter((a) => a.role === "worker");
  const active = agents.filter((a) => a.state === "working" || a.state === "reviewing" || a.state === "thinking");

  // Spread agents that are not on a file along the top
  const restPos = (i: number, n: number): Pt => ({ x: core.x + (i - (n - 1) / 2) * 34, y: 60 });

  return (
    <div className={`board ${full ? "full" : ""}`} ref={boardRef}>
      <div className="board-tools">
        <button onClick={() => setZoom((z) => Math.max(0.35, Math.round((z - 0.15) * 100) / 100))} title="Zoom out">−</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((z) => Math.min(2.2, Math.round((z + 0.15) * 100) / 100))} title="Zoom in">+</button>
        <button onClick={fit} title="Fit the whole hive">Fit</button>
        <button className="icon-btn" onClick={toggleFull} aria-label={full ? "Exit full screen" : "Full screen"} title={full ? "Exit full screen (Esc)" : "Full screen"}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            {full ? (
              <>
                <polyline points="4 14 10 14 10 20" />
                <polyline points="20 10 14 10 14 4" />
                <line x1="14" y1="10" x2="21" y2="3" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </>
            ) : (
              <>
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </>
            )}
          </svg>
        </button>
      </div>
      <div className={`core ${running ? "" : "idle"}`}>
        <div className="orb" />
        <span>{phaseLabel || "Hive core"}</span>
      </div>

      {!files.length && (
        <div className="board-empty">
          <div>
            <span className="script">Waiting for a repo</span>
            <p style={{ marginTop: 14, fontSize: 15 }}>Paste a GitHub link or pick the old shop demo, then press Start.</p>
          </div>
        </div>
      )}

      <svg className="links" width={size.w} height={size.h}>
        {agents.map((a) => {
          if (!a.file || !(a.state === "working" || a.state === "reviewing")) return null;
          const p = pos[a.file];
          if (!p) return null;
          const midX = (core.x + p.x) / 2;
          const d = `M ${core.x} ${core.y} Q ${midX + (p.x > core.x ? -60 : 60)} ${(core.y + p.y) / 2 - 40} ${p.x} ${p.y - 56}`;
          return <path key={a.id} d={d} stroke={a.color} />;
        })}
      </svg>

      <div className="groups" ref={groupsRef} style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}>
        {groups.map(([g, list]) => (
          <div className="group" key={g}>
            <span className="group-name">{g === "root" ? "/" : `${g}/`}</span>
            <div className="group-cards" style={{ gridTemplateColumns: `repeat(${Math.min(list.length, list.length > 4 ? 3 : 2)}, 150px)` }}>
              {list.map((f) => (
                <div
                  key={f.path}
                  ref={(el) => {
                    if (el) cardRefs.current.set(f.path, el);
                    else cardRefs.current.delete(f.path);
                  }}
                  className={`fcard ${f.status} ${selected === f.path ? "sel" : ""}`}
                  onClick={() => onSelect(f.path)}
                  title={f.path}
                >
                  <div className="fname">{f.path.split("/").pop()}</div>
                  <div className="flang">{f.lang}</div>
                  <i className="fstat" />
                  <pre>{f.preview || ""}</pre>
                  <div className="fmeta">
                    <span>{f.tokens ? `${f.tokens} tok` : `${(f.size / 1000).toFixed(1)}k`}</span>
                    <span>{f.tps ? `${Math.round(f.tps)}/s` : f.status === "queued" ? "" : f.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {agents.map((a, i) => {
        const onFile = a.file && (a.state === "working" || a.state === "reviewing") ? pos[a.file] : undefined;
        const p = onFile ? { x: onFile.x + 46, y: onFile.y - 40 } : restPos(i, agents.length);
        const visible = onFile || a.state === "thinking";
        return (
          <div key={a.id} className={`bee ${visible ? "" : "idle"}`} style={{ left: p.x - 13, top: p.y - 13 }}>
            <div className="av" style={{ background: a.color }}>{a.name[0]}</div>
            {visible && <span className="tag" style={{ background: a.color }}>{a.name}</span>}
          </div>
        );
      })}

      {files.length > 0 && (
        <div className="hive-bar">
          <div className="avs">
            {workers.slice(0, 6).map((a) => (
              <i key={a.id} style={{ background: a.color }} />
            ))}
          </div>
          <span><b>{active.length}</b> agents live</span>
          <span><b>{done}</b> / {files.length} files</span>
          <div className="bar"><div style={{ width: `${(done / Math.max(1, files.length)) * 100}%` }} /></div>
          <span className="tps">{Math.round(tps).toLocaleString()} tok/s</span>
        </div>
      )}
    </div>
  );
}
