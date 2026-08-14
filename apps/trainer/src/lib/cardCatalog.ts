import {
  indexUnknownCardsForIds,
  mergeCardNames,
  missingCardCodes,
  namesFromUnknownCache,
  officialCardDbCandidates,
  parseUnknownCardCache,
  parseYgoProDeckResponse,
  pruneOfficialFromCache,
  uniquePositiveCodes,
  upsertUnknownCards,
  type UnknownCardCache,
  type UnknownCardMeta,
} from "@yugioh/edopro-bridge";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { joinPath, native } from "./native";

const YGOPRODECK_URL = "https://db.ygoprodeck.com/api/v7/cardinfo.php";
const FETCH_CHUNK = 20;

export interface CardResolveResult {
  names: Record<string, string>;
  unknownMeta: Record<string, UnknownCardMeta>;
  fetched: number;
  pruned: number;
}

export interface CardResyncResult {
  removedOfficial: number;
  remaining: number;
  refreshed: number;
  failed: number;
}

async function catalogFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  try {
    return await tauriFetch(String(input), init);
  } catch {
    return fetch(input, init);
  }
}

async function cachePath(): Promise<string> {
  return joinPath(await native.appDataDir(), "card-cache", "unknown-cards.json");
}

export async function loadUnknownCardCache(): Promise<UnknownCardCache> {
  try {
    return parseUnknownCardCache(
      JSON.parse(await native.readTextFile(await cachePath())),
    );
  } catch {
    return parseUnknownCardCache(null);
  }
}

export async function saveUnknownCardCache(
  cache: UnknownCardCache,
): Promise<void> {
  await native.writeTextFile(
    await cachePath(),
    JSON.stringify(cache, null, 2),
  );
}

export async function unknownCardCacheCount(): Promise<number> {
  return Object.keys((await loadUnknownCardCache()).cards).length;
}

export async function listOfficialCardDbs(
  edoProRoot: string,
): Promise<string[]> {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const path of officialCardDbCandidates(edoProRoot, joinPath)) {
    if (seen.has(path)) continue;
    if ((await native.pathStat(path)).exists) {
      found.push(path);
      seen.add(path);
    }
  }
  try {
    const entries = await native.listDir(joinPath(edoProRoot, "expansions"));
    for (const entry of entries) {
      if (!entry.isFile || !entry.name.toLowerCase().endsWith(".cdb")) continue;
      if (seen.has(entry.path)) continue;
      found.push(entry.path);
      seen.add(entry.path);
    }
  } catch {
    // no expansions folder
  }
  return found;
}

export async function queryOfficialCardNames(
  edoProRoot: string,
  codes: number[],
): Promise<Record<string, string>> {
  const names: Record<string, string> = {};
  let missing = uniquePositiveCodes(codes);
  if (missing.length === 0) return names;
  for (const cdb of await listOfficialCardDbs(edoProRoot)) {
    if (missing.length === 0) break;
    try {
      const batch = await native.queryCardNames(cdb, missing);
      Object.assign(names, batch);
      missing = missing.filter((code) => !names[String(code)]);
    } catch {
      // skip unreadable cdb
    }
  }
  return names;
}

async function fetchYgoProDeckIds(
  ids: number[],
  fetchedAt: number,
  lang?: "es" | "en",
): Promise<Record<string, UnknownCardMeta>> {
  if (ids.length === 0) return {};
  try {
    const langQ = lang === "es" ? "&language=es" : "";
    const url = `${YGOPRODECK_URL}?id=${ids.join(",")}${langQ}`;
    const res = await catalogFetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return {};
    const payload: unknown = await res.json();
    return indexUnknownCardsForIds(
      ids,
      parseYgoProDeckResponse(payload, fetchedAt, lang),
    );
  } catch {
    return {};
  }
}

async function fetchUnknownCards(
  ids: number[],
): Promise<Record<string, UnknownCardMeta>> {
  const out: Record<string, UnknownCardMeta> = {};
  if (ids.length === 0) return out;
  const fetchedAt = Date.now();
  for (let i = 0; i < ids.length; i += FETCH_CHUNK) {
    const chunk = ids.slice(i, i + FETCH_CHUNK);
    const batch = await fetchYgoProDeckIds(chunk, fetchedAt);
    Object.assign(out, batch);
    const missed = chunk.filter((id) => !out[String(id)]);
    if (missed.length > 0 && chunk.length > 1) {
      for (const id of missed) {
        Object.assign(out, await fetchYgoProDeckIds([id], fetchedAt));
      }
    }
  }
  return out;
}

export async function resolveCardCatalog(
  edoProRoot: string,
  codes: number[],
): Promise<CardResolveResult> {
  const official = await queryOfficialCardNames(edoProRoot, codes);
  let cache = await loadUnknownCardCache();
  const pruned = pruneOfficialFromCache(cache, official);
  cache = pruned.cache;

  const stillMissing = missingCardCodes(codes, official).filter(
    (code) => !cache.cards[String(code)],
  );
  const fetched = await fetchUnknownCards(stillMissing);
  if (Object.keys(fetched).length > 0) {
    cache = upsertUnknownCards(cache, fetched);
  }
  if (pruned.removed.length > 0 || Object.keys(fetched).length > 0) {
    await saveUnknownCardCache(cache);
  }

  const unknownMeta: Record<string, UnknownCardMeta> = {};
  for (const code of missingCardCodes(codes, official)) {
    const meta = cache.cards[String(code)];
    if (meta) unknownMeta[String(code)] = meta;
  }

  return {
    names: mergeCardNames(official, namesFromUnknownCache(cache)),
    unknownMeta,
    fetched: Object.keys(fetched).length,
    pruned: pruned.removed.length,
  };
}

async function detailsCachePath(): Promise<string> {
  return joinPath(await native.appDataDir(), "card-cache", "card-details.json");
}

const detailsMemory = new Map<string, UnknownCardMeta>();

async function loadDetailsCache(): Promise<UnknownCardCache> {
  try {
    return parseUnknownCardCache(
      JSON.parse(await native.readTextFile(await detailsCachePath())),
    );
  } catch {
    return parseUnknownCardCache(null);
  }
}

async function persistCardDetail(card: UnknownCardMeta): Promise<void> {
  detailsMemory.set(String(card.id), card);
  const cache = await loadDetailsCache();
  const next = upsertUnknownCards(cache, { [String(card.id)]: card });
  await native.writeTextFile(
    await detailsCachePath(),
    JSON.stringify(next, null, 2),
  );
}

function cachedDetail(code: number): UnknownCardMeta | undefined {
  return detailsMemory.get(String(code));
}

/** Spanish-first card text for the inspector modal. Falls back to English. */
export async function fetchCardDetail(
  code: number,
): Promise<UnknownCardMeta | null> {
  if (code <= 0) return null;
  const key = String(code);
  const mem = cachedDetail(code);
  if (mem?.lang === "es") return mem;

  const disk = await loadDetailsCache();
  const cached = disk.cards[key];
  if (cached?.lang === "es") {
    detailsMemory.set(key, cached);
    return cached;
  }
  const known = mem ?? cached;
  if (known?.lang === "en") {
    detailsMemory.set(key, known);
    return known;
  }

  const fetchedAt = Date.now();
  const spanish = (await fetchYgoProDeckIds([code], fetchedAt, "es"))[key];
  if (spanish) {
    const card = { ...spanish, lang: "es" as const };
    await persistCardDetail(card);
    return card;
  }

  if (cached) {
    detailsMemory.set(key, cached);
    return cached;
  }
  if (mem) return mem;

  const english = (await fetchYgoProDeckIds([code], fetchedAt, "en"))[key];
  if (english) {
    const card = { ...english, lang: "en" as const };
    await persistCardDetail(card);
    return card;
  }
  return null;
}

export async function resyncUnknownCardCache(
  edoProRoot: string,
): Promise<CardResyncResult> {
  const cache = await loadUnknownCardCache();
  const cachedIds = Object.keys(cache.cards).map(Number).filter((n) => n > 0);
  const official = await queryOfficialCardNames(edoProRoot, cachedIds);
  const pruned = pruneOfficialFromCache(cache, official);
  const remainingIds = Object.keys(pruned.cache.cards).map(Number);
  const fetched = await fetchUnknownCards(remainingIds);
  const next = upsertUnknownCards(pruned.cache, fetched);
  await saveUnknownCardCache(next);
  return {
    removedOfficial: pruned.removed.length,
    remaining: Object.keys(next.cards).length,
    refreshed: Object.keys(fetched).length,
    failed: remainingIds.filter((id) => !next.cards[String(id)]).length,
  };
}
