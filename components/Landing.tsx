"use client";
import { useEffect, useState } from "react";

const MODES = [
  {
    key: "migrate",
    title: "Migrate",
    text: "Move jQuery, PHP 5 or Python 2 to a modern stack.",
    icon: "M4 12h12M12 6l6 6-6 6",
    before: ["$.ajax({ url: 'api/products.php',", "  success: function(data) {", "    var html = '';"],
    after: ["const res = await fetch('/api/products');", "const data: Product[] = await res.json();", "list.replaceChildren(...data.map(row));"],
  },
  {
    key: "secure",
    title: "Secure",
    text: "Find injection, secrets and weak crypto. Then patch it.",
    icon: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
    before: ["mysql_query(\"SELECT * FROM users", "  WHERE name='$user'\");", "md5($pass)"],
    after: ["$st = $pdo->prepare('SELECT * FROM users", "  WHERE name = ?');", "password_verify($pass, $row['hash'])"],
  },
  {
    key: "docs",
    title: "Document",
    text: "Docs for every file and a full README in one run.",
    icon: "M6 3h9l4 4v14H6z M9 12h7 M9 16h7",
    before: ["function Cart() {", "  this.items = [];", "}"],
    after: ["## Cart", "Holds line items and totals.", "- add(item): bumps qty or inserts"],
  },
  {
    key: "explore",
    title: "Explore",
    text: "Ask anything about a repo you have never seen.",
    icon: "M11 4a7 7 0 1 0 0 14a7 7 0 0 0 0-14z M20 20l-4-4",
    before: ["Q: where do orders get saved?"],
    after: ["A: api/orders.php inserts each item", "   into the orders table after a", "   session check. See line 6."],
  },
];

export function ModeIcon({ d, size = 22 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#292929" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export function Features() {
  const [on, setOn] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setOn((v) => (v + 1) % MODES.length), 3500);
    return () => clearInterval(t);
  }, []);
  const m = MODES[on];
  return (
    <div className="features">
      <div className="feat-list">
        {MODES.map((x, i) => (
          <div key={x.key} className={`feat ${i === on ? "on" : ""}`} onMouseEnter={() => setOn(i)}>
            <div className="ic"><ModeIcon d={x.icon} /></div>
            <div>
              <b>{x.title}</b>
              <span>{x.text}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="feat-panel">
        <div className="mock">
          <div className="mock-top"><i /><i /><i /></div>
          <pre>
            {m.before.map((l, i) => (
              <span key={"b" + i} className="del">{l}</span>
            ))}
            {"\n"}
            {m.after.map((l, i) => (
              <span key={"a" + i} className="add">{l}</span>
            ))}
          </pre>
        </div>
      </div>
    </div>
  );
}

export function HeroStack() {
  const cards = MODES.map((m) => ({ ...m }));
  return (
    <div className="hero-stack">
      {cards.map((c, i) => (
        <div
          key={c.key}
          className="hero-card"
          style={{ top: i * 80, transform: `rotate(${[-2, 1.5, -1, 2][i]}deg)`, zIndex: 10 - i, }}
        >
          <div className="ic"><ModeIcon d={c.icon} size={20} /></div>
          <div>
            <b>{c.title}</b>
            <span>{c.text}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function LiveCounter() {
  const [n, setN] = useState(0);
  useEffect(() => {
    let v = 0;
    const t = setInterval(() => {
      v = Math.min(254, v + Math.ceil(Math.random() * 9));
      setN(v);
      if (v >= 254) v = 0;
    }, 160);
    return () => clearInterval(t);
  }, []);
  return <>{n}</>;
}
