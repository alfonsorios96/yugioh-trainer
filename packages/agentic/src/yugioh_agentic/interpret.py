from __future__ import annotations

import json
import os
import re
import unicodedata
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any

from .cards import CARD_NAMES, card_name
from .labels import KIND_PREFIX, action_label
from .types import LegalAction

KIND_ALIASES: dict[str, tuple[str, ...]] = {
    "summon": (
        "summon",
        "ns",
        "normal summon",
        "invocar",
        "invocacion normal",
        "invocación normal",
        "invocar normal",
        "normal",
    ),
    "spsummon": (
        "spsummon",
        "ss",
        "special summon",
        "invocar especial",
        "invocacion especial",
        "invocación especial",
    ),
    "activate": ("activate", "activar", "activa", "act"),
    "set": ("set", "setear", "colocar", "boca abajo"),
    "to_ep": (
        "to_ep",
        "to-ep",
        "pass",
        "pasar",
        "pasar turno",
        "end",
        "fin",
        "end phase",
        "declarar fin",
    ),
    "announce": ("announce", "nombrar", "declarar", "name"),
    "select": ("select", "elegir", "tributar", "tribute", "target", "objetivo"),
    "chain": ("chain", "cadena", "chaining", "responder", "negar"),
    "option": ("option", "opcion", "opción", "efecto 1", "efecto 2", "efecto 3"),
}

CARD_ALIASES: dict[int, tuple[str, ...]] = {
    72921536: ("comic cat", "gato", "gato comico", "gato cómico"),
    45536531: ("funny dark rabbit", "rabbit", "conejo", "conejo oscuro"),
    8915275: ("evil box", "caja", "caja malvada"),
    91500017: ("toon bookmark", "bookmark", "marcador"),
    89997728: ("toon table of contents", "table", "indice", "índice", "tabla"),
    73628505: ("terraforming", "terraformar"),
    7293697: ("perfect world", "toon world the perfect world", "world", "mundo"),
    34298391: ("mind scan", "escaneo"),
    53094821: ("toon terror", "terror"),
    10045474: ("infinite impermanence", "imperm", "impermanencia"),
    42141493: ("mulcharmy fuwalos", "fuwalos"),
    14558127: ("ash blossom", "ash"),
    27204311: ("nibiru",),
}


def _fold(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text or "")
    stripped = "".join(ch for ch in nfkd if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9\s]", " ", stripped.lower())


def _guess_kind(folded: str) -> str | None:
    best: str | None = None
    best_len = 0
    for kind, aliases in KIND_ALIASES.items():
        for alias in aliases:
            if alias in folded and len(alias) > best_len:
                best = kind
                best_len = len(alias)
    return best


@dataclass
class InterpretResult:
    actionId: str | None
    kind: str | None
    cardId: int | None
    rationale: str
    source: str
    matched: bool
    understood: str = ""
    actionIds: list[str] = field(default_factory=list)
    actions: list[dict[str, Any]] = field(default_factory=list)
    ambiguous: bool = False


def _guess_cards(folded: str) -> list[int]:
    hits: list[tuple[int, int]] = []
    for card_id, name in CARD_NAMES.items():
        aliases = (name.lower(),) + CARD_ALIASES.get(card_id, ())
        best = 0
        for alias in aliases:
            token = _fold(alias)
            if token and token in folded and len(token) > best:
                best = len(token)
        if best:
            hits.append((best, card_id))
    hits.sort(key=lambda pair: (-pair[0], pair[1]))
    seen: set[int] = set()
    ordered: list[int] = []
    for _length, card_id in hits:
        if card_id not in seen:
            seen.add(card_id)
            ordered.append(card_id)
    return ordered


def _pack_actions(actions: list[LegalAction]) -> list[dict[str, Any]]:
    return [
        {
            "id": a.id,
            "kind": a.kind,
            "cardId": a.cardId,
            "label": action_label(a),
            "desc": a.desc,
        }
        for a in actions
    ]


def _understood_text(
    prompt: str,
    kind: str | None,
    card_ids: list[int],
    actions: list[LegalAction],
) -> str:
    if actions:
        labels = [action_label(a) for a in actions]
        if len(labels) == 1:
            return labels[0]
        if len(labels) == 2:
            return f"{labels[0]} y {labels[1]}"
        return f"{', '.join(labels[:-1])} y {labels[-1]}"
    parts: list[str] = []
    if kind:
        parts.append(KIND_PREFIX.get(kind, kind))
    for card_id in card_ids:
        parts.append(card_name(card_id))
    if parts:
        return " ".join(parts)
    return prompt.strip()


def _is_ambiguous(actions: list[LegalAction]) -> bool:
    if len(actions) <= 1:
        return False
    return not all(a.kind == "select" for a in actions)


def _finish(
    *,
    prompt: str,
    actions: list[LegalAction],
    kind: str | None,
    card_ids: list[int],
    rationale: str,
    source: str,
    matched: bool,
    understood: str | None = None,
) -> InterpretResult:
    primary = actions[0] if actions else None
    return InterpretResult(
        actionId=primary.id if primary else None,
        kind=primary.kind if primary else kind,
        cardId=primary.cardId if primary else (card_ids[0] if card_ids else None),
        rationale=rationale,
        source=source,
        matched=matched,
        understood=understood or _understood_text(prompt, kind, card_ids, actions),
        actionIds=[a.id for a in actions],
        actions=_pack_actions(actions),
        ambiguous=_is_ambiguous(actions),
    )


def _pick_scored(
    scored: list[tuple[int, LegalAction]],
    mentioned: list[int],
) -> list[LegalAction]:
    if not scored or scored[0][0] < 4:
        return []
    if len(mentioned) >= 2:
        by_card: dict[int, LegalAction] = {}
        extras: list[LegalAction] = []
        for score, action in scored:
            if score < 4:
                continue
            if action.cardId in mentioned and action.cardId not in by_card:
                by_card[action.cardId] = action
            elif action.kind == "to_ep" or action.id in ("chain-pass", "select-skip"):
                extras.append(action)
        return [by_card[cid] for cid in mentioned if cid in by_card] + extras
    top = scored[0][0]
    return [action for score, action in scored if score == top]


def interpret_local(prompt: str, legal: list[LegalAction]) -> InterpretResult:
    folded = _fold(prompt)
    kind = _guess_kind(folded)
    mentioned = _guess_cards(folded)
    scored: list[tuple[int, LegalAction]] = []
    for action in legal:
        score = 0
        if kind and action.kind == kind:
            score += 4
        if kind == "to_ep" and action.kind == "to_ep":
            score += 6
        if action.id == "chain-pass" and (
            "pasar cadena" in folded or "pass chain" in folded or folded.strip() == "pasar"
        ):
            score += 8
        if action.id == "select-skip" and ("cancelar" in folded or "skip" in folded):
            score += 8
        if "efecto 2" in folded and action.kind == "activate" and action.desc is not None:
            if int(action.desc) % 16 == 1:
                score += 3
        if "efecto 1" in folded and action.kind == "activate" and action.desc is not None:
            if int(action.desc) % 16 == 0:
                score += 3
        if action.cardId is not None and action.cardId in mentioned:
            score += 5
        label = _fold(action.label or card_name(action.cardId))
        if label and label in folded:
            score += 2
        if score:
            scored.append((score, action))
    scored.sort(key=lambda pair: (-pair[0], pair[1].id))
    chosen = _pick_scored(scored, mentioned)
    if chosen:
        labels = ", ".join(action_label(a) for a in chosen)
        return _finish(
            prompt=prompt,
            actions=chosen,
            kind=kind,
            card_ids=mentioned,
            rationale=f"Interpreté «{prompt.strip()}» como {labels}",
            source="local",
            matched=True,
        )
    wanted = _understood_text(prompt, kind, mentioned, [])
    return _finish(
        prompt=prompt,
        actions=[],
        kind=kind,
        card_ids=mentioned,
        rationale=(
            f"«{prompt.strip()}» suena a {wanted or 'una jugada'}, pero EDOPro no ofrece "
            "esa acción en este prompt (no está en legalActions)."
        ),
        source="local",
        matched=False,
    )


def interpret_llm(
    prompt: str,
    legal: list[LegalAction],
    *,
    api_key: str,
    base_url: str,
    model: str,
    timeout: float = 20.0,
) -> InterpretResult | None:
    catalog = [
        {
            "id": a.id,
            "kind": a.kind,
            "cardId": a.cardId,
            "label": a.label or action_label(a),
            "desc": a.desc,
        }
        for a in legal
    ]
    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Eres un árbitro de Yu-Gi-Oh. El usuario describe una jugada en "
                    "español o inglés. Devuelve SOLO JSON con lo que entendiste y "
                    "las acciones legales que aplican: "
                    '{"understood":"...","actionIds":["id1","id2"]}. '
                    "Usa varios ids solo si el prompt pide varios objetivos "
                    "(p. ej. un select múltiple). En idle/activate/chain/option "
                    "elige como mucho un id. Si ninguna encaja, "
                    '{"understood":"...","actionIds":[]}.'
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {"prompt": prompt, "legalActions": catalog},
                    ensure_ascii=False,
                ),
            },
        ],
    }
    url = base_url.rstrip("/") + "/chat/completions"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return None
    content = (
        ((raw.get("choices") or [{}])[0].get("message") or {}).get("content") or ""
    )
    match = re.search(r"\{.*\}", content, re.S)
    if not match:
        return None
    try:
        parsed = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    legal_by_id = {a.id: a for a in legal}
    raw_ids = parsed.get("actionIds")
    if not isinstance(raw_ids, list):
        raw_ids = [parsed.get("actionId")] if parsed.get("actionId") else []
    chosen: list[LegalAction] = []
    seen: set[str] = set()
    for raw in raw_ids:
        action_id = str(raw) if raw is not None else ""
        if action_id in legal_by_id and action_id not in seen:
            seen.add(action_id)
            chosen.append(legal_by_id[action_id])
    understood = str(parsed.get("understood") or "").strip()
    if chosen:
        labels = ", ".join(action_label(a) for a in chosen)
        return _finish(
            prompt=prompt,
            actions=chosen,
            kind=chosen[0].kind,
            card_ids=[a.cardId for a in chosen if a.cardId],
            rationale=f"LLM: «{prompt.strip()}» → {labels}",
            source="llm",
            matched=True,
            understood=understood or None,
        )
    kind = _guess_kind(_fold(prompt))
    mentioned = _guess_cards(_fold(prompt))
    return _finish(
        prompt=prompt,
        actions=[],
        kind=kind,
        card_ids=mentioned,
        rationale=f"El LLM no encontró una acción legal para «{prompt.strip()}».",
        source="llm",
        matched=False,
        understood=understood or None,
    )


def interpret_prompt(
    prompt: str,
    legal: list[LegalAction],
    *,
    api_key: str | None = None,
    base_url: str | None = None,
    model: str | None = None,
) -> InterpretResult:
    key = (api_key or os.environ.get("OPENAI_API_KEY") or "").strip()
    if key:
        llm = interpret_llm(
            prompt,
            legal,
            api_key=key,
            base_url=(base_url or os.environ.get("OPENAI_BASE_URL") or "https://api.openai.com/v1"),
            model=(model or os.environ.get("OPENAI_MODEL") or "gpt-4o-mini"),
        )
        if llm is not None:
            return llm
    return interpret_local(prompt, legal)
