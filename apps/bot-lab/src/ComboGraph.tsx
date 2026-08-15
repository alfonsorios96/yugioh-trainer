import { useEffect, useMemo, useState } from "react";
import type {
  ComboBook,
  ComboEdgeKind,
  ComboModel,
  ComboNode,
} from "@yugioh/bot-lab";
import { CardZone, cardName } from "./CardThumb";

const NODE_W = 168;
const NODE_H = 58;
const COL_W = 220;
const ROW_H = 86;
const PAD = 28;

const KIND_LABEL: Record<ComboEdgeKind, string> = {
  enables: "habilita",
  requires: "requiere",
  window: "ventana",
  recovers: "recupera",
};

const KIND_COLOR: Record<ComboEdgeKind, string> = {
  enables: "#3d9b7a",
  requires: "#d4a84b",
  window: "#d4655a",
  recovers: "#6fbf8a",
};

type Pos = { x: number; y: number };

function layoutGraph(model: ComboModel): {
  pos: Map<string, Pos>;
  width: number;
  height: number;
} {
  const ids = model.nodes.map((n) => n.id);
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const id of ids) {
    incoming.set(id, []);
    outgoing.set(id, []);
  }
  for (const e of model.edges) {
    if (!incoming.has(e.to) || !outgoing.has(e.from)) continue;
    incoming.get(e.to)!.push(e.from);
    outgoing.get(e.from)!.push(e.to);
  }

  const indeg = new Map(ids.map((id) => [id, incoming.get(id)!.length]));
  const rank = new Map<string, number>();
  const queue = ids.filter((id) => indeg.get(id) === 0);
  for (const id of queue) rank.set(id, 0);
  const visited = new Set<string>();
  while (queue.length) {
    const cur = queue.shift()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    const r = rank.get(cur) ?? 0;
    for (const nxt of outgoing.get(cur) ?? []) {
      rank.set(nxt, Math.max(rank.get(nxt) ?? 0, r + 1));
      indeg.set(nxt, (indeg.get(nxt) ?? 1) - 1);
      if ((indeg.get(nxt) ?? 0) <= 0) queue.push(nxt);
    }
  }
  const maxRank = Math.max(0, ...[...rank.values(), 0]);
  for (const id of ids) {
    if (!rank.has(id)) rank.set(id, maxRank + (ids.length > 0 ? 1 : 0));
  }

  const columns = new Map<number, string[]>();
  for (const id of ids) {
    const r = rank.get(id) ?? 0;
    const col = columns.get(r) ?? [];
    col.push(id);
    columns.set(r, col);
  }

  const pos = new Map<string, Pos>();
  let maxY = 0;
  for (const [r, col] of columns) {
    col.forEach((id, i) => {
      const x = PAD + r * COL_W;
      const y = PAD + i * ROW_H;
      pos.set(id, { x, y });
      maxY = Math.max(maxY, y);
    });
  }
  const maxX = PAD + (Math.max(0, ...columns.keys()) + 1) * COL_W;
  return {
    pos,
    width: Math.max(maxX + PAD, 480),
    height: Math.max(maxY + NODE_H + PAD, 240),
  };
}

function edgePath(from: Pos, to: Pos): string {
  const x1 = from.x + NODE_W;
  const y1 = from.y + NODE_H / 2;
  const x2 = to.x;
  const y2 = to.y + NODE_H / 2;
  if (x2 >= x1 - 8) {
    const cx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
  }
  const lift = Math.min(from.y, to.y) - 18;
  return `M ${x1} ${y1} C ${x1 + 36} ${y1}, ${x1 + 36} ${lift}, ${(x1 + x2) / 2} ${lift} S ${x2 - 36} ${y2}, ${x2} ${y2}`;
}

function nodeTitle(node: ComboNode, names: Record<string, string>): string {
  if (node.cardIds?.[0]) return cardName(node.cardIds[0], names);
  return node.label;
}

function situationsFor(
  book: ComboBook | null,
  node: ComboNode,
): { title: string; notes: string }[] {
  if (!book) return [];
  const cards = new Set(node.cardIds ?? []);
  const threat = node.id.startsWith("t-") ? node.id.slice(2) : "";
  return book.situations
    .filter((s) => {
      if (threat && (s.when.threats ?? []).includes(threat)) return true;
      if (cards.size === 0) return false;
      const inSteps = s.steps.some(
        (st) =>
          cards.has(st.cardId) ||
          (st.selectCard ?? []).some((id) => cards.has(id)) ||
          (st.selectNextCard ?? []).some((id) => cards.has(id)),
      );
      const inBoard =
        s.endBoard.monsters.some((id) => cards.has(id)) ||
        s.endBoard.spells.some((id) => cards.has(id)) ||
        s.endBoard.grave.some((id) => cards.has(id)) ||
        (s.endBoard.banished ?? []).some((id) => cards.has(id));
      return inSteps || inBoard;
    })
    .map((s) => ({ title: s.title, notes: s.notes }));
}

export function ComboGraph({
  model,
  book,
  names,
  picsDir,
  unknownPic,
}: {
  model: ComboModel;
  book: ComboBook | null;
  names: Record<string, string>;
  picsDir: string;
  unknownPic: string;
}) {
  const { pos, width, height } = useMemo(() => layoutGraph(model), [model]);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = model.nodes.find((n) => n.id === openId) ?? null;

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId]);

  if (model.nodes.length === 0) {
    return (
      <p className="muted">
        El grafo se arma con los pasos del libro. Añade situaciones o un replay.
      </p>
    );
  }

  const incoming = open
    ? model.edges.filter((e) => e.to === open.id)
    : [];
  const outgoing = open
    ? model.edges.filter((e) => e.from === open.id)
    : [];
  const sits = open ? situationsFor(book, open) : [];

  return (
    <>
      <div className="graph-legend">
        {(Object.keys(KIND_LABEL) as ComboEdgeKind[]).map((kind) => (
          <span key={kind} className="graph-legend-item" style={{ color: KIND_COLOR[kind] }}>
            {KIND_LABEL[kind]}
          </span>
        ))}
      </div>
      <div className="graph-scroller">
        <div className="graph-canvas" style={{ width, height }}>
          <svg
            className="graph-wires"
            width={width}
            height={height}
            aria-hidden="true"
          >
            <defs>
              {(Object.keys(KIND_LABEL) as ComboEdgeKind[]).map((kind) => (
                <marker
                  key={kind}
                  id={`arrow-${kind}`}
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={KIND_COLOR[kind]} />
                </marker>
              ))}
            </defs>
            {model.edges.map((e, i) => {
              const a = pos.get(e.from);
              const b = pos.get(e.to);
              if (!a || !b) return null;
              return (
                <path
                  key={`${e.from}-${e.to}-${e.kind}-${i}`}
                  d={edgePath(a, b)}
                  className="graph-wire"
                  stroke={KIND_COLOR[e.kind]}
                  markerEnd={`url(#arrow-${e.kind})`}
                />
              );
            })}
          </svg>
          {model.nodes.map((n) => {
            const p = pos.get(n.id);
            if (!p) return null;
            return (
              <button
                key={n.id}
                type="button"
                className={`graph-chip${openId === n.id ? " active" : ""}${n.id.startsWith("t-") ? " threat" : ""}`}
                style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H }}
                onClick={() => setOpenId(n.id)}
              >
                <strong>{nodeTitle(n, names)}</strong>
                <span>{n.cardIds?.length ? "carta" : "rama"}</span>
              </button>
            );
          })}
        </div>
      </div>
      {open ? (
        <div
          className="graph-modal-root"
          onClick={() => setOpenId(null)}
          role="presentation"
        >
          <div
            className="graph-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="graph-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="ghost"
              onClick={() => setOpenId(null)}
            >
              Cerrar
            </button>
            <h2 id="graph-modal-title">{nodeTitle(open, names)}</h2>
            {open.cardIds?.length ? (
              <CardZone
                label="Cartas"
                codes={open.cardIds}
                names={names}
                picsDir={picsDir}
                unknownPic={unknownPic}
              />
            ) : (
              <p className="muted">{open.label}</p>
            )}
            {sits.length > 0 ? (
              <section>
                <h3>En el libro</h3>
                <ul className="graph-modal-sits">
                  {sits.map((s) => (
                    <li key={s.title}>
                      <strong>{s.title}</strong>
                      {s.notes ? <div className="muted">{s.notes}</div> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {outgoing.length > 0 ? (
              <section>
                <h3>Sale hacia</h3>
                <ul>
                  {outgoing.map((e, i) => (
                    <li key={`out-${i}`}>
                      <span className={`graph-legend-item kind-${e.kind}`}>
                        {KIND_LABEL[e.kind]}
                      </span>{" "}
                      {nodeTitle(
                        model.nodes.find((n) => n.id === e.to) ?? {
                          id: e.to,
                          label: e.to,
                        },
                        names,
                      )}
                      {e.note ? <span className="muted"> — {e.note}</span> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {incoming.length > 0 ? (
              <section>
                <h3>Entra desde</h3>
                <ul>
                  {incoming.map((e, i) => (
                    <li key={`in-${i}`}>
                      <span className={`graph-legend-item kind-${e.kind}`}>
                        {KIND_LABEL[e.kind]}
                      </span>{" "}
                      {nodeTitle(
                        model.nodes.find((n) => n.id === e.from) ?? {
                          id: e.from,
                          label: e.from,
                        },
                        names,
                      )}
                      {e.note ? <span className="muted"> — {e.note}</span> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
