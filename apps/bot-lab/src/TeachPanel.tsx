import { useEffect, useMemo, useState } from "react";
import type { CardStance, EndBoard } from "@yugioh/bot-lab";
import type {
  AgentPlayerState,
  DecisionProposal,
  TeachContext,
} from "@yugioh/edopro-bridge";
import { AGENT_DEFAULT_URL } from "@yugioh/edopro-bridge";
import { CardZone, EndBoardZones } from "./CardThumb";
import {
  fetchPending,
  interpretOther,
  pingAgent,
  submitChoice,
  type InterpretResult,
} from "./lib/agent";
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

function promptHeadline(kind: string, role?: string | null, min?: number, max?: number): string {
  if (kind === "select") {
    const span = min != null && max != null ? ` (${min}–${max})` : "";
    const roleBit = role ? ` · ${role}` : "";
    return `Elige objetivo${roleBit}${span}`;
  }
  if (kind === "announce") return "Anuncia una carta";
  if (kind === "chain") return "¿Responder en cadena?";
  if (kind === "option") return "Elige opción";
  if (kind === "idle") return "Elige efecto o jugada";
  return kind;
}

function actionCaption(kind: string, label?: string | null, cardId?: number | null): string {
  if (label) return label;
  if (cardId) return `${kind} ${cardId}`;
  return kind;
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
  const [llmPreview, setLlmPreview] = useState<InterpretResult | null>(null);
  const [llmInterpretedPrompt, setLlmInterpretedPrompt] = useState("");
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<TeachHistoryItem[]>([]);
  const [localNames, setLocalNames] = useState<Record<string, string>>({});
  const [pickedIds, setPickedIds] = useState<string[]>([]);

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
    setPickedIds([]);
    setLlmPreview(null);
    setLlmInterpretedPrompt("");
    setLlmHint("");
  }, [proposal?.requestId]);

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

  const selectMax = context?.constraints?.selectMax ?? 1;
  const multiSelect = (context?.promptKind === "select" || proposal?.context?.promptKind === "select") && selectMax > 1;

  async function pick(actionId: string, extraIds?: string[], choiceNote?: string) {
    if (!proposal) return;
    const actionIds = extraIds && extraIds.length > 0 ? extraIds : [actionId];
    setError("");
    const fromTop5 = topIds.has(actionId);
    const wasFirst = proposal.top5[0]?.actionId === actionId;
    const resolvedNote = (choiceNote ?? note).trim() || null;
    try {
      await submitChoice({
        requestId: proposal.requestId,
        actionId,
        actionIds,
        note: resolvedNote,
      });
      setHistory((prev) => [
        {
          requestId: proposal.requestId,
          chosen: actionIds.join(", "),
          fromTop5,
          wasFirst,
          note: resolvedNote || undefined,
        },
        ...prev,
      ]);
      setNote("");
      setLlmPrompt("");
      setLlmHint("");
      setLlmPreview(null);
      setLlmInterpretedPrompt("");
      setOtherOpen(false);
      setPickedIds([]);
      setProposal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function toggleOrPick(actionId: string) {
    if (!multiSelect) {
      void pick(actionId);
      return;
    }
    setPickedIds((prev) => {
      if (prev.includes(actionId)) return prev.filter((id) => id !== actionId);
      if (prev.length >= selectMax) return prev;
      return [...prev, actionId];
    });
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
        execute: false,
        apiKey: apiKey || undefined,
        baseUrl: apiBaseUrl || undefined,
        model: apiModel || undefined,
      });
      setLlmPreview(result);
      setLlmInterpretedPrompt(prompt);
      setLlmHint(result.rationale);
    } catch (e) {
      setLlmPreview(null);
      setLlmInterpretedPrompt("");
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLlmBusy(false);
    }
  }

  const llmFresh =
    llmPreview != null && llmPrompt.trim() === llmInterpretedPrompt;
  const llmActionIds = llmPreview?.actionIds?.length
    ? llmPreview.actionIds
    : llmPreview?.actionId
      ? [llmPreview.actionId]
      : [];
  const llmConfirmable =
    llmFresh &&
    Boolean(llmPreview?.matched) &&
    !llmPreview?.ambiguous &&
    llmActionIds.length > 0;

  async function confirmLlmPreview() {
    if (!llmConfirmable || llmActionIds.length === 0) return;
    await pick(llmActionIds[0], llmActionIds, llmPrompt.trim());
  }

  return (
    <>
      <h2>Entrenar</h2>
      <p className="lede">
        Cada prompt de EDOPro (efecto, objetivo, anuncio, cadena u opción) trae
        su propia lista. Elige en el top-5 o <strong>Otra</strong>. Servidor:{" "}
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
              <p>
                <strong>
                  {promptHeadline(
                    context?.promptKind ?? "idle",
                    context?.constraints?.selectRole,
                    context?.constraints?.selectMin,
                    context?.constraints?.selectMax,
                  )}
                </strong>
              </p>
              {multiSelect ? (
                <p className="muted">
                  Marca hasta {selectMax} objetivos y confirma.
                </p>
              ) : null}
              <label>
                Nota (opcional)
                <input value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
            </div>
            <div className="teach-choices">
              {proposal.top5.map((a, i) => (
                <button
                  key={a.actionId}
                  className={
                    pickedIds.includes(a.actionId)
                      ? "teach-choice ok"
                      : "teach-choice"
                  }
                  onClick={() => toggleOrPick(a.actionId)}
                >
                  <span className="teach-rank">{i + 1}</span>
                  <strong>
                    {actionCaption(a.kind, a.label, a.cardId)}
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
              {multiSelect ? (
                <button
                  className="primary"
                  disabled={pickedIds.length === 0}
                  onClick={() => void pick(pickedIds[0], pickedIds)}
                >
                  Confirmar {pickedIds.length}/{selectMax}
                </button>
              ) : null}
              {context?.promptKind === "idle" &&
              proposal.legalActions.some((a) => a.kind === "to_ep") ? (
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
              {context?.promptKind === "chain" &&
              proposal.legalActions.some((a) => a.id === "chain-pass") ? (
                <button
                  className="danger"
                  onClick={() => void pick("chain-pass")}
                >
                  Pasar cadena
                </button>
              ) : null}
              {context?.promptKind === "select" &&
              proposal.legalActions.some((a) => a.id === "select-skip") ? (
                <button
                  className="ghost"
                  onClick={() => void pick("select-skip")}
                >
                  Cancelar selección
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
                    className="ghost"
                    disabled={llmBusy}
                    onClick={() => void runLlmPrompt()}
                  >
                    {llmBusy ? "Interpretando…" : "Interpretar"}
                  </button>
                  <button
                    className="primary"
                    disabled={llmBusy || !llmConfirmable}
                    onClick={() => void confirmLlmPreview()}
                  >
                    Confirmar acciones
                  </button>
                </div>
                {llmPreview ? (
                  <div className={llmFresh ? "llm-preview" : "llm-preview stale"}>
                    <p>
                      <strong>Entendí: </strong>
                      {llmPreview.understood || "sin interpretación"}
                    </p>
                    {llmPreview.actions && llmPreview.actions.length > 0 ? (
                      <>
                        <p className="muted">
                          {llmPreview.ambiguous
                            ? "Hay varias acciones posibles; concreta el prompt."
                            : "Acciones legales que aplicaría:"}
                        </p>
                        <ul className="llm-actions">
                          {llmPreview.actions.map((a) => (
                            <li key={a.id}>
                              {a.label || actionCaption(a.kind ?? "", null, a.cardId)}
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <p className="muted">
                        Ninguna acción legal encaja con este prompt.
                      </p>
                    )}
                    {!llmFresh ? (
                      <p className="muted">
                        El prompt cambió — interpreta de nuevo para confirmar.
                      </p>
                    ) : null}
                    {llmHint ? <p className="muted">{llmHint}</p> : null}
                  </div>
                ) : llmHint ? (
                  <p className="muted">{llmHint}</p>
                ) : (
                  <p className="muted">
                    Interpreta primero: verás qué se entendió y qué acciones
                    legales aplicaría, sin ejecutarlas.
                  </p>
                )}
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
                      onClick={() => toggleOrPick(a.id)}
                    >
                      {actionCaption(a.kind, a.label, a.cardId)}
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
          {promptHeadline(
            context.promptKind,
            context.constraints?.selectRole,
            context.constraints?.selectMin,
            context.constraints?.selectMax,
          )}{" "}
          · {situationId ?? "sin situación"} · {mode}
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
