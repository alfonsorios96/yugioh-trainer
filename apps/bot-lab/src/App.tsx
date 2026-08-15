import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  appendLearningEntry,
  assignReplayToSituation,
  bookCardIds,
  clearSituationReplay,
  createSituation,
  defaultToonComboModel,
  deleteSituation,
  diagnoseReplay,
  extractComboLine,
  modelFromBook,
  parseComboBook,
  parseLearningLog,
  runLearnCycle,
  serializeLearningLog,
  undoLastApplied,
  updateSituation,
  type ComboBook,
  type ComboModel,
  type ComboSituation,
  type Diagnosis,
  type ExtractedLine,
  type LearningEntry,
} from "@yugioh/bot-lab";
import type { Actor, EdoProInstallInfo, ReplayFileInfo, ReplayWalkthrough } from "@yugioh/edopro-bridge";
import { ComboLine, EndBoardZones } from "./CardThumb";
import { ComboGraph } from "./ComboGraph";
import { TeachPanel } from "./TeachPanel";
import { listReplays, loadWalkthrough, queryCardNames, replayArtPaths } from "./lib/bridge";
import { native } from "./lib/native";
import {
  bookPath,
  comboDir,
  enginePath,
  findRepoEnginesRoot,
  logPath,
  modelPath,
  probeInstall,
  suggestInstallPaths,
} from "./lib/paths";
import { loadSettings, saveSettings, type LabSettings } from "./lib/settings";

type Tab = "libro" | "grafo" | "replays" | "entrenar" | "aprendizaje" | "ajustes";

export default function App() {
  const [tab, setTab] = useState<Tab>("libro");
  const [settings, setSettings] = useState<LabSettings | null>(null);
  const [install, setInstall] = useState<EdoProInstallInfo | null>(null);
  const [book, setBook] = useState<ComboBook | null>(null);
  const [model, setModel] = useState<ComboModel>(defaultToonComboModel());
  const [log, setLog] = useState<LearningEntry[]>([]);
  const [engineSource, setEngineSource] = useState("");
  const [sitId, setSitId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [replays, setReplays] = useState<ReplayFileInfo[]>([]);
  const [picked, setPicked] = useState<ReplayFileInfo | null>(null);
  const [walk, setWalk] = useState<ReplayWalkthrough | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [actor, setActor] = useState<Actor>("opp");
  const [line, setLine] = useState<ExtractedLine | null>(null);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);

  const enginesRoot = settings?.comboRoot?.trim() || "";
  const art = settings?.edoProPath
    ? replayArtPaths(settings.edoProPath)
    : { picsDir: "", unknownPic: "", coverPic: "" };

  const loadLibrary = useCallback(async (root: string) => {
    const bp = bookPath(root);
    const lp = logPath(root);
    const ep = enginePath(root);
    const bookRaw = JSON.parse(await native.readTextFile(bp)) as unknown;
    const parsed = parseComboBook(bookRaw);
    setBook(parsed);
    setModel(modelFromBook(parsed));
    try {
      setLog(parseLearningLog(await native.readTextFile(lp)));
    } catch {
      setLog([]);
    }
    setEngineSource(await native.readTextFile(ep));
  }, []);

  useEffect(() => {
    void (async () => {
      const loaded = await loadSettings();
      let comboRoot = loaded.comboRoot;
      if (!comboRoot) {
        const found = await findRepoEnginesRoot();
        if (found) {
          comboRoot = found;
          await saveSettings({ comboRoot: found });
        }
      }
      const next = { ...loaded, comboRoot };
      setSettings(next);
      if (next.edoProPath) {
        try {
          setInstall(await probeInstall(next.edoProPath));
        } catch {
          setInstall(null);
        }
      }
      if (comboRoot) {
        try {
          await loadLibrary(comboRoot);
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
  }, [loadLibrary]);

  function selectSituation(s: ComboSituation) {
    setSitId(s.situationId);
    setTitleDraft(s.title);
    setNotes(s.notes);
  }

  useEffect(() => {
    if (book && !sitId && book.situations[0]) {
      selectSituation(book.situations[0]);
    }
  }, [book, sitId]);

  useEffect(() => {
    if (!book || !settings?.edoProPath) return;
    let cancelled = false;
    void (async () => {
      const extra = await queryCardNames(settings.edoProPath, bookCardIds(book));
      if (!cancelled && Object.keys(extra).length > 0) {
        setNames((prev) => ({ ...prev, ...extra }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [book, settings?.edoProPath]);

  const situation = useMemo(
    () => book?.situations.find((s) => s.situationId === sitId) ?? null,
    [book, sitId],
  );

  const refreshedZones = useRef(false);
  useEffect(() => {
    if (refreshedZones.current || !enginesRoot || !situation) return;
    const hasField =
      (situation.endBoard.monsterZones ?? []).some((id) => Number(id) > 0) ||
      (situation.endBoard.spellZones ?? []).some((id) => Number(id) > 0);
    if (hasField) return;
    if (situation.endBoard.monsters.length + situation.endBoard.spells.length === 0) {
      return;
    }
    refreshedZones.current = true;
    void loadLibrary(enginesRoot);
  }, [enginesRoot, situation, loadLibrary]);

  async function persistBook(next: ComboBook) {
    if (!enginesRoot) throw new Error("comboRoot no configurado");
    await native.writeTextFile(bookPath(enginesRoot), JSON.stringify(next, null, 2) + "\n");
    setBook(next);
    await persistModel(modelFromBook(next));
  }

  async function saveSituation() {
    if (!book || !situation) return;
    setError("");
    try {
      const next = updateSituation(book, situation.situationId, {
        title: titleDraft,
        notes,
      });
      await persistBook(next);
      const saved =
        next.situations.find((s) => s.situationId === situation.situationId) ??
        next.situations.find(
          (s) => !book.situations.some((old) => old.situationId === s.situationId),
        );
      if (saved) selectSituation(saved);
      setStatus(`Guardada «${saved?.title ?? titleDraft}».`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function addSituation() {
    if (!book) return;
    setError("");
    try {
      const next = createSituation(book, { title: "Nueva situación" });
      await persistBook(next);
      const created = next.situations[next.situations.length - 1];
      if (created) selectSituation(created);
      setStatus("Situación creada. Edita el nombre y guarda.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function removeSituation() {
    if (!book || !situation) return;
    if (!window.confirm(`¿Borrar «${situation.title}» del libro?`)) return;
    setError("");
    try {
      const next = deleteSituation(book, situation.situationId);
      await persistBook(next);
      const fallback = next.situations[0];
      if (fallback) selectSituation(fallback);
      else {
        setSitId(null);
        setTitleDraft("");
        setNotes("");
      }
      setStatus(`Borrada «${situation.title}».`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function persistModel(next: ComboModel) {
    if (!enginesRoot) throw new Error("comboRoot no configurado");
    await native.writeTextFile(modelPath(enginesRoot), JSON.stringify(next, null, 2) + "\n");
    setModel(next);
  }

  async function persistLog(entries: LearningEntry[]) {
    if (!enginesRoot) return;
    await native.writeTextFile(logPath(enginesRoot), serializeLearningLog(entries));
    setLog(entries);
  }

  async function persistEngine(source: string) {
    if (!enginesRoot) throw new Error("comboRoot no configurado");
    await native.writeTextFile(enginePath(enginesRoot), source);
    setEngineSource(source);
  }

  async function refreshReplays() {
    const dir = install?.replayDir;
    if (!dir) {
      setReplays([]);
      return;
    }
    setReplays(await listReplays(dir));
  }

  useEffect(() => {
    if (tab === "replays" || tab === "aprendizaje" || tab === "libro") void refreshReplays();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, install?.replayDir]);

  async function openReplay(file: ReplayFileInfo) {
    if (!settings?.edoProPath) {
      setError("Configura la carpeta de EDOPro en Ajustes.");
      return;
    }
    setError("");
    setPicked(file);
    const loaded = await loadWalkthrough(file, settings.edoProPath);
    const extracted = extractComboLine(loaded.walk);
    setWalk(loaded.walk);
    setNames((prev) => ({ ...prev, ...loaded.names }));
    setActor(extracted.actor);
    setLine(extracted);
    if (book) setDiagnosis(diagnoseReplay(book, loaded.walk, extracted.actor));
  }

  function onActorChange(next: Actor) {
    setActor(next);
    if (!walk) return;
    const extracted = extractComboLine(walk, next);
    setLine(extracted);
    if (book) setDiagnosis(diagnoseReplay(book, walk, next));
  }

  async function assignReplay(file: ReplayFileInfo) {
    if (!book || !situation || !settings?.edoProPath) {
      setError("Configura la carpeta de EDOPro en Ajustes.");
      return;
    }
    setError("");
    try {
      const loaded = await loadWalkthrough(file, settings.edoProPath);
      setNames((prev) => ({ ...prev, ...loaded.names }));
      const extracted = extractComboLine(loaded.walk);
      const next = assignReplayToSituation(
        book,
        situation.situationId,
        {
          sourceReplay: file.name,
          notes: notes.trim() || situation.notes,
          openingHand: extracted.openingHand,
          steps: extracted.steps,
          endBoard: extracted.endBoard,
        },
        {
          going: extracted.going,
          worldOnField: extracted.worldOnField,
          threats: extracted.threats,
        },
      );
      await persistBook(next);
      const saved = next.situations.find(
        (s) => s.situationId === situation.situationId,
      );
      if (saved) selectSituation(saved);
      setStatus(`Replay «${file.name}» asociado a «${situation.title}».`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function unassignReplay() {
    if (!book || !situation) return;
    if (!window.confirm(`¿Quitar el replay de «${situation.title}»?`)) return;
    setError("");
    try {
      const next = clearSituationReplay(book, situation.situationId);
      await persistBook(next);
      const saved = next.situations.find(
        (s) => s.situationId === situation.situationId,
      );
      if (saved) selectSituation(saved);
      setStatus(`Replay desasociado de «${situation.title}».`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function addLineToSituation() {
    if (!picked) return;
    await assignReplay(picked);
  }

  async function runLearn() {
    if (!book || !walk || !picked) return;
    const diag = diagnoseReplay(book, walk, actor);
    setDiagnosis(diag);
    const result = runLearnCycle({
      book,
      diagnosis: diag,
      engineSource,
      replayName: picked.name,
    });
    const nextLog = parseLearningLog(
      appendLearningEntry(serializeLearningLog(log), result.entry),
    );
    await persistLog(nextLog);
    setStatus(result.reason ?? diag.notes);
  }

  async function undoLearn() {
    const undone = undoLastApplied(engineSource, log);
    if (!undone) {
      setStatus("No hay parche aplicado para deshacer.");
      return;
    }
    await persistEngine(undone.source);
    await persistLog(undone.entries);
    setStatus("Último parche deshecho.");
  }

  async function pickEdoFolder() {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected !== "string") return;
    const info = await probeInstall(selected);
    setInstall(info);
    const next = { ...(settings as LabSettings), edoProPath: selected };
    setSettings(next);
    await saveSettings({ edoProPath: selected });
  }

  async function saveAdj() {
    if (!settings) return;
    await saveSettings(settings);
    if (settings.edoProPath) setInstall(await probeInstall(settings.edoProPath));
    if (settings.comboRoot) await loadLibrary(settings.comboRoot);
    setStatus("Ajustes guardados.");
  }

  if (!settings) {
    return <div className="main">Cargando laboratorio…</div>;
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <h1>WindBot Lab</h1>
          <p>Enseña combos Toon 2026. No es el Trainer del jugador.</p>
        </div>
        <nav className="nav">
          {(
            [
              ["libro", "Libro"],
              ["grafo", "Grafo"],
              ["replays", "Replays"],
              ["entrenar", "Entrenar"],
              ["aprendizaje", "Aprendizaje"],
              ["ajustes", "Ajustes"],
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
        <p className="sidebar-foot">
          Recetas gold en combos/toon-2026. Entrenar elige en vivo las 5
          mejores acciones del agente; WindBot solo ejecuta.
        </p>
      </aside>
      <main className="main">
        {error ? <div className="banner warn">{error}</div> : null}
        {status ? <div className="banner ok">{status}</div> : null}

        {tab === "libro" && book && (
          <>
            <h2>Libro de situaciones</h2>
            <p className="lede">
              Cada combo es una rama. Describe la línea en las notas y asigna
              replays como ejemplos.
            </p>
            <div className="split">
              <div className="sit-list">
                <button className="ghost" onClick={() => void addSituation()}>
                  Nueva situación
                </button>
                {book.situations.length === 0 ? (
                  <p className="muted">El libro está vacío.</p>
                ) : null}
                {book.situations.map((s) => (
                  <button
                    key={s.situationId}
                    className={sitId === s.situationId ? "active" : ""}
                    onClick={() => selectSituation(s)}
                  >
                    <strong>{s.title}</strong>
                  </button>
                ))}
              </div>
              {situation && (
                <div className="card">
                  <label>
                    Nombre
                    <input
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                    />
                  </label>
                  <label>
                    Notas en español
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Con Bookmark + Rabbit quiero Ultimate y Terror seteado…"
                    />
                  </label>
                  <div className="row">
                    <button className="primary" onClick={() => void saveSituation()}>
                      Guardar
                    </button>
                    <button className="danger" onClick={() => void removeSituation()}>
                      Borrar
                    </button>
                  </div>
                  {situation.examples[0] || situation.steps.length > 0 ? (
                    <>
                      <div className="row" style={{ marginTop: "0.85rem" }}>
                        <p className="muted" style={{ margin: 0, flex: 1 }}>
                          {situation.examples[0]
                            ? `Replay: ${situation.examples[0].sourceReplay}`
                            : "Línea del libro (sin replay)"}
                        </p>
                        <button className="ghost" onClick={() => void unassignReplay()}>
                          Quitar replay
                        </button>
                      </div>
                      <h3>Pasos canónicos</h3>
                      {!art.picsDir ? (
                        <p className="muted">
                          Configura EDOPro en Ajustes para ver las imágenes de las cartas.
                        </p>
                      ) : null}
                      {situation.steps.length === 0 ? (
                        <p className="muted">El replay no dejó pasos extraíbles.</p>
                      ) : (
                        <ComboLine
                          steps={situation.steps}
                          names={names}
                          picsDir={art.picsDir}
                          unknownPic={art.unknownPic}
                          coverPic={art.coverPic}
                        />
                      )}
                      <h3>Campo objetivo</h3>
                      <EndBoardZones
                        board={situation.endBoard}
                        steps={situation.steps}
                        names={names}
                        picsDir={art.picsDir}
                        unknownPic={art.unknownPic}
                        coverPic={art.coverPic}
                      />
                    </>
                  ) : (
                    <label style={{ marginTop: "0.85rem" }}>
                      Replay
                      {!install?.replayDir ? (
                        <p className="muted">
                          Configura EDOPro en Ajustes para listar replays.
                        </p>
                      ) : replays.length === 0 ? (
                        <p className="muted">No hay archivos .yrpX en replay/.</p>
                      ) : (
                        <select
                          value=""
                          onChange={(e) => {
                            const file = replays.find((r) => r.path === e.target.value);
                            if (file) void assignReplay(file);
                          }}
                        >
                          <option value="">Selecciona un replay…</option>
                          {replays.map((r) => (
                            <option key={r.path} value={r.path}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </label>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {tab === "grafo" && (
          <>
            <h2>Cómo funciona el combo</h2>
            <p className="lede">
              El diagrama se reconstruye al guardar el libro. Pulsa un nodo para
              ver cartas, situaciones y conexiones.
            </p>
            <ComboGraph
              model={model}
              book={book}
              names={names}
              picsDir={art.picsDir}
              unknownPic={art.unknownPic}
            />
          </>
        )}

        {tab === "replays" && (
          <>
            <h2>Replays de EDOPro</h2>
            <p className="lede">
              Elige el lado Toon, marca el ejemplo y suéltalo en una situación.
            </p>
            <div className="split">
              <div className="card">
                <div className="row">
                  <button className="ghost" onClick={() => void refreshReplays()}>
                    Actualizar
                  </button>
                </div>
                {!install?.replayDir ? (
                  <p className="muted">Sin carpeta replay/. Configura EDOPro.</p>
                ) : (
                  <div className="replay-list">
                    {replays.map((r) => (
                      <button
                        key={r.path}
                        className={picked?.path === r.path ? "active" : ""}
                        onClick={() => void openReplay(r)}
                      >
                        {r.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="card">
                {walk && line ? (
                  <>
                    <label>
                      Lado Toon
                      <select
                        value={actor}
                        onChange={(e) => onActorChange(e.target.value as Actor)}
                      >
                        <option value="you">{walk.youName} (you)</option>
                        <option value="opp">{walk.oppName} (opp)</option>
                      </select>
                    </label>
                    <p className="muted">
                      going {line.going} · threats {line.threats.join(", ") || "—"} ·
                      world {String(line.worldOnField)}
                    </p>
                    <ComboLine
                      steps={line.steps}
                      names={names}
                      picsDir={art.picsDir}
                      unknownPic={art.unknownPic}
                      coverPic={art.coverPic}
                    />
                    <EndBoardZones
                      board={line.endBoard}
                      steps={line.steps}
                      names={names}
                      picsDir={art.picsDir}
                      unknownPic={art.unknownPic}
                      coverPic={art.coverPic}
                    />
                    {diagnosis && (
                      <p className={diagnosis.verdict === "ok" ? "ok" : "bad"}>
                        {diagnosis.verdict}: {diagnosis.notes}
                      </p>
                    )}
                    <label>
                      Añadir a situación
                      <select
                        value={sitId ?? ""}
                        onChange={(e) => {
                          const next = e.target.value;
                          const sit = book?.situations.find(
                            (s) => s.situationId === next,
                          );
                          if (sit) selectSituation(sit);
                        }}
                      >
                        {book?.situations.map((s) => (
                          <option key={s.situationId} value={s.situationId}>
                            {s.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Notas
                      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </label>
                    <div className="row">
                      <button className="primary" onClick={() => void addLineToSituation()}>
                        Asociar a esta situación
                      </button>
                      <button className="ghost" onClick={() => void runLearn()}>
                        Diagnosticar y aprender
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="muted">Abre un .yrpX de la lista.</p>
                )}
              </div>
            </div>
          </>
        )}

        {tab === "entrenar" && settings && (
          <TeachPanel
            art={art}
            edoProPath={settings.edoProPath}
            names={names}
            apiKey={settings.apiKey}
            apiBaseUrl={settings.apiBaseUrl}
            apiModel={settings.apiModel}
          />
        )}

        {tab === "aprendizaje" && (
          <>
            <h2>Auto-mejora</h2>
            <p className="lede">
              El lab compara el replay con el libro y registra el diagnóstico.
              Corregir when, pasos o endBoard se hace aquí; el engine no lee
              el libro en el duelo.
            </p>
            <div className="row" style={{ marginBottom: "1rem" }}>
              <button className="ghost" onClick={() => void undoLearn()}>
                Deshacer último parche
              </button>
              {enginesRoot ? (
                <button
                  className="ghost"
                  onClick={() => void native.openPath(comboDir(enginesRoot))}
                >
                  Abrir carpeta combos
                </button>
              ) : null}
            </div>
            <div className="card">
              {log.length === 0 ? (
                <p className="muted">Aún no hay entradas en el learning log.</p>
              ) : (
                log
                  .slice()
                  .reverse()
                  .map((e, i) => (
                    <div key={`${e.at}-${i}`} className="log-item">
                      <strong className={e.applied ? "ok" : ""}>
                        {e.verdict}
                        {e.applied ? " · aplicado" : ""}
                      </strong>{" "}
                      <span className="muted">{e.replay}</span>
                      <div>{e.reason}</div>
                    </div>
                  ))
              )}
            </div>
          </>
        )}

        {tab === "ajustes" && (
          <>
            <h2>Ajustes</h2>
            <p className="lede">Ruta de EDOPro (replays) y del repo (ToonEngine + libro).</p>
            <div className="card">
              <label>
                Carpeta EDOPro
                <input
                  value={settings.edoProPath}
                  onChange={(e) =>
                    setSettings({ ...settings, edoProPath: e.target.value })
                  }
                />
              </label>
              <div className="row" style={{ margin: "0.6rem 0 1rem" }}>
                <button className="ghost" onClick={() => void pickEdoFolder()}>
                  Elegir carpeta
                </button>
                <button
                  className="ghost"
                  onClick={async () => {
                    const found = await suggestInstallPaths();
                    if (found[0]) {
                      setSettings({ ...settings, edoProPath: found[0] });
                    }
                  }}
                >
                  Detectar
                </button>
              </div>
              <label>
                Root windbot-engines
                <input
                  value={settings.comboRoot}
                  onChange={(e) =>
                    setSettings({ ...settings, comboRoot: e.target.value })
                  }
                />
              </label>
              <label>
                API key (opcional, modelo de combo)
                <input
                  type="password"
                  value={settings.apiKey}
                  onChange={(e) =>
                    setSettings({ ...settings, apiKey: e.target.value })
                  }
                />
              </label>
              <label>
                Base URL
                <input
                  value={settings.apiBaseUrl}
                  onChange={(e) =>
                    setSettings({ ...settings, apiBaseUrl: e.target.value })
                  }
                />
              </label>
              <label>
                Modelo
                <input
                  value={settings.apiModel}
                  onChange={(e) =>
                    setSettings({ ...settings, apiModel: e.target.value })
                  }
                />
              </label>
              <div className="row" style={{ marginTop: "1rem" }}>
                <button className="primary" onClick={() => void saveAdj()}>
                  Guardar
                </button>
              </div>
              {install ? (
                <p className="muted">
                  replayDir: {install.replayDir ?? "—"} · válido={String(install.valid)}
                </p>
              ) : null}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
