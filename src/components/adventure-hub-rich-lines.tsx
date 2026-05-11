import * as React from "react";

type SpanHit = {
  start: number;
  end: number;
  node: React.ReactNode;
};

function collectHits(line: string): SpanHit[] {
  const raw: SpanHit[] = [];
  let hitSeq = 0;
  const key = () => `ahub-${hitSeq++}`;

  const add = (re: RegExp, build: (m: RegExpExecArray, k: string) => React.ReactNode) => {
    const r = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = r.exec(line)) !== null) {
      raw.push({
        start: m.index,
        end: m.index + m[0].length,
        node: build(m, key()),
      });
      if (m[0].length === 0) r.lastIndex++;
    }
  };

  add(/\+\s*\d+\s*XP/gi, (m, k) => (
    <span key={k} className="font-semibold text-violet-300">
      {m[0]}
    </span>
  ));
  add(/\d+\s+Crimson\s+Tonics?!/gi, (m, k) => (
    <span key={k} className="font-semibold text-emerald-400">
      {m[0]}
    </span>
  ));
  add(/\bhaul out\s+\d+\s+gold\b/gi, (m, k) => {
    const inner = m[0].match(/^haul out\s+(\d+)\s+(gold)$/i);
    if (!inner) {
      return (
        <span key={k} className="font-semibold text-amber-300">
          {m[0]}
        </span>
      );
    }
    return (
      <span key={k}>
        <span className="text-zinc-300">haul out </span>
        <span className="font-semibold text-amber-300">{inner[1]}</span>
        <span className="font-semibold text-amber-200"> {inner[2]}</span>
      </span>
    );
  });
  add(/\blose\s+\d+\s+HP\b/gi, (m, k) => {
    const inner = m[0].match(/^lose\s+(\d+)\s+(HP)$/i);
    if (!inner) {
      return (
        <span key={k} className="font-semibold text-rose-400">
          {m[0]}
        </span>
      );
    }
    return (
      <span key={k}>
        <span className="text-rose-200/90">lose </span>
        <span className="font-semibold text-rose-400">{inner[1]}</span>
        <span className="font-semibold text-rose-300"> {inner[2]}</span>
      </span>
    );
  });

  raw.sort((a, b) => a.start - b.start || b.end - a.end - (a.end - b.end));
  const chosen: SpanHit[] = [];
  let lastEnd = -1;
  for (const h of raw) {
    if (h.start < lastEnd) continue;
    chosen.push(h);
    lastEnd = h.end;
  }
  return chosen;
}

export function adventureHubRichLine(line: string, lineIndex: number): React.ReactNode {
  const hits = collectHits(line);
  if (hits.length === 0) return line;

  const out: React.ReactNode[] = [];
  let cursor = 0;
  for (const h of hits) {
    if (h.start > cursor) {
      out.push(line.slice(cursor, h.start));
    }
    out.push(h.node);
    cursor = h.end;
  }
  if (cursor < line.length) out.push(line.slice(cursor));
  return <>{out}</>;
}

export function AdventureHubRichLines({ lines }: { lines: string[] }) {
  return (
    <div className="rounded-lg border border-zinc-700/50 bg-zinc-950/40 px-4 py-3 font-serif text-sm leading-relaxed text-zinc-200/95 backdrop-blur-sm">
      {lines.map((line, i) => (
        <p key={i} className={i > 0 ? "mt-2" : ""}>
          {adventureHubRichLine(line, i)}
        </p>
      ))}
    </div>
  );
}
