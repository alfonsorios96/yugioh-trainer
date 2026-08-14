import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  formatCardTooltip,
  type CardRef,
  type UnknownCardMeta,
} from "@yugioh/edopro-bridge";
import { fetchCardDetail } from "./lib/cardCatalog";
import {
  formatCombatStat,
  isLinkType,
  isPendulumType,
  isSpellOrTrap,
  isXyzType,
  translateAttribute,
  translateRace,
  translateType,
} from "./lib/cardLabels";

export interface InspectableCard {
  code: number;
  name: string;
  src: string;
  fallbackSrc: string;
  seed?: UnknownCardMeta;
  hidden?: boolean;
}

interface CardInspectorApi {
  inspect: (card: InspectableCard) => void;
}

const CardInspectorContext = createContext<CardInspectorApi | null>(null);

export function CardInspectorProvider({ children }: { children: ReactNode }) {
  const [card, setCard] = useState<InspectableCard | null>(null);
  const inspect = useCallback((next: InspectableCard) => setCard(next), []);
  const close = useCallback(() => setCard(null), []);
  return (
    <CardInspectorContext.Provider value={{ inspect }}>
      {children}
      {card && (
        <CardDetailModal key={card.code} card={card} onClose={close} />
      )}
    </CardInspectorContext.Provider>
  );
}

function useCardInspector(): CardInspectorApi {
  const ctx = useContext(CardInspectorContext);
  if (!ctx) {
    throw new Error("CardThumb must be used inside CardInspectorProvider");
  }
  return ctx;
}

function cardSrc(code: number, picsDir: string, unknownPic: string) {
  const path = code > 0 ? `${picsDir}/${code}.jpg` : unknownPic;
  try {
    return convertFileSrc(path);
  } catch {
    return path;
  }
}

export function CardThumb({
  card,
  names,
  unknownMeta,
  picsDir,
  unknownPic,
  hidden,
}: {
  card: CardRef;
  names: Record<string, string>;
  unknownMeta?: Record<string, UnknownCardMeta>;
  picsDir: string;
  unknownPic: string;
  hidden?: boolean;
}) {
  const { inspect } = useCardInspector();
  const meta = unknownMeta?.[String(card.code)];
  const name = hidden ? "?" : (names[String(card.code)] ?? `#${card.code}`);
  const temporary = !hidden && Boolean(meta);
  const title = hidden ? "?" : formatCardTooltip(name, meta, temporary);
  const fallbackSrc = convertFileSrc(unknownPic);
  const src = hidden ? fallbackSrc : cardSrc(card.code, picsDir, unknownPic);

  return (
    <button
      type="button"
      className={`card-thumb${temporary ? " temp" : ""}`}
      title={title}
      aria-label={hidden ? "Carta oculta" : `Ver datos de ${name}`}
      onClick={() =>
        inspect({
          code: card.code,
          name,
          src,
          fallbackSrc,
          seed: meta,
          hidden,
        })
      }
    >
      <span className="card-thumb-frame">
        <img
          src={src}
          alt={name}
          onError={(e) => {
            e.currentTarget.src = fallbackSrc;
          }}
        />
      </span>
      <span className="card-thumb-name">{name}</span>
    </button>
  );
}

function CardDetailModal({
  card,
  onClose,
}: {
  card: InspectableCard;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<UnknownCardMeta | undefined>(card.seed);
  const [loading, setLoading] = useState(!card.hidden && card.code > 0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (card.hidden || card.code <= 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    void fetchCardDetail(card.code)
      .then((meta) => {
        if (cancelled) return;
        if (meta) setDetail(meta);
        else if (!card.seed) setFailed(true);
      })
      .catch(() => {
        if (!cancelled && !card.seed) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [card.code, card.hidden, card.seed]);

  const displayName = card.hidden ? "Carta oculta" : (detail?.name ?? card.name);
  const typeLabel = translateType(detail?.type);
  const raceLabel = translateRace(detail?.race);
  const attrLabel = translateAttribute(detail?.attribute);
  const atk = formatCombatStat(detail?.atk);
  const def = formatCombatStat(detail?.def);
  const xyz = isXyzType(detail?.type);
  const link = isLinkType(detail?.type);
  const pendulum = isPendulumType(detail?.type);
  const spellTrap = isSpellOrTrap(detail?.type);

  const facts: { label: string; value: string }[] = [];
  if (typeLabel) facts.push({ label: "Tipo", value: typeLabel });
  if (attrLabel) facts.push({ label: "Atributo", value: attrLabel });
  if (raceLabel && !spellTrap) facts.push({ label: "Raza", value: raceLabel });
  if (!spellTrap && !link && detail?.level != null) {
    facts.push({
      label: xyz ? "Rango" : "Nivel",
      value: String(detail.level),
    });
  }
  if (link && detail?.linkval != null) {
    facts.push({ label: "Enlace", value: String(detail.linkval) });
  }
  if (pendulum && detail?.scale != null) {
    facts.push({ label: "Escala de Péndulo", value: String(detail.scale) });
  }
  if (!spellTrap && atk) facts.push({ label: "ATK", value: atk });
  if (!spellTrap && !link && def) facts.push({ label: "DEF", value: def });
  if (detail?.archetype) facts.push({ label: "Arquetipo", value: detail.archetype });

  return (
    <div className="card-modal-root" onClick={onClose} role="presentation">
      <div
        className="card-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="card-modal-close" onClick={onClose}>
          Cerrar
        </button>
        <div className="card-modal-art">
          <img
            src={card.src}
            alt={displayName}
            onError={(e) => {
              e.currentTarget.src = card.fallbackSrc;
            }}
          />
        </div>
        <div className="card-modal-body">
          <p className="card-modal-kicker">Datos de la carta</p>
          <h2 id="card-modal-title">{displayName}</h2>
          {card.hidden ? (
            <p className="card-modal-note">
              Esta carta está oculta. No se muestran datos.
            </p>
          ) : (
            <>
              {detail?.name &&
                card.name !== "?" &&
                detail.name !== card.name && (
                  <p className="card-modal-aka">{card.name}</p>
                )}
              {facts.length > 0 && (
                <dl className="card-modal-facts">
                  {facts.map((fact) => (
                    <div key={fact.label}>
                      <dt>{fact.label}</dt>
                      <dd>{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {loading && (
                <p className="card-modal-note">Cargando texto de la carta…</p>
              )}
              {failed && !detail && (
                <p className="card-modal-note">
                  No se encontraron datos de esta carta.
                </p>
              )}
              {detail?.lang === "en" && (
                <p className="card-modal-note">
                  Sin traducción al español; se muestra el texto en inglés.
                </p>
              )}
              {detail?.pendDesc && (
                <section className="card-modal-text">
                  <h3>Efecto de Péndulo</h3>
                  <p>{detail.pendDesc}</p>
                </section>
              )}
              {detail?.desc && (
                <section className="card-modal-text">
                  <h3>{pendulum ? "Efecto de monstruo" : "Efecto"}</h3>
                  <p>{detail.desc}</p>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
