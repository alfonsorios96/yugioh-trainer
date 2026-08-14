import { useCallback, useEffect, useState } from "react";
import {
  parseReplayFilename,
  type ReplayFileInfo,
} from "@yugioh/edopro-bridge";
import { ReplayWalkthroughView, type WalkthroughView } from "./ReplayWalkthrough";
import { resolveCardCatalog } from "./lib/cardCatalog";
import {
  deleteMatchReview,
  getMatchReview,
  listReplayCatalog,
  reviewToView,
  type MatchReviewSummary,
  type ReplayHistoryRow,
  type SavedMatchReview,
} from "./lib/matchHistory";

function formatWhen(ms: number): string {
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return "";
  }
}

function winnerLabel(winner: MatchReviewSummary["winner"]): string {
  if (winner === "you") return "You won";
  if (winner === "opp") return "Opponent won";
  return "No result";
}

function replayTitle(row: ReplayHistoryRow): string {
  if (row.review) return `${row.review.youName} vs ${row.review.oppName}`;
  const parsed = parseReplayFilename(row.file.name);
  if (parsed.player || parsed.opponent) {
    return `${parsed.player ?? "?"} vs ${parsed.opponent ?? "?"}`;
  }
  return row.file.name.replace(/\.(yrpx|yrp|json)$/i, "");
}

export function MatchHistoryPanel({
  edoProPath,
  replayDir,
  onAnalyze,
  onReanalyze,
  onOpenFolder,
  busy,
  refreshToken,
}: {
  edoProPath: string;
  replayDir: string | null;
  busy: boolean;
  refreshToken: number;
  onAnalyze: (file: ReplayFileInfo) => Promise<WalkthroughView | null>;
  onReanalyze: (review: SavedMatchReview) => Promise<WalkthroughView | null>;
  onOpenFolder?: () => void;
}) {
  const [rows, setRows] = useState<ReplayHistoryRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<WalkthroughView | null>(null);
  const [status, setStatus] = useState("");

  const refresh = useCallback(async () => {
    if (!replayDir) {
      setRows([]);
      return;
    }
    try {
      setRows(await listReplayCatalog(replayDir));
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  }, [replayDir]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshToken]);

  async function openReview(id: string) {
    setStatus("");
    const review = await getMatchReview(id);
    if (!review) {
      setStatus("Saved review is missing. Analyze this replay again.");
      await refresh();
      return;
    }
    setSelectedId(id);
    try {
      const resolved = await resolveCardCatalog(edoProPath, review.walk.cardCodes);
      setView(
        reviewToView(review, edoProPath, {
          names: resolved.names,
          unknownMeta: resolved.unknownMeta,
        }),
      );
    } catch {
      setView(reviewToView(review, edoProPath));
    }
  }

  async function handleAnalyze(file: ReplayFileInfo, reviewId: string) {
    setStatus("");
    const next = await onAnalyze(file);
    await refresh();
    if (next) {
      setSelectedId(reviewId);
      setView(next);
    }
  }

  async function handleDelete(id: string) {
    if (
      !window.confirm(
        "Delete the saved review? The replay file in EDOPro stays on disk.",
      )
    ) {
      return;
    }
    await deleteMatchReview(id);
    if (selectedId === id) {
      setSelectedId(null);
      setView(null);
    }
    await refresh();
  }

  async function handleReanalyze(id: string) {
    const review = await getMatchReview(id);
    if (!review) return;
    const next = await onReanalyze(review);
    await refresh();
    if (next) {
      setSelectedId(id);
      setView(next);
    }
  }

  return (
    <section className="panel">
      <h2>History</h2>
      <p className="lead">
        Replays from your Project Ignis folder. Analyze runs the coach once and
        saves it; Review opens that saved walkthrough without calling the API.
      </p>

      {replayDir && (
        <div className="row" style={{ marginBottom: "0.85rem" }}>
          {onOpenFolder && (
            <button className="btn btn-ghost" onClick={onOpenFolder}>
              Open replay folder
            </button>
          )}
          <span className="field-hint" style={{ margin: 0 }}>
            {replayDir}
          </span>
        </div>
      )}

      {!replayDir ? (
        <div className="block">
          <p className="markdownish">
            Set a valid EDOPro / Project Ignis path in Settings. History reads
            the local <code>replay</code> folder.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="block">
          <p className="markdownish">
            No replay files in this folder yet. Play a duel in EDOPro, then
            refresh this tab.
          </p>
        </div>
      ) : (
        <div className="history-list">
          {rows.map((row) => {
            const saved = row.review;
            return (
              <article
                key={row.file.path}
                className={`history-card ${selectedId === row.reviewId ? "active" : ""}`}
              >
                <div className="history-card-main">
                  <strong>{replayTitle(row)}</strong>
                  <span className="history-card-meta">
                    {row.file.name} · {formatWhen(row.file.modifiedMs)}
                  </span>
                  <span className="history-card-tags">
                    {saved ? (
                      <>
                        <span
                          className={`pill ${saved.source === "llm" ? "ok" : "warn"}`}
                        >
                          {saved.source === "llm" ? "IA" : "estático"}
                          {saved.usedModel ? ` · ${saved.usedModel}` : ""}
                        </span>
                        <span className="pill">{winnerLabel(saved.winner)}</span>
                        <span className="pill">{saved.stepCount} events</span>
                      </>
                    ) : (
                      <span className="pill warn">Not analyzed</span>
                    )}
                  </span>
                </div>
                <div className="history-card-actions">
                  {saved ? (
                    <>
                      <button
                        className="btn btn-primary"
                        disabled={busy}
                        onClick={() => void openReview(saved.id)}
                      >
                        Review
                      </button>
                      <button
                        className="btn btn-ghost"
                        disabled={busy}
                        onClick={() => void handleReanalyze(saved.id)}
                      >
                        Re-run AI
                      </button>
                      <button
                        className="btn btn-ghost"
                        disabled={busy}
                        onClick={() => void handleDelete(saved.id)}
                      >
                        Delete review
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={() => void handleAnalyze(row.file, row.reviewId)}
                    >
                      Analizar
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {view && (
        <div className="block" style={{ marginTop: "1.25rem" }}>
          <div className="block-head">
            <h3>Walkthrough</h3>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setSelectedId(null);
                setView(null);
              }}
            >
              Close
            </button>
          </div>
          <ReplayWalkthroughView view={view} />
        </div>
      )}
      {status && <p className="status-line">{status}</p>}
    </section>
  );
}
