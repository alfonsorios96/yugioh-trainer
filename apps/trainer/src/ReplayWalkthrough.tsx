import { useMemo, useState } from "react";
import type { StepCoaching } from "@yugioh/coach";
import {
  type BoardSnapshot,
  type CardRef,
  type ReplayStep,
  type ReplayWalkthrough,
  type UnknownCardMeta,
} from "@yugioh/edopro-bridge";
import { CardThumb } from "./CardInspector";

export interface WalkthroughView {
  walk: ReplayWalkthrough;
  names: Record<string, string>;
  unknownMeta?: Record<string, UnknownCardMeta>;
  picsDir: string;
  unknownPic: string;
  coaching: StepCoaching[];
  source: "static" | "llm";
  error?: string;
  usedModel?: string;
  fromCache?: boolean;
  savedAt?: number;
}

function CardRow({
  label,
  cards,
  names,
  unknownMeta,
  picsDir,
  unknownPic,
  hideNames,
}: {
  label: string;
  cards: CardRef[];
  names: Record<string, string>;
  unknownMeta?: Record<string, UnknownCardMeta>;
  picsDir: string;
  unknownPic: string;
  hideNames?: boolean;
}) {
  if (cards.length === 0) {
    return (
      <div className="card-row">
        <span className="card-row-label">{label}</span>
        <span className="card-row-empty">vacío</span>
      </div>
    );
  }
  return (
    <div className="card-row">
      <span className="card-row-label">{label}</span>
      <div className="card-row-cards">
        {cards.map((c, i) => (
          <CardThumb
            key={`${c.code}-${i}`}
            card={c}
            names={names}
            unknownMeta={unknownMeta}
            picsDir={picsDir}
            unknownPic={unknownPic}
            hidden={hideNames}
          />
        ))}
      </div>
    </div>
  );
}

function MiniBoard({
  board,
  names,
  unknownMeta,
  picsDir,
  unknownPic,
  showOppHand,
}: {
  board: BoardSnapshot;
  names: Record<string, string>;
  unknownMeta?: Record<string, UnknownCardMeta>;
  picsDir: string;
  unknownPic: string;
  showOppHand: boolean;
}) {
  return (
    <div className="mini-board">
      <CardRow
        label="S/T rival"
        cards={board.oppSpells}
        names={names}
        unknownMeta={unknownMeta}
        picsDir={picsDir}
        unknownPic={unknownPic}
      />
      <CardRow
        label="Monstruos rival"
        cards={board.oppMonsters}
        names={names}
        unknownMeta={unknownMeta}
        picsDir={picsDir}
        unknownPic={unknownPic}
      />
      <CardRow
        label="Tus monstruos"
        cards={board.youMonsters}
        names={names}
        unknownMeta={unknownMeta}
        picsDir={picsDir}
        unknownPic={unknownPic}
      />
      <CardRow
        label="Tus S/T"
        cards={board.youSpells}
        names={names}
        unknownMeta={unknownMeta}
        picsDir={picsDir}
        unknownPic={unknownPic}
      />
      <CardRow
        label="Tu mano"
        cards={board.youHand}
        names={names}
        unknownMeta={unknownMeta}
        picsDir={picsDir}
        unknownPic={unknownPic}
      />
      {showOppHand && (
        <CardRow
          label="Mano rival"
          cards={board.oppHand}
          names={names}
          unknownMeta={unknownMeta}
          picsDir={picsDir}
          unknownPic={unknownPic}
        />
      )}
    </div>
  );
}

const VERDICT_LABEL: Record<StepCoaching["verdict"], string> = {
  ok: "OK",
  better: "Había mejor",
  bad: "Mal",
};

export function ReplayWalkthroughView({ view }: { view: WalkthroughView }) {
  const decisionIdx = useMemo(
    () => view.walk.steps.map((s, i) => (s.decision || s.kind === "draw" || s.kind === "win" ? i : -1)).filter((i) => i >= 0),
    [view.walk.steps],
  );
  const [cursor, setCursor] = useState(0);
  const stepIndex = decisionIdx[cursor] ?? 0;
  const step: ReplayStep | undefined = view.walk.steps[stepIndex];
  const coaching = step
    ? view.coaching.find((c) => c.id === step.id)
    : undefined;

  if (!step) {
    return <p className="lead">No se pudieron extraer jugadas de este replay.</p>;
  }

  const verdict = step.decision ? (coaching?.verdict ?? "ok") : null;

  return (
    <div className="walkthrough">
      <div className="walkthrough-meta">
        <strong>
          {view.walk.youName} vs {view.walk.oppName}
        </strong>
        <span>
          LP {step.board.lpYou} — {step.board.lpOpp} · Turno {step.turn || "–"} · {step.phase}
        </span>
        <span className="walkthrough-source">
          Coach: {view.source === "llm" ? "IA" : "estático"}
          {view.fromCache ? " · guardado" : ""}
          {view.usedModel ? ` · ${view.usedModel}` : ""}
        </span>
      </div>
      {view.error && (
        <p className="walkthrough-error">
          La IA no se usó: {view.error}
        </p>
      )}

      <MiniBoard
        board={step.board}
        names={view.names}
        unknownMeta={view.unknownMeta}
        picsDir={view.picsDir}
        unknownPic={view.unknownPic}
        showOppHand={step.kind === "draw"}
      />

      <div className={`play-callout ${step.actor}`}>
        <div className="play-callout-kicker">
          {step.actor === "you" ? "Tu opción" : "Jugada del rival"}
        </div>
        <p>{step.chosen}</p>
      </div>

      {verdict && coaching && (
        <div className={`verdict verdict-${verdict}`}>
          <strong>{VERDICT_LABEL[verdict]}</strong>
          <p>{coaching.explanation}</p>
        </div>
      )}

      <div className="walkthrough-nav">
        <button
          className="btn btn-secondary"
          disabled={cursor <= 0}
          onClick={() => setCursor((c) => Math.max(0, c - 1))}
        >
          Anterior
        </button>
        <span>
          {cursor + 1} / {decisionIdx.length}
        </span>
        <button
          className="btn btn-primary"
          disabled={cursor >= decisionIdx.length - 1}
          onClick={() => setCursor((c) => Math.min(decisionIdx.length - 1, c + 1))}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
