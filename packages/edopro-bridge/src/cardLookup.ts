/** Temporary metadata for cards missing from the official EDOPro databases. */
export interface UnknownCardMeta {
  id: number;
  name: string;
  type?: string;
  race?: string;
  attribute?: string;
  level?: number;
  atk?: number;
  def?: number;
  desc?: string;
  pendDesc?: string;
  linkval?: number;
  scale?: number;
  archetype?: string;
  /** Alternate art / print passcodes that resolve to this card. */
  imageIds?: number[];
  source: "ygoprodeck";
  fetchedAt: number;
  lang?: "es" | "en";
}

export interface UnknownCardCache {
  version: 1;
  updatedAt: number;
  cards: Record<string, UnknownCardMeta>;
}

export function emptyUnknownCardCache(): UnknownCardCache {
  return { version: 1, updatedAt: 0, cards: {} };
}

export function uniquePositiveCodes(codes: number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const code of codes) {
    if (code <= 0 || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

export function missingCardCodes(
  codes: number[],
  officialNames: Record<string, string>,
): number[] {
  return uniquePositiveCodes(codes).filter((code) => !officialNames[String(code)]);
}

export function namesFromUnknownCache(
  cache: UnknownCardCache,
): Record<string, string> {
  const names: Record<string, string> = {};
  for (const [id, card] of Object.entries(cache.cards)) {
    if (card.name) names[id] = card.name;
  }
  return names;
}

/** Official names win; cache only fills gaps. */
export function mergeCardNames(
  official: Record<string, string>,
  fallback: Record<string, string>,
): Record<string, string> {
  const out = { ...official };
  for (const [id, name] of Object.entries(fallback)) {
    if (!out[id] && name) out[id] = name;
  }
  return out;
}

export function pruneOfficialFromCache(
  cache: UnknownCardCache,
  officialNames: Record<string, string>,
): { cache: UnknownCardCache; removed: string[] } {
  const removed: string[] = [];
  const cards: Record<string, UnknownCardMeta> = {};
  for (const [id, card] of Object.entries(cache.cards)) {
    if (officialNames[id]) {
      removed.push(id);
      continue;
    }
    cards[id] = card;
  }
  return {
    cache: {
      version: 1,
      updatedAt: Date.now(),
      cards,
    },
    removed,
  };
}

export function upsertUnknownCards(
  cache: UnknownCardCache,
  incoming: Record<string, UnknownCardMeta>,
): UnknownCardCache {
  return {
    version: 1,
    updatedAt: Date.now(),
    cards: { ...cache.cards, ...incoming },
  };
}

export function replaceHashCodes(
  text: string,
  names: Record<string, string>,
): string {
  return text.replace(/#(\d{4,})/g, (full, id: string) => names[id] ?? full);
}

export function formatCardTooltip(
  name: string,
  meta?: UnknownCardMeta,
  temporary = false,
): string {
  const lines = [name];
  if (meta) {
    const kind = [meta.attribute, meta.race, meta.type].filter(Boolean).join(" · ");
    if (kind) lines.push(kind);
    const stats: string[] = [];
    if (meta.level != null) stats.push(`Lv${meta.level}`);
    if (meta.linkval != null) stats.push(`Link-${meta.linkval}`);
    if (meta.atk != null) stats.push(`ATK ${meta.atk}`);
    if (meta.def != null) stats.push(`DEF ${meta.def}`);
    if (stats.length) lines.push(stats.join(" / "));
    if (meta.desc) lines.push(meta.desc);
  }
  if (temporary) lines.push("Temporal · YGOPRODeck");
  return lines.join("\n");
}

interface YgoProDeckImage {
  id?: number;
}

interface YgoProDeckCard {
  id?: number;
  name?: string;
  type?: string;
  race?: string;
  attribute?: string;
  level?: number;
  atk?: number;
  def?: number;
  desc?: string;
  pend_desc?: string;
  linkval?: number;
  scale?: number;
  archetype?: string;
  card_images?: YgoProDeckImage[];
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function parseYgoProDeckCard(
  row: unknown,
  fetchedAt: number,
  lang?: "es" | "en",
): UnknownCardMeta | null {
  if (!row || typeof row !== "object") return null;
  const card = row as YgoProDeckCard;
  if (typeof card.id !== "number" || !card.name) return null;
  const imageIds = (card.card_images ?? [])
    .map((img) => img.id)
    .filter((id): id is number => typeof id === "number");
  return {
    id: card.id,
    name: card.name,
    type: asOptionalString(card.type),
    race: asOptionalString(card.race),
    attribute: asOptionalString(card.attribute),
    level: asOptionalNumber(card.level),
    atk: asOptionalNumber(card.atk),
    def: asOptionalNumber(card.def),
    desc: asOptionalString(card.desc),
    pendDesc: asOptionalString(card.pend_desc),
    linkval: asOptionalNumber(card.linkval),
    scale: asOptionalNumber(card.scale),
    archetype: asOptionalString(card.archetype),
    imageIds: imageIds.length ? imageIds : undefined,
    source: "ygoprodeck",
    fetchedAt,
    lang,
  };
}

export function parseYgoProDeckResponse(
  payload: unknown,
  fetchedAt: number,
  lang?: "es" | "en",
): UnknownCardMeta[] {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];
  const out: UnknownCardMeta[] = [];
  for (const row of data) {
    const parsed = parseYgoProDeckCard(row, fetchedAt, lang);
    if (parsed) out.push(parsed);
  }
  return out;
}

/** Map requested passcodes to metadata, including alternate-art image IDs. */
export function indexUnknownCardsForIds(
  requestedIds: number[],
  cards: UnknownCardMeta[],
): Record<string, UnknownCardMeta> {
  const byId = new Map<number, UnknownCardMeta>();
  for (const card of cards) {
    byId.set(card.id, card);
    for (const imageId of card.imageIds ?? []) {
      if (!byId.has(imageId)) byId.set(imageId, card);
    }
  }
  const out: Record<string, UnknownCardMeta> = {};
  for (const id of requestedIds) {
    const card = byId.get(id);
    if (!card) continue;
    out[String(id)] = { ...card, id };
  }
  return out;
}

export function parseUnknownCardCache(raw: unknown): UnknownCardCache {
  if (!raw || typeof raw !== "object") return emptyUnknownCardCache();
  const value = raw as Partial<UnknownCardCache>;
  if (value.version !== 1 || !value.cards || typeof value.cards !== "object") {
    return emptyUnknownCardCache();
  }
  const cards: Record<string, UnknownCardMeta> = {};
  for (const [id, card] of Object.entries(value.cards)) {
    if (!card || typeof card !== "object" || !card.name) continue;
    cards[id] = card;
  }
  return {
    version: 1,
    updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : 0,
    cards,
  };
}
