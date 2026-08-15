import { convertFileSrc } from "@tauri-apps/api/core";
import {
  applyPlacesToBoard,
  buildComboLine,
  compactZones,
  KNOWN_CARD_NAMES,
  monsterPlaceTitle,
  padStances,
  padZones,
  stanceTitle,
  MONSTER_ZONE_SLOTS,
  SPELL_ZONE_SLOTS,
  type CardStance,
  type ComboStep,
  type EndBoard,
} from "@yugioh/bot-lab";

export function cardName(code: number, names: Record<string, string>): string {
  return names[String(code)] ?? KNOWN_CARD_NAMES[code] ?? `#${code}`;
}

function fileSrc(path: string): string {
  if (!path) return "";
  try {
    return convertFileSrc(path);
  } catch {
    return path;
  }
}

export function CardThumb({
  code,
  names,
  picsDir,
  unknownPic,
  coverPic = "",
  compact = false,
  place,
  stance,
}: {
  code: number;
  names: Record<string, string>;
  picsDir: string;
  unknownPic: string;
  coverPic?: string;
  compact?: boolean;
  place?: string;
  stance?: CardStance;
}) {
  const name = cardName(code, names);
  const fallbackSrc = fileSrc(unknownPic);
  const backSrc = fileSrc(coverPic) || fallbackSrc;
  const faceDown = stance === "set";
  const src = faceDown
    ? backSrc || fallbackSrc
    : code > 0 && picsDir
      ? fileSrc(`${picsDir}/${code}.jpg`)
      : fallbackSrc;
  const pose = stanceTitle(stance);
  const title = [name, place ? monsterPlaceTitle(place) : "", pose]
    .filter(Boolean)
    .join(" · ");
  const classes = [
    "card-thumb",
    compact ? "is-compact" : "",
    stance === "def" ? "is-def" : "",
    faceDown ? "is-set" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} title={title}>
      <span className="card-thumb-frame">
        {src ? (
          <img
            src={src}
            alt={faceDown ? `${name} boca abajo` : name}
            onError={(e) => {
              if (fallbackSrc && e.currentTarget.src !== fallbackSrc) {
                e.currentTarget.src = fallbackSrc;
              }
            }}
          />
        ) : (
          <span className="card-thumb-placeholder" />
        )}
        {place ? <span className="card-thumb-place">{place}</span> : null}
      </span>
      <span className="card-thumb-name">{name}</span>
    </span>
  );
}

export function CardZone({
  label,
  codes,
  names,
  picsDir,
  unknownPic,
}: {
  label: string;
  codes: number[];
  names: Record<string, string>;
  picsDir: string;
  unknownPic: string;
}) {
  return (
    <div className="card-row">
      <span className="card-row-label">{label}</span>
      {codes.length === 0 ? (
        <span className="card-row-empty">—</span>
      ) : (
        <div className="card-row-cards">
          {codes.map((code, i) => (
            <CardThumb
              key={`${code}-${i}`}
              code={code}
              names={names}
              picsDir={picsDir}
              unknownPic={unknownPic}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FieldSlot({
  code,
  place,
  stance,
  names,
  picsDir,
  unknownPic,
  coverPic,
}: {
  code: number;
  place: string;
  stance?: CardStance;
  names: Record<string, string>;
  picsDir: string;
  unknownPic: string;
  coverPic?: string;
}) {
  const pose = stanceTitle(stance);
  return (
    <div
      className={["field-slot", stance === "def" ? "is-def" : "", stance === "set" ? "is-set" : ""]
        .filter(Boolean)
        .join(" ")}
      title={[monsterPlaceTitle(place), pose].filter(Boolean).join(" · ")}
    >
      <span className="field-slot-label">{place}</span>
      {Number(code) > 0 ? (
        <CardThumb
          compact
          code={Number(code)}
          names={names}
          picsDir={picsDir}
          unknownPic={unknownPic}
          coverPic={coverPic}
          stance={stance}
        />
      ) : (
        <span className="field-slot-empty" />
      )}
    </div>
  );
}

export function EndBoardZones({
  board,
  steps = [],
  names,
  picsDir,
  unknownPic,
  coverPic,
}: {
  board: EndBoard;
  steps?: ComboStep[];
  names: Record<string, string>;
  picsDir: string;
  unknownPic: string;
  coverPic?: string;
}) {
  const placed = applyPlacesToBoard(board, steps);
  const mz = padZones(placed.monsterZones, MONSTER_ZONE_SLOTS);
  const st = padZones(placed.spellZones, SPELL_ZONE_SLOTS);
  const mzStance = padStances(placed.monsterStances, MONSTER_ZONE_SLOTS);
  const stStance = padStances(placed.spellStances, SPELL_ZONE_SLOTS);
  const hasField = compactZones(mz).length + compactZones(st).length > 0;
  const slot = (code: number, place: string, stance?: CardStance) => (
    <FieldSlot
      key={place}
      code={code}
      place={place}
      stance={stance}
      names={names}
      picsDir={picsDir}
      unknownPic={unknownPic}
      coverPic={coverPic}
    />
  );
  return (
    <>
      <div className="field-board">
        <div className="field-row field-row-emz">
          {slot(mz[5] ?? 0, "EMZ", mzStance[5])}
          {slot(mz[6] ?? 0, "EMZ2", mzStance[6])}
        </div>
        <div className="field-row">
          {(["MZ1", "MZ2", "MZ3", "MZ4", "MZ5"] as const).map((place, i) =>
            slot(mz[i] ?? 0, place, mzStance[i]),
          )}
        </div>
        <div className="field-row">
          {(["ST1", "ST2", "ST3", "ST4", "ST5"] as const).map((place, i) =>
            slot(st[i] ?? 0, place, stStance[i]),
          )}
          {slot(st[5] ?? 0, "Campo", stStance[5])}
        </div>
      </div>
      {!hasField ? (
        <>
          <CardZone
            label="Monstruos"
            codes={board.monsters}
            names={names}
            picsDir={picsDir}
            unknownPic={unknownPic}
          />
          <CardZone
            label="Magias"
            codes={board.spells}
            names={names}
            picsDir={picsDir}
            unknownPic={unknownPic}
          />
        </>
      ) : null}
      <CardZone
        label="Cementerio"
        codes={board.grave ?? []}
        names={names}
        picsDir={picsDir}
        unknownPic={unknownPic}
      />
      <CardZone
        label="Descarte"
        codes={board.banished ?? []}
        names={names}
        picsDir={picsDir}
        unknownPic={unknownPic}
      />
    </>
  );
}

export function ComboLine({
  steps,
  names,
  picsDir,
  unknownPic,
  coverPic,
}: {
  steps: ComboStep[];
  names: Record<string, string>;
  picsDir: string;
  unknownPic: string;
  coverPic?: string;
}) {
  const beats = buildComboLine(steps);
  if (beats.length === 0) return null;
  return (
    <ol className="combo-line">
      {beats.map((beat, i) => (
        <li key={`${beat.code}-${i}`} className="combo-line-beat">
          <span className="combo-line-verb" title={beat.verbTitle}>
            {i > 0 ? (
              <span className="combo-line-chevron" aria-hidden="true">
                →
              </span>
            ) : null}
            {beat.verb}
          </span>
          <CardThumb
            compact
            code={beat.code}
            names={names}
            picsDir={picsDir}
            unknownPic={unknownPic}
            coverPic={coverPic}
            place={beat.place}
            stance={beat.stance}
          />
        </li>
      ))}
    </ol>
  );
}
