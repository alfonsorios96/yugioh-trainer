import { useEffect, useMemo, useState } from "react";
import type { CardStance, EndBoard } from "@yugioh/bot-lab";
import type {
  AgentPlayerState,
  DecisionProposal,
  TeachContext,
} from "@yugioh/edopro-bridge";
import { AGENT_DEFAULT_URL } from "@yugioh/edopro-bridge";
import { CardZone, EndBoardZones } from "./CardThumb";
import { fetchPending, interpretOther, pingAgent, submitChoice } from "./lib/agent";
import { queryCardNames } from "./lib/bridge";

export interface TeachHistoryItem {
  requestId: string;
  chosen: string;
  fromTop5: boolean;
  wasFirst: boolean;
  note?: string;
}

export interface TeachArt {
  picsDir: string;
  unknownPic: string;
  coverPic: string;
}

function asStance(value: string | undefined): CardStance {
  if (value === "atk" || value === "def" || value === "set") return value;
  return "";
}

function playerToBoard(p: AgentPlayerState): EndBoard {
  return {
    monsters: p.monsters ?? [],
    spells: p.spells ?? [],
    grave: p.grave ?? [],
    banished: p.banished ?? [],
    monsterZones: p.monsterZones,
    spellZones: p.spellZones,
    monsterStances: p.monsterStances?.map(asStance),
    spellStances: p.spellStances?.map(asStance),
  };
}

function collectCodes(ctx: TeachContext): number[] {
  const out: number[] = [];
  for (const p of [ctx.self, ctx.opp]) {
    out.push(
      ...(p.hand ?? []),
      ...(p.monsters ?? []),
      ...(p.spells ?? []),
      ...(p.grave ?? []),
      ...(p.banished ?? []),
      ...(p.extra ?? []),
      ...(p.monsterZones ?? []),
      ...(p.spellZones ?? []),
    );
  }
  return out.filter((id) => id > 0);
}

export function TeachPanel({
  art,
  edoProPath,
  names,
  apiKey = "",
  apiBaseUrl = "",
  apiModel = "",
}: {
  art: TeachArt;
  edoProPath: string;
  names: Record<string, string>;
  apiKey?: string;
  apiBaseUrl?: string;
  apiModel?: string;
}) {
  const [online, setOnline] = useState(false);
  const [proposal, setProposal] = useState<DecisionProposal | null>(null);
  const [error, setError] = useState("");
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherQuery, setOtherQuery] = useState("");
  const [llmPrompt, setLlmPrompt] = useState("");
  const [llmBusy, setLlmBusy] = useState(false);
  const [llmHint, setLlmHint] = useState("");
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<TeachHistoryItem[]>([]);
  const [localNames, setLocalNames] = useState<Record<string, string>>({});

  const mergedNames = useMemo(
    () => ({ ...names, ...localNames }),
    [names, localNames],
  );

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const up = await pingAgent();
      if (cancelled) return;
      setOnline(up);
      if (!up) {
        setProposal(null);
        return;
      }
      try {
        const next = await fetchPending();
        if (!cancelled) {
          setProposal(next);
          setError("");
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 400);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const context = proposal?.context ?? null;

  useEffect(() => {
    if (!context || !edoProPath) return;
    let cancelled = false;
    void (async () => {
      const extra = await queryCardNames(edoProPath, collectCodes(context));
      if (!cancelled && Object.keys(extra).length > 0) {
        setLocalNames((prev) => ({ ...prev, ...extra }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [context, edoProPath]);

  const topIds = useMemo(
    () => new Set(proposal?.top5.map((a) => a.actionId) ?? []),
    [proposal],
  );

  const others = useMemo(() => {
    if (!proposal) return [];
    const q = otherQuery.trim().toLowerCase();
    return proposal.legalActions.filter((a) => {
      if (topIds.has(a.id)) return false;
      if (!q) return true;
      return (
        a.id.toLowerCase().includes(q) ||
        a.kind.toLowerCase().includes(q) ||
        String(a.cardId ?? "").includes(q) ||
        (a.label ?? "").toLowerCase().includes(q)
      );
    });
  }, [proposal, otherQuery, topIds]);

  async function pick(actionId: string) {
    if (!proposal) return;
    setError("");
    const fromTop5 = topIds.has(actionId);
    const wasFirst = proposal.top5[0]?.actionId === actionId;
    try {
      await submitChoice({
        requestId: proposal.requestId,
        actionId,
        note: note.trim() || null,
      });
      setHistory((prev) => [
        {
          requestId: proposal.requestId,
          chosen: actionId,
          fromTop5,
          wasFirst,
          note: note.trim() || undefined,
        },
        ...prev,
      ]);
      setNote("");
      setLlmPrompt("");
      setLlmHint("");
      setOtherOpen(false);
      setProposal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function runLlmPrompt() {
    if (!proposal) return;
    const prompt = llmPrompt.trim();
    if (!prompt) {
      setLlmHint("Escribe la jugada, p. ej. Invocar normal Comic Cat.");
      return;
    }
    setLlmBusy(true);
    setError("");
    setLlmHint("");
    try {
      const result = await interpretOther({
        requestId: proposal.requestId,
        prompt,
        execute: true,
        apiKey: apiKey || undefined,
        baseUrl: apiBaseUrl || undefined,
        model: apiModel || undefined,
      });
      if (!result.matched || !result.actionId) {
        setLlmHint(result.rationale);
        return;
      }
      const fromTop5 = topIds.has(result.actionId);
      const wasFirst = proposal.top5[0]?.actionId === result.actionId;
      setHistory((prev) => [
        {
          requestId: proposal.requestId,
          chosen: result.actionId!,
          fromTop5,
          wasFirst,
          note: prompt,
        },
        ...prev,
      ]);
      setNote("");
      setLlmPrompt("");
      setLlmHint(result.rationale);
      setOtherOpen(false);
      setProposal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLlmBusy(false);
    }
  }

  return (
    <>
      <h2>Entrenar</h2>
      <p className="lede">
        Mira el campo actual de la IA, luego elige una de las 5 mejores (o{" "}
        <strong>Otra</strong>). EDOPro espera. Servidor:{" "}
        <code>{AGENT_DEFAULT_URL}</code>
      </p>
      <p className={online ? "ok" : "bad"}>
        {online ? "Agente en línea" : "Agente apagado — `python -m yugioh_agentic serve`"}
      </p>
      {error ? <div className="banner warn">{error}</div> : null}

      {!proposal ? (
        <div className="card">
          <p className="muted">
            Esperando un prompt de EDOPro / WindBot Toon2026Agent…
          </p>
        </div>
      ) : (
        <div className="teach-layout">
          <div className="teach-context">
            {context ? (
              <TeachContextBoard
                context={context}
                targetBoard={proposal.targetBoard}
                situationId={proposal.situationId}
                mode={proposal.mode}
                rankMs={proposal.rankMs}
                art={art}
                names={mergedNames}
              />
            ) : (
              <div className="card">
                <p className="muted">
                  {proposal.situationId ?? "sin situación"} · {proposal.mode}
                </p>
                <p>{proposal.targetBoard}</p>
                <p className="muted">
                  Reinicia el servidor agéntico para ver el campo actual.
                </p>
              </div>
            )}
          </div>
          <div className="teach-actions">
            <div className="card">
              <label>
                Nota (opcional)
                <input value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
            </div>
            <div className="teach-choices">
              {proposal.top5.map((a, i) => (
                <button
                  key={a.actionId}
                  className="teach-choice"
                  onClick={() => void pick(a.actionId)}
                >
                  <span className="teach-rank">{i + 1}</span>
                  <strong>
                    {a.kind} {a.label ?? a.cardId ?? ""}
                  </strong>
                  <span className="muted">
                    {a.score.toFixed(0)} — {a.why}
                  </span>
                </button>
              ))}
            </div>
            <div className="row" style={{ margin: "1rem 0" }}>
              <button className="ghost" onClick={() => setOtherOpen((v) => !v)}>
                Otra…
              </button>
              {proposal.legalActions.some((a) => a.kind === "to_ep") ? (
                <button
                  className="danger"
                  onClick={() =>
                    void pick(
                      proposal.legalActions.find((a) => a.kind === "to_ep")!.id,
                    )
                  }
                >
                  Pasar turno
                </button>
              ) : null}
            </div>
            {otherOpen ? (
              <div className="card">
                <label>
                  Prompt LLM — describe la jugada
                  <textarea
                    value={llmPrompt}
                    onChange={(e) => setLlmPrompt(e.target.value)}
                    placeholder='Invocar normal "Comic Cat"'
                    rows={3}
                  />
                </label>
                <div className="row" style={{ margin: "0.65rem 0 0.85rem" }}>
                  <button
                    className="primary"
                    disabled={llmBusy}
                    onClick={() => void runLlmPrompt()}
                  >
                    {llmBusy ? "Interpretando…" : "Ejecutar con LLM"}
                  </button>
                </div>
                {llmHint ? <p className="muted">{llmHint}</p> : null}
                <label>
                  O elige de la lista legal
                  <input
                    value={otherQuery}
                    onChange={(e) => setOtherQuery(e.target.value)}
                    placeholder="Filtrar por nombre o id"
                  />
                </label>
                <div className="teach-others">
                  {others.map((a) => (
                    <button
                      key={a.id}
                      className="ghost"
                      onClick={() => void pick(a.id)}
                    >
                      {a.kind} {a.label ?? a.cardId ?? a.id}
                    </button>
                  ))}
                  {others.length === 0 ? (
                    <p className="muted">No hay más acciones en la lista legal.</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <h3>Sesión</h3>
      <div className="card">
        {history.length === 0 ? (
          <p className="muted">Aún no hay choices.</p>
        ) : (
          history.map((h) => (
            <div key={h.requestId} className="log-item">
              <strong className={h.wasFirst ? "ok" : h.fromTop5 ? "" : "bad"}>
                {h.chosen}
              </strong>{" "}
              <span className="muted">
                {h.wasFirst
                  ? "ranker #1"
                  : h.fromTop5
                    ? "en top-5"
                    : "Otra (hard negative)"}
              </span>
              {h.note ? <div>{h.note}</div> : null}
            </div>
          ))
        )}
      </div>
    </>
  );
}

function TeachContextBoard({
  context,
  targetBoard,
  situationId,
  mode,
  rankMs,
  art,
  names,
}: {
  context: TeachContext;
  targetBoard: string;
  situationId: string | null;
  mode: string;
  rankMs?: number;
  art: TeachArt;
  names: Record<string, string>;
}) {
  const selfBoard = playerToBoard(context.self);
  const oppBoard = playerToBoard(context.opp);
  const threats = context.threats?.length ? context.threats.join(", ") : "ninguna";
  return (
    <>
      <div className="card">
        <p className="muted">
          T{context.turn} · {context.phase} · going {context.going} ·{" "}
          {context.promptKind} · {situationId ?? "sin situación"} · {mode}
          {rankMs != null ? ` · ${rankMs.toFixed(1)} ms` : ""}
        </p>
        <p className="muted">
          LP {context.self.lp} / {context.opp.lp} · amenazas: {threats}
          {context.constraints?.normalSummonUsed ? " · NS usada" : ""}
          {context.constraints?.summonCount
            ? ` · summons ${context.constraints.summonCount}`
            : ""}
        </p>
        {targetBoard ? (
          <p>
            <strong>Objetivo: </strong>
            {targetBoard}
          </p>
        ) : null}
      </div>
      <h3>Campo actual (IA)</h3>
      <CardZone
        label="Mano"
        codes={context.self.hand ?? []}
        names={names}
        picsDir={art.picsDir}
        unknownPic={art.unknownPic}
      />
      <EndBoardZones
        board={selfBoard}
        names={names}
        picsDir={art.picsDir}
        unknownPic={art.unknownPic}
        coverPic={art.coverPic}
      />
      {(context.self.extra ?? []).length > 0 ? (
        <CardZone
          label="Extra"
          codes={context.self.extra ?? []}
          names={names}
          picsDir={art.picsDir}
          unknownPic={art.unknownPic}
        />
      ) : null}
      <h3>Campo rival</h3>
      <EndBoardZones
        board={oppBoard}
        names={names}
        picsDir={art.picsDir}
        unknownPic={art.unknownPic}
        coverPic={art.coverPic}
      />
    </>
  );
}
