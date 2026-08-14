import { useCallback, useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { uniqueCardCount, type ChatMessage, type DeckListSnapshot, type SessionPlan } from "@yugioh/coach";
import {
  mergeCardNames,
  replaceHashCodes,
  windBotCommandLine,
  type EdoProInstallInfo,
  type LaunchPlan,
  type ReplayFileInfo,
  type YdkDeck,
} from "@yugioh/edopro-bridge";
import "./App.css";
import { getLessonForRival, getRival, rivals, academy, META_ENGINE_YDK_FILES } from "./lib/content";
import {
  analyzeWindBotDecks,
  createLaunchPlan,
  importYdkToInstall,
  listYdkDecks,
  loadWalkthroughForFile,
  probeInstallAsync,
  startTrainingDuel,
  suggestInstallPaths,
  syncRivalBots,
  type WindBotInventoryAnalysis,
} from "./lib/bridgeService";
import {
  chatWithCoach,
  coachReplaySteps,
  deckSessionPlan,
  preDuelAdvice,
  probeLlmConnection,
} from "./lib/coachService";
import {
  resolveCardCatalog,
  resyncUnknownCardCache,
  unknownCardCacheCount,
} from "./lib/cardCatalog";
import { loadSettings, saveSettings, type AppSettings } from "./lib/settings";
import { native } from "./lib/native";
import { snapshotFromYdk } from "./lib/playerDeck";
import { SessionPlanPanel } from "./SessionPlanPanel";
import { type WalkthroughView } from "./ReplayWalkthrough";
import { MatchHistoryPanel } from "./MatchHistory";
import {
  buildSavedReview,
  findReviewForReplay,
  isReusableLlmReview,
  replayReviewId,
  reviewToView,
  saveMatchReview,
  type SavedMatchReview,
} from "./lib/matchHistory";

type Tab = "home" | "train" | "coach" | "history" | "settings";
type ConnState = "checking" | "ok" | "warn" | "bad";
type ConnBadge = { state: ConnState; label: string };

const SETTINGS_FORM_KEYS = [
  "edoProPath",
  "windBotHost",
  "windBotPort",
  "apiKey",
  "apiBaseUrl",
  "apiModel",
] as const satisfies readonly (keyof AppSettings)[];

const CHAT_TEMPLATES = [
  "Tengo Ash en mano, ¿cuándo la uso?",
  "¿Qué debo negar con prioridad?",
  "¿Cómo gano el grind en este matchup?",
  "Acabo de romper su board, ¿cómo finalizo?",
];

function settingsFormDirty(a: AppSettings, b: AppSettings): boolean {
  return SETTINGS_FORM_KEYS.some((key) => a[key] !== b[key]);
}

function edoConnectionBadge(
  path: string,
  install: EdoProInstallInfo | null,
): ConnBadge {
  if (!path.trim()) return { state: "bad", label: "No path" };
  if (!install) return { state: "checking", label: "Checking…" };
  if (install.valid) return { state: "ok", label: "Connected" };
  if (install.executablePath || install.hasWindBot) {
    return { state: "warn", label: "Partial install" };
  }
  return { state: "bad", label: "Not found" };
}

function ConnectionBadge({ state, label }: ConnBadge) {
  return (
    <span className={`conn-badge ${state}`} title={label}>
      <span className="conn-dot" aria-hidden />
      {label}
    </span>
  );
}

function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [install, setInstall] = useState<EdoProInstallInfo | null>(null);
  const [windBotAnalysis, setWindBotAnalysis] =
    useState<WindBotInventoryAnalysis | null>(null);
  const [showAllWindBotDecks, setShowAllWindBotDecks] = useState(false);
  const [decks, setDecks] = useState<YdkDeck[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [launchPlan, setLaunchPlan] = useState<LaunchPlan | null>(null);
  const [briefing, setBriefing] = useState("");
  const [historyTick, setHistoryTick] = useState(0);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [persistedSettings, setPersistedSettings] = useState<AppSettings | null>(
    null,
  );
  const [windBotConn, setWindBotConn] = useState<ConnBadge>({
    state: "checking",
    label: "Checking…",
  });
  const [llmConn, setLlmConn] = useState<ConnBadge>({
    state: "checking",
    label: "Checking…",
  });
  const [unknownCardCount, setUnknownCardCount] = useState(0);
  const [playerDeck, setPlayerDeck] = useState<DeckListSnapshot | undefined>();
  const [sessionPlan, setSessionPlan] = useState<SessionPlan | null>(null);
  const [goalChecked, setGoalChecked] = useState<Record<string, boolean>>({});

  const rival = useMemo(
    () => getRival(settings?.selectedRivalId ?? "blue-eyes") ?? rivals[0],
    [settings?.selectedRivalId],
  );
  const lesson = useMemo(() => getLessonForRival(rival), [rival]);
  const selectedDeck = useMemo(
    () => decks.find((d) => d.path === settings?.selectedDeckPath) ?? null,
    [decks, settings?.selectedDeckPath],
  );

  useEffect(() => {
    if (!selectedDeck || !settings?.edoProPath) {
      setPlayerDeck(undefined);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const codes = [
          ...selectedDeck.main,
          ...selectedDeck.extra,
          ...selectedDeck.side,
        ];
        const resolved = await resolveCardCatalog(settings.edoProPath, codes);
        if (!cancelled) setPlayerDeck(snapshotFromYdk(selectedDeck, resolved.names));
      } catch {
        if (!cancelled) setPlayerDeck(snapshotFromYdk(selectedDeck, {}));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDeck, settings?.edoProPath]);

  useEffect(() => {
    if (!settings) return;
    let cancelled = false;
    void (async () => {
      const plan = await deckSessionPlan(
        settings,
        rival.name,
        lesson,
        academy,
        playerDeck,
      );
      if (!cancelled) {
        setSessionPlan(plan);
        setGoalChecked({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [settings, rival.name, lesson, playerDeck]);

  const refreshInstall = useCallback(async (path: string) => {
    if (!path) {
      setInstall(null);
      setWindBotAnalysis(null);
      setDecks([]);
      return;
    }
    const info = await probeInstallAsync(path);
    setInstall(info);
    if (info.deckDir) {
      try {
        setDecks(await listYdkDecks(info.deckDir));
      } catch {
        setDecks([]);
      }
    } else {
      setDecks([]);
    }
    if (info.hasWindBot) {
      try {
        setWindBotAnalysis(await analyzeWindBotDecks(info, rivals));
      } catch {
        setWindBotAnalysis(null);
      }
    } else {
      setWindBotAnalysis(null);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const s = await loadSettings();
      setSettings(s);
      setPersistedSettings(s);
      await refreshInstall(s.edoProPath);
      try {
        setSuggestions(await suggestInstallPaths());
      } catch {
        setSuggestions([]);
      }
    })();
  }, [refreshInstall]);

  async function updateSettings(partial: Partial<AppSettings>) {
    if (!settings) return;
    const next = { ...settings, ...partial };
    setSettings(next);
    await saveSettings(partial);
    setPersistedSettings((prev) => (prev ? { ...prev, ...partial } : next));
    if (partial.edoProPath !== undefined) {
      await refreshInstall(partial.edoProPath);
    }
  }

  const probeLiveConnections = useCallback(async (s: AppSettings) => {
    setWindBotConn({ state: "checking", label: "Checking…" });
    setLlmConn({ state: "checking", label: "Checking…" });
    const [tcp, llm] = await Promise.all([
      native
        .checkTcp(s.windBotHost.trim() || "127.0.0.1", s.windBotPort || 7911)
        .then((open) =>
          open
            ? ({ state: "ok", label: "Room open" } satisfies ConnBadge)
            : ({
                state: "warn",
                label: "No room yet",
              } satisfies ConnBadge),
        )
        .catch(() => ({ state: "bad", label: "Unreachable" }) satisfies ConnBadge),
      probeLlmConnection(s),
    ]);
    setWindBotConn(tcp);
    setLlmConn(llm);
  }, []);

  useEffect(() => {
    if (tab !== "settings" || !persistedSettings) return;
    void probeLiveConnections(persistedSettings);
    void unknownCardCacheCount()
      .then(setUnknownCardCount)
      .catch(() => setUnknownCardCount(0));
  }, [tab, persistedSettings, probeLiveConnections]);

  async function handleResyncUnknownCards() {
    if (!settings?.edoProPath) {
      setStatus("Set your EDOPro folder first.");
      return;
    }
    setBusy(true);
    try {
      const result = await resyncUnknownCardCache(settings.edoProPath);
      setUnknownCardCount(result.remaining);
      const parts = [
        result.removedOfficial
          ? `${result.removedOfficial} temporales borradas (ya oficiales)`
          : "ninguna temporal pasó a oficial",
        `${result.remaining} temporales restantes`,
      ];
      if (result.refreshed) parts.push(`${result.refreshed} actualizadas desde internet`);
      setStatus(`Cartas: ${parts.join(" · ")}.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveSettings() {
    if (!settings) return;
    setBusy(true);
    try {
      await saveSettings(settings);
      setPersistedSettings(settings);
      await refreshInstall(settings.edoProPath);
      await probeLiveConnections(settings);
      setStatus("Settings saved.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function pickEdoProFolder() {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      await updateSettings({ edoProPath: selected });
      setStatus(`EDOPro path set: ${selected}`);
    }
  }

  async function pickDeckFile() {
    const selected = await open({
      multiple: false,
      filters: [{ name: "YGO Deck", extensions: ["ydk"] }],
    });
    if (typeof selected !== "string" || !install?.deckDir) return;
    setBusy(true);
    try {
      const deck = await importYdkToInstall(selected, install.deckDir);
      await updateSettings({ selectedDeckPath: deck.path });
      setDecks(await listYdkDecks(install.deckDir));
      setStatus(`Imported deck ${deck.name}`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleSyncBots() {
    if (!install?.valid) {
      setStatus("Configure a valid EDOPro path with WindBot first.");
      return;
    }
    setBusy(true);
    try {
      const result = await syncRivalBots(install, rivals, META_ENGINE_YDK_FILES);
      const engineNote = result.engines.length
        ? ` Engine decks: ${result.engines.join(", ")}.`
        : "";
      setStatus(
        `WindBot bots synced. Added: ${result.added.join(", ") || "none"}. Updated: ${
          result.updated.join(", ") || "none"
        }.${engineNote}`,
      );
      if (settings?.edoProPath) {
        await refreshInstall(settings.edoProPath);
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleStartDuel() {
    if (!settings || !install) return;
    setBusy(true);
    setStatus("Preparing training duel…");
    try {
      if (install.valid) {
        await syncRivalBots(install, rivals, META_ENGINE_YDK_FILES);
      }
      const plan = createLaunchPlan(
        settings.edoProPath,
        rival,
        settings.selectedDeckPath || undefined,
        settings.windBotHost,
        settings.windBotPort,
      );
      setLaunchPlan(plan);
      const result = await startTrainingDuel(plan);
      const parts = [
        result.edo.ok ? "EDOPro launched." : `EDOPro: ${result.edo.message}`,
        result.windbot.ok ? "WindBot launched." : `WindBot: ${result.windbot.message}`,
        "Host a local room in EDOPro (port 7911) if the bot cannot join yet.",
      ];
      setStatus(parts.join(" "));
      setTab("coach");
      const advice = await preDuelAdvice(
        settings,
        rival.name,
        lesson,
        playerDeck,
        sessionPlan?.goals,
      );
      setBriefing(advice.content);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleBriefing() {
    if (!settings) return;
    setBusy(true);
    try {
      const advice = await preDuelAdvice(
        settings,
        rival.name,
        lesson,
        playerDeck,
        sessionPlan?.goals,
      );
      setBriefing(advice.content);
      setStatus(`Briefing source: ${advice.source}${advice.usedModel ? ` (${advice.usedModel})` : ""}`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendChat(message: string) {
    if (!settings || !message.trim()) return;
    const userMsg: ChatMessage = { role: "user", content: message.trim() };
    const history = [...chat, userMsg];
    setChat(history);
    setChatInput("");
    setBusy(true);
    try {
      const reply = await chatWithCoach(
        settings,
        rival.name,
        lesson,
        history,
        userMsg.content,
        playerDeck,
        sessionPlan?.goals,
      );
      setChat([...history, { role: "assistant", content: reply.content }]);
    } catch (e) {
      setChat([
        ...history,
        {
          role: "assistant",
          content: e instanceof Error ? e.message : String(e),
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function handleAnalyzeReplay(
    file: ReplayFileInfo,
    force = false,
  ): Promise<WalkthroughView | null> {
    if (!settings) return null;
    setBusy(true);
    try {
      if (!force) {
        const cached = await findReviewForReplay(file);
        if (cached && isReusableLlmReview(cached)) {
          const cachedView = reviewToView(cached, settings.edoProPath);
          setStatus(`Replay: ${cached.replayName} · saved IA (no API call)`);
          return cachedView;
        }
      }

      const loaded = await loadWalkthroughForFile(file, settings.edoProPath);
      const coached = await coachReplaySteps(
        settings,
        rival.name,
        lesson,
        loaded.walk.steps.map((s) => ({
          id: s.id,
          turn: s.turn,
          phase: s.phase,
          kind: s.kind,
          chosen: s.chosen,
          actor: s.actor,
          decision: s.decision,
        })),
        playerDeck,
        sessionPlan?.goals,
      );
      const saved = buildSavedReview({
        file: loaded.file,
        id: await replayReviewId(loaded.file),
        walk: loaded.walk,
        names: loaded.names,
        unknownMeta: loaded.unknownMeta,
        coaching: coached.coaching,
        source: coached.source,
        error: coached.error,
        usedModel: coached.usedModel,
        rivalName: rival.name,
        rivalId: rival.id,
      });
      await saveMatchReview(saved);
      setHistoryTick((n) => n + 1);
      void unknownCardCacheCount().then(setUnknownCardCount).catch(() => undefined);
      const view: WalkthroughView = {
        walk: loaded.walk,
        names: loaded.names,
        unknownMeta: loaded.unknownMeta,
        picsDir: loaded.picsDir,
        unknownPic: loaded.unknownPic,
        coaching: coached.coaching,
        source: coached.source,
        error: coached.error,
        usedModel: coached.usedModel,
        fromCache: false,
        savedAt: saved.savedAt,
      };
      setStatus(
        coached.error
          ? `Replay: ${loaded.file.name} · saved static — ${coached.error}`
          : `Replay: ${loaded.file.name} · ${loaded.walk.steps.length} eventos · coach ${coached.source}${coached.usedModel ? ` (${coached.usedModel})` : ""} · saved`,
      );
      return view;
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function handleReanalyzeSaved(
    review: SavedMatchReview,
  ): Promise<WalkthroughView | null> {
    if (!settings) return null;
    setBusy(true);
    try {
      const matchup = getRival(review.rivalId) ?? rival;
      const matchupLesson = getLessonForRival(matchup);
      const resolved = await resolveCardCatalog(
        settings.edoProPath,
        review.walk.cardCodes,
      );
      const names = mergeCardNames(review.names, resolved.names);
      const walk = {
        ...review.walk,
        steps: review.walk.steps.map((step) => ({
          ...step,
          chosen: replaceHashCodes(step.chosen, names),
        })),
      };
      const coached = await coachReplaySteps(
        settings,
        review.rivalName,
        matchupLesson,
        walk.steps.map((s) => ({
          id: s.id,
          turn: s.turn,
          phase: s.phase,
          kind: s.kind,
          chosen: s.chosen,
          actor: s.actor,
          decision: s.decision,
        })),
        playerDeck,
        sessionPlan?.goals,
      );
      const next: SavedMatchReview = {
        ...review,
        walk,
        names,
        unknownMeta: resolved.unknownMeta,
        coaching: coached.coaching,
        source: coached.source,
        error: coached.error,
        usedModel: coached.usedModel,
        savedAt: Date.now(),
      };
      await saveMatchReview(next);
      setHistoryTick((n) => n + 1);
      void unknownCardCacheCount().then(setUnknownCardCount).catch(() => undefined);
      const view: WalkthroughView = {
        ...reviewToView(next, settings.edoProPath),
        fromCache: false,
      };
      setStatus(
        coached.error
          ? `Re-run failed — ${coached.error}`
          : `Re-ran AI for ${review.replayName}${coached.usedModel ? ` (${coached.usedModel})` : ""}`,
      );
      return view;
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setBusy(false);
    }
  }

  if (!settings) {
    return (
      <div className="app">
        <main className="main">
          <p className="lead">Loading…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <h1>TCG Yugi Trainer</h1>
          <p>EDOPro wrapper for matchup practice and AI coaching.</p>
        </div>
        <nav className="nav">
          {(
            [
              ["home", "Home"],
              ["train", "Train"],
              ["coach", "Coach"],
              ["history", "History"],
              ["settings", "Settings"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          Uses Project Ignis EDOPro + WindBot + CardScripts.
          Not affiliated with Konami or Shueisha.
        </div>
      </aside>

      <main className="main">
        {tab === "home" && (
          <section className="panel hero-home">
            <h2>Train smarter. Duel with purpose.</h2>
            <p className="lead">
              Pick your .ydk first. The trainer builds a session plan for that
              list, then you duel a WindBot rival with three goals and review the replay.
            </p>
            <div className="block">
              <h3>Quick start</h3>
              <ol className="steps">
                <li>Install Project Ignis EDOPro and note its folder.</li>
                <li>Set the path in Settings (WindBot must be present).</li>
                <li>On Train, pick your .ydk — then a rival and a session goal.</li>
                <li>Start duel — host a room in EDOPro if needed.</li>
              </ol>
              <div className="row" style={{ marginTop: "1rem" }}>
                <button className="btn btn-primary" onClick={() => setTab("train")}>
                  Go to Train
                </button>
                <button className="btn btn-secondary" onClick={() => setTab("history")}>
                  Match history
                </button>
                <button className="btn btn-secondary" onClick={() => setTab("settings")}>
                  Open Settings
                </button>
              </div>
            </div>

            <div className="block">
                <h3>Install status</h3>
                {install ? (
                  <>
                    <div className="row" style={{ marginBottom: "0.75rem" }}>
                      <span className={`pill ${install.valid ? "ok" : "bad"}`}>
                        {install.valid ? "WindBot folder" : "Needs setup"}
                      </span>
                      <span className={`pill ${install.hasCardsDb ? "ok" : "warn"}`}>
                        {install.hasCardsDb ? "cards.cdb" : "no cdb"}
                      </span>
                      <span
                        className={`pill ${
                          windBotAnalysis?.ready
                            ? "ok"
                            : windBotAnalysis
                              ? "warn"
                              : "bad"
                        }`}
                      >
                        {windBotAnalysis
                          ? `Training ${windBotAnalysis.trainingReadyCount}/${rivals.length}`
                          : "No WindBot scan"}
                      </span>
                    </div>
                    <p className="markdownish" style={{ color: "var(--muted)" }}>
                      {install.rootPath || "No path set"}
                      {"\n"}
                      {install.issues.length
                        ? install.issues.map((i) => `• ${i}`).join("\n")
                        : "• EDOPro path looks usable."}
                    </p>

                    {windBotAnalysis && (
                      <div className="inventory">
                        <div className="inventory-summary">
                          <strong>WindBot decks</strong>
                          <span>{windBotAnalysis.summary}</span>
                        </div>

                        <div className="row" style={{ marginBottom: "0.65rem" }}>
                          {Object.entries(windBotAnalysis.byDifficulty)
                            .sort(([a], [b]) => Number(a) - Number(b))
                            .map(([diff, count]) => (
                              <span key={diff} className="pill">
                                Diff {diff}: {count}
                              </span>
                            ))}
                          <span className="pill">
                            Executors DLL: {windBotAnalysis.totalExecutorDlls}
                          </span>
                        </div>

                        <h4 className="inventory-heading">Training rivals</h4>
                        <ul className="inventory-list">
                          {windBotAnalysis.trainingRivals.map((r) => (
                            <li key={r.rivalId}>
                                <span
                                className={`pill ${
                                  r.status === "ready"
                                    ? "ok"
                                    : r.status === "listed_no_ydk" ||
                                        r.status === "missing_executor"
                                      ? "warn"
                                      : "bad"
                                }`}
                              >
                                {r.status === "ready"
                                  ? "ready"
                                  : r.status === "listed_no_ydk"
                                    ? "no ydk"
                                    : r.status === "missing_executor"
                                      ? "no executor"
                                      : "missing"}
                              </span>
                              <div>
                                <strong>{r.rivalName}</strong>
                                <small>{r.note}</small>
                              </div>
                            </li>
                          ))}
                        </ul>

                        {windBotAnalysis.issues.length > 0 && (
                          <p className="inventory-issues">
                            {windBotAnalysis.issues.map((i) => `• ${i}`).join("\n")}
                          </p>
                        )}

                        <div className="row" style={{ marginTop: "0.75rem" }}>
                          <button
                            className="btn btn-ghost"
                            type="button"
                            onClick={() => setShowAllWindBotDecks((v) => !v)}
                          >
                            {showAllWindBotDecks
                              ? "Hide all WindBot decks"
                              : `Show all ${windBotAnalysis.totalBots} WindBot decks`}
                          </button>
                          <button
                            className="btn btn-secondary"
                            type="button"
                            disabled={busy || !install.valid}
                            onClick={() => void handleSyncBots()}
                          >
                            Sync training bots
                          </button>
                        </div>

                        {showAllWindBotDecks && (
                          <ul className="inventory-list inventory-list-all">
                            {windBotAnalysis.availableDecks.map((d) => (
                              <li key={`${d.botName}-${d.deckKey}`}>
                                <span className={`pill ${d.hasYdk ? "ok" : "warn"}`}>
                                  {d.hasYdk ? "ydk" : "no ydk"}
                                </span>
                                <div>
                                  <strong>
                                    {d.botName}{" "}
                                    <em style={{ fontStyle: "normal", color: "var(--muted)" }}>
                                      ({d.deckKey})
                                    </em>
                                  </strong>
                                  <small>
                                    Diff {d.difficulty}
                                    {d.ydkFileName ? ` · ${d.ydkFileName}` : ""}
                                    {d.hasExecutorDll && d.executorFileName
                                      ? ` · ${d.executorFileName}`
                                      : ""}
                                  </small>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="lead" style={{ margin: 0 }}>
                    Set your EDOPro folder in Settings to begin.
                  </p>
                )}
            </div>
          </section>
        )}

        {tab === "train" && (
          <section className="panel">
            <h2>Train</h2>
            <p className="lead">
              Your deck first. We generate a plan and three session goals, then you
              pick a rival and duel.
            </p>

            <div className="block" style={{ marginBottom: "1.25rem" }}>
              <h3>1. Your deck</h3>
              <div className="field">
                <label>Deck from EDOPro/deck</label>
                <select
                  value={settings.selectedDeckPath}
                  onChange={(e) =>
                    void updateSettings({ selectedDeckPath: e.target.value })
                  }
                >
                  <option value="">— select —</option>
                  {decks.map((d) => (
                    <option key={d.path} value={d.path}>
                      {d.name} ({d.main.length}+{d.extra.length})
                    </option>
                  ))}
                </select>
              </div>
              {playerDeck ? (
                <p className="field-hint">
                  Coach sees {playerDeck.main.length}+{playerDeck.extra.length} cards
                  {" · "}
                  {uniqueCardCount(playerDeck)} unique names from {playerDeck.name}.
                </p>
              ) : (
                <p className="field-hint">
                  Select a .ydk so the session plan, briefing, chat, and replay
                  review use your actual list.
                </p>
              )}
              <div className="row">
                <button
                  className="btn btn-secondary"
                  disabled={!install?.deckDir || busy}
                  onClick={() => void pickDeckFile()}
                >
                  Import .ydk
                </button>
                <button
                  className="btn btn-ghost"
                  disabled={!install?.valid || busy}
                  onClick={() => void handleSyncBots()}
                >
                  Sync WindBot bots
                </button>
              </div>
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <SessionPlanPanel
                plan={sessionPlan}
                academy={academy}
                checked={goalChecked}
                onToggle={(id) =>
                  setGoalChecked((prev) => ({ ...prev, [id]: !prev[id] }))
                }
                onRefresh={() => {
                  if (!settings) return;
                  setBusy(true);
                  void deckSessionPlan(
                    settings,
                    rival.name,
                    lesson,
                    academy,
                    playerDeck,
                  )
                    .then((plan) => {
                      setSessionPlan(plan);
                      setGoalChecked({});
                    })
                    .finally(() => setBusy(false));
                }}
                busy={busy}
              />
            </div>

            <div className="block" style={{ marginBottom: "1.25rem" }}>
              <h3>2. Rival</h3>
              <div className="grid-3">
                {rivals.map((r) => (
                  <button
                    key={r.id}
                    className={`rival-card ${rival.id === r.id ? "selected" : ""}`}
                    onClick={() => void updateSettings({ selectedRivalId: r.id })}
                  >
                    <strong>{r.name}</strong>
                    <span>
                      Diff {r.difficulty}/5 · {r.archetype}
                      {"\n"}
                      {r.notes}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="block">
              <h3>3. Launch</h3>
              <p className="lead" style={{ marginBottom: "1rem" }}>
                Rival executor: <strong>{rival.windbotDeck}</strong>. Default host{" "}
                {settings.windBotHost}:{settings.windBotPort}.
              </p>
              <div className="row">
                <button
                  className="btn btn-primary"
                  disabled={!settings.edoProPath || busy}
                  onClick={() => void handleStartDuel()}
                >
                  Start duel
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() => void handleBriefing()}
                >
                  Pre-duel briefing
                </button>
              </div>
              {launchPlan && (
                <>
                  <ol className="steps" style={{ marginTop: "1rem" }}>
                    {launchPlan.steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                  <p className="status-line">
                    WindBot cmd: {windBotCommandLine(launchPlan)}
                  </p>
                </>
              )}
            </div>
            {status && <p className="status-line">{status}</p>}
          </section>
        )}

        {tab === "coach" && (
          <section className="panel">
            <h2>Coach</h2>
            <p className="lead">
              Matchup: <strong>{rival.name}</strong>
              {playerDeck ? ` · your list: ${playerDeck.name}` : ""}.{" "}
              {settings.apiKey
                ? "LLM coaching enabled."
                : "No API key — using static lessons (add a key in Settings)."}
            </p>
            {sessionPlan && (
              <ul className="goal-list" style={{ marginBottom: "1.25rem" }}>
                {sessionPlan.goals.map((goal) => (
                  <li key={goal.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={Boolean(goalChecked[goal.id])}
                        onChange={() =>
                          setGoalChecked((prev) => ({
                            ...prev,
                            [goal.id]: !prev[goal.id],
                          }))
                        }
                      />
                      <span>{goal.text}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}

            <div className="grid-2">
              <div className="block">
                <h3>Pre-duel briefing</h3>
                <div className="row" style={{ marginBottom: "0.75rem" }}>
                  <button
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => void handleBriefing()}
                  >
                    Refresh briefing
                  </button>
                </div>
                <div className="markdownish">
                  {briefing || lesson.summary}
                </div>
              </div>

              <div className="block">
                <h3>Ask coach</h3>
                <div className="templates">
                  {CHAT_TEMPLATES.map((t) => (
                    <button key={t} onClick={() => void sendChat(t)} disabled={busy}>
                      {t}
                    </button>
                  ))}
                </div>
                <div className="chat">
                  {chat.length === 0 && (
                    <div className="bubble assistant">
                      Describe your board or ask about handtraps, negates, or lines.
                    </div>
                  )}
                  {chat.map((m, i) => (
                    <div
                      key={`${m.role}-${i}`}
                      className={`bubble ${m.role === "user" ? "user" : "assistant"}`}
                    >
                      {m.content}
                    </div>
                  ))}
                </div>
                <div className="field">
                  <label>Message</label>
                  <textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="e.g. They opened Raye + Engage, I have Imperm…"
                  />
                </div>
                <button
                  className="btn btn-primary"
                  disabled={busy || !chatInput.trim()}
                  onClick={() => void sendChat(chatInput)}
                >
                  Send
                </button>
              </div>
            </div>
            {status && <p className="status-line">{status}</p>}
          </section>
        )}

        {tab === "history" && (
          <MatchHistoryPanel
            edoProPath={settings.edoProPath}
            replayDir={install?.replayDir ?? null}
            busy={busy}
            refreshToken={historyTick}
            onAnalyze={(file) => handleAnalyzeReplay(file, false)}
            onReanalyze={handleReanalyzeSaved}
            onOpenFolder={
              install?.replayDir
                ? () => void native.openPath(install.replayDir!)
                : undefined
            }
          />
        )}

        {tab === "settings" && (
          <section className="panel">
            <h2>Settings</h2>
            <p className="lead">
              Point the trainer at your EDOPro install and optionally enable LLM coaching.
            </p>
            <div className="block">
              <div className="block-head">
                <h3>EDOPro</h3>
                <ConnectionBadge
                  {...edoConnectionBadge(settings.edoProPath, install)}
                />
              </div>
              <div className="field">
                <label>Install folder</label>
                <input
                  value={settings.edoProPath}
                  onChange={(e) =>
                    setSettings({ ...settings, edoProPath: e.target.value })
                  }
                  placeholder="/Users/you/ProjectIgnis"
                />
              </div>
              <div className="row">
                <button className="btn btn-secondary" onClick={() => void pickEdoProFolder()}>
                  Browse…
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => void refreshInstall(settings.edoProPath)}
                >
                  Re-scan
                </button>
              </div>
              {suggestions.length > 0 && (
                <div className="templates" style={{ marginTop: "0.85rem" }}>
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => void updateSettings({ edoProPath: s })}
                    >
                      Use {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid-2" style={{ marginTop: "1.25rem" }}>
              <div className="block">
                <div className="block-head">
                  <h3>WindBot network</h3>
                  <ConnectionBadge {...windBotConn} />
                </div>
                <div className="field">
                  <label>Host</label>
                  <input
                    value={settings.windBotHost}
                    onChange={(e) =>
                      setSettings({ ...settings, windBotHost: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Port</label>
                  <input
                    type="number"
                    value={settings.windBotPort}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        windBotPort: Number(e.target.value) || 7911,
                      })
                    }
                  />
                </div>
                <p className="field-hint">
                  Green means a local room is listening. Amber is normal until you host
                  in EDOPro.
                </p>
              </div>

              <div className="block">
                <div className="block-head">
                  <h3>LLM coach (OpenAI-compatible)</h3>
                  <ConnectionBadge {...llmConn} />
                </div>
                <div className="field">
                  <label>API key</label>
                  <input
                    type="password"
                    value={settings.apiKey}
                    onChange={(e) =>
                      setSettings({ ...settings, apiKey: e.target.value })
                    }
                    placeholder="sk-…"
                  />
                </div>
                <div className="field">
                  <label>Base URL</label>
                  <input
                    value={settings.apiBaseUrl}
                    onChange={(e) =>
                      setSettings({ ...settings, apiBaseUrl: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Model</label>
                  <input
                    value={settings.apiModel}
                    onChange={(e) =>
                      setSettings({ ...settings, apiModel: e.target.value })
                    }
                  />
                </div>
                <p className="field-hint">
                  The coach uses these fields (Save changes to persist). A green
                  badge only means the API key works — the model must exist on
                  this provider (OpenAI: gpt-4o-mini). Cursor-only names like
                  gpt-5.6-luna are rejected and the review falls back to static
                  notes.
                </p>
              </div>
            </div>

            <div className="block" style={{ marginTop: "1.25rem" }}>
              <div className="block-head">
                <h3>Cartas desconocidas</h3>
                <span className={`pill ${unknownCardCount ? "warn" : "ok"}`}>
                  {unknownCardCount
                    ? `${unknownCardCount} temporales`
                    : "sin temporales"}
                </span>
              </div>
              <p className="field-hint">
                Si cards.cdb no tiene una carta, se busca en YGOPRODeck y se
                guarda el nombre en inglés y su metadata aquí. Cuando actualices
                EDOPro, re-sincroniza: si ya existe ficha oficial, se borra la
                temporal.
              </p>
              <div className="row" style={{ marginTop: "0.75rem" }}>
                <button
                  className="btn btn-secondary"
                  type="button"
                  disabled={busy || !settings.edoProPath.trim()}
                  onClick={() => void handleResyncUnknownCards()}
                >
                  Re-sincronizar cartas
                </button>
              </div>
            </div>

            <div className="settings-actions">
              <button
                className="btn btn-primary"
                disabled={
                  busy ||
                  !persistedSettings ||
                  !settingsFormDirty(settings, persistedSettings)
                }
                onClick={() => void handleSaveSettings()}
              >
                Save changes
              </button>
              <button
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => void probeLiveConnections(settings)}
              >
                Recheck connections
              </button>
            </div>
            {status && <p className="status-line">{status}</p>}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
