import { useCallback, useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  addExampleToSituation,
  appendLearningEntry,
  applyEnginePatches,
  bookSummary,
  compileComboBook,
  defaultToonComboModel,
  diagnoseReplay,
  extractLine,
  guessBotActor,
  parseComboBook,
  parseLearningLog,
  runLearnCycle,
  serializeLearningLog,
  suggestComboModel,
  undoLastApplied,
  type ComboBook,
  type ComboModel,
  type Diagnosis,
  type ExtractedLine,
  type LearningEntry,
} from "@yugioh/bot-lab";
import type { Actor, EdoProInstallInfo, ReplayFileInfo, ReplayWalkthrough } from "@yugioh/edopro-bridge";
import { ComboGraph } from "./ComboGraph";
import { cardLabel, listReplays, loadWalkthrough } from "./lib/bridge";
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

type Tab = "libro" | "grafo" | "replays" | "aprendizaje" | "ajustes";

function stepKindLabel(kind: string): string {
  if (kind === "spsummon") return "SS";
  if (kind === "summon") return "NS";
  if (kind === "activate") return "Act";
  if (kind === "set") return "Set";
  return kind;
}

export default function App() {
  const [tab, setTab] = useState<Tab>("libro");
  const [settings, setSettings] = useState<LabSettings | null>(null);
  const [install, setInstall] = useState<EdoProInstallInfo | null>(null);
  const [book, setBook] = useState<ComboBook | null>(null);
  const [model, setModel] = useState<ComboModel>(defaultToonComboModel());
  const [log, setLog] = useState<LearningEntry[]>([]);
  const [engineSource, setEngineSource] = useState("");
  const [sitId, setSitId] = useState<string | null>(null);
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

  const loadLibrary = useCallback(async (root: string) => {
    const bp = bookPath(root);
    const mp = modelPath(root);
    const lp = logPath(root);
    const ep = enginePath(root);
    const bookRaw = JSON.parse(await native.readTextFile(bp)) as unknown;
    setBook(parseComboBook(bookRaw));
    try {
      const modelRaw = JSON.parse(await native.readTextFile(mp)) as ComboModel;
      setModel(modelRaw);
    } catch {
      setModel(defaultToonComboModel());
    }
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

  useEffect(() => {
    if (book && !sitId && book.situations[0]) {
      setSitId(book.situations[0].situationId);
      setNotes(book.situations[0].notes);
    }
  }, [book, sitId]);

  const situation = useMemo(
    () => book?.situations.find((s) => s.situationId === sitId) ?? null,
    [book, sitId],
  );

  async function persistBook(next: ComboBook) {
    if (!enginesRoot) throw new Error("comboRoot no configurado");
    await native.writeTextFile(bookPath(enginesRoot), JSON.stringify(next, null, 2) + "\n");
    setBook(next);
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
    if (tab === "replays" || tab === "aprendizaje") void refreshReplays();
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
    setWalk(loaded.walk);
    setNames(loaded.names);
    const guessed = guessBotActor(loaded.walk);
    setActor(guessed);
    const extracted = extractLine(loaded.walk, guessed, { fromTurn: 1, toTurn: 1 });
    setLine(extracted);
    if (book) setDiagnosis(diagnoseReplay(book, loaded.walk, guessed));
  }

  function onActorChange(next: Actor) {
    setActor(next);
    if (!walk) return;
    const extracted = extractLine(walk, next, { fromTurn: 1, toTurn: 1 });
    setLine(extracted);
    if (book) setDiagnosis(diagnoseReplay(book, walk, next));
  }

  async function addLineToSituation() {
    if (!book || !situation || !line || !picked) return;
    const next = addExampleToSituation(book, situation.situationId, {
      sourceReplay: picked.name,
      notes: notes.trim() || situation.notes,
      openingHand: line.openingHand,
      steps: line.steps.length ? line.steps : situation.steps,
      endBoard: line.endBoard,
    });
    const sit = next.situations.find((s) => s.situationId === situation.situationId);
    if (sit && notes.trim()) sit.notes = notes.trim();
    await persistBook(next);
    setStatus(`Ejemplo añadido a ${situation.situationId}.`);
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
    if (result.applied && result.nextSource) {
      await persistEngine(result.nextSource);
      setStatus(`Auto-parche aplicado (${diag.verdict}). Recompila WindBot con install:engines.`);
    } else {
      setStatus(result.reason ?? diag.notes);
    }
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

  async function rebuildModel() {
    if (!book) return;
    setStatus("Generando modelo…");
    try {
      const next = await suggestComboModel(
        {
          apiKey: settings?.apiKey,
          baseUrl: settings?.apiBaseUrl,
          model: settings?.apiModel,
        },
        {
          notes: notes || book.situations.map((s) => s.notes).join("\n"),
          engineExcerpt: engineSource.slice(0, 8000),
          bookSummary: bookSummary(book),
        },
      );
      await persistModel(next);
      setStatus("ComboModel actualizado.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function compileNow() {
    if (!book) return;
    const patches = compileComboBook(book, engineSource);
    if (patches.length === 0) {
      setStatus("El engine ya cubre las prioridades del libro.");
      return;
    }
    await persistEngine(applyEnginePatches(engineSource, patches));
    setStatus(`Aplicados ${patches.length} parches SelectCard desde el libro.`);
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
          Recetas gold en combos/toon-2026. El bot solo ejecuta C#; este lab
          reescribe SelectCard cuando un replay se desvía.
        </p>
      </aside>
      <main className="main">
        {error ? <div className="banner warn">{error}</div> : null}
        {status ? <div className="banner ok">{status}</div> : null}

        {tab === "libro" && book && (
          <>
            <h2>Libro de situaciones</h2>
            <p className="lede">
              Cada combo es una rama: going first, Ash, Maxx C, World ya activo…
              Añade replays a la situación, no un único ejemplo canónico.
            </p>
            <div className="split">
              <div className="sit-list">
                {book.situations.map((s) => (
                  <button
                    key={s.situationId}
                    className={sitId === s.situationId ? "active" : ""}
                    onClick={() => {
                      setSitId(s.situationId);
                      setNotes(s.notes);
                    }}
                  >
                    <strong>{s.title}</strong>
                    <div className="muted">{s.situationId}</div>
                  </button>
                ))}
              </div>
              {situation && (
                <div className="card">
                  <p>{situation.notes}</p>
                  <p className="muted">
                    going={situation.when.going ?? "—"} · world=
                    {String(situation.when.worldOnField ?? "—")} · threats=
                    {(situation.when.threats ?? []).join(", ") || "ninguna"} ·
                    ejemplos={situation.examples.length}
                  </p>
                  <h3>Pasos canónicos</h3>
                  <ul className="steps">
                    {situation.steps.map((st, i) => (
                      <li key={i}>
                        {stepKindLabel(st.kind)} {cardLabel(st.cardId, names)}
                        {st.selectCard?.length
                          ? ` → [${st.selectCard.map((id) => cardLabel(id, names)).join(", ")}]`
                          : ""}
                      </li>
                    ))}
                  </ul>
                  <h3>Campo objetivo</h3>
                  <p>
                    Monstruos: {situation.endBoard.monsters.map((id) => cardLabel(id, names)).join(", ") || "—"}
                    <br />
                    Magias: {situation.endBoard.spells.map((id) => cardLabel(id, names)).join(", ") || "—"}
                  </p>
                  <label>
                    Notas en español
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Con Bookmark + Rabbit quiero Ultimate y Terror seteado…"
                    />
                  </label>
                  <div className="row">
                    <button className="primary" onClick={() => void compileNow()}>
                      Compilar libro → engine
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {tab === "grafo" && (
          <>
            <h2>Cómo funciona el combo</h2>
            <p className="lede">
              Requires / enables / ventanas de Ash / recuperaciones. El LLM puede
              proponer el grafo; tú lo corrige.
            </p>
            <div className="row" style={{ marginBottom: "1rem" }}>
              <button className="primary" onClick={() => void rebuildModel()}>
                Regenerar modelo
              </button>
            </div>
            <ComboGraph model={model} />
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
                    <ul className="steps">
                      {line.steps.map((st, i) => (
                        <li key={i}>
                          {stepKindLabel(st.kind)} {cardLabel(st.cardId, names)}
                        </li>
                      ))}
                    </ul>
                    <p>
                      End board:{" "}
                      {[...line.endBoard.monsters, ...line.endBoard.spells]
                        .map((id) => cardLabel(id, names))
                        .join(", ") || "vacío"}
                    </p>
                    {diagnosis && (
                      <p className={diagnosis.verdict === "ok" ? "ok" : "bad"}>
                        {diagnosis.verdict}: {diagnosis.notes}
                      </p>
                    )}
                    <label>
                      Añadir a situación
                      <select
                        value={sitId ?? ""}
                        onChange={(e) => setSitId(e.target.value)}
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
                        Añadir ejemplo
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

        {tab === "aprendizaje" && (
          <>
            <h2>Auto-mejora</h2>
            <p className="lede">
              El lab compara el replay del bot con el libro. Si el parche es solo
              SelectCard y no rompe otras situaciones, se aplica solo.
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
