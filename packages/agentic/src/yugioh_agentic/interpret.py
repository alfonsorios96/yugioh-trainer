from __future__ import annotations

import json
import os
import re
import unicodedata
import urllib.error
import urllib.request
from dataclasses import dataclass

from .cards import CARD_NAMES, card_name
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
    "select": ("select", "elegir", "tributar", "tribute", "target"),
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


def _guess_card(folded: str) -> int | None:
    best_id: int | None = None
    best_len = 0
    for card_id, name in CARD_NAMES.items():
        aliases = (name.lower(),) + CARD_ALIASES.get(card_id, ())
        for alias in aliases:
            token = _fold(alias)
            if token and token in folded and len(token) > best_len:
                best_id = card_id
                best_len = len(token)
    return best_id


@dataclass
class InterpretResult:
    actionId: str | None
    kind: str | None
    cardId: int | None
    rationale: str
    source: str
    matched: bool


def interpret_local(prompt: str, legal: list[LegalAction]) -> InterpretResult:
    folded = _fold(prompt)
    kind = _guess_kind(folded)
    card_id = _guess_card(folded)
    scored: list[tuple[int, LegalAction]] = []
    for action in legal:
        score = 0
        if kind and action.kind == kind:
            score += 4
        if kind == "to_ep" and action.kind == "to_ep":
            score += 6
        if card_id is not None and action.cardId == card_id:
            score += 5
        label = _fold(action.label or card_name(action.cardId))
        if label and label in folded:
            score += 2
        if score:
            scored.append((score, action))
    scored.sort(key=lambda pair: (-pair[0], pair[1].id))
    if scored and scored[0][0] >= 4:
        action = scored[0][1]
        return InterpretResult(
            actionId=action.id,
            kind=action.kind,
            cardId=action.cardId,
            rationale=f"Interpreté «{prompt.strip()}» como {action.kind} {card_name(action.cardId)}",
            source="local",
            matched=True,
        )
    wanted = " ".join(part for part in (kind or "jugada", card_name(card_id) if card_id else "") if part)
    return InterpretResult(
        actionId=None,
        kind=kind,
        cardId=card_id,
        rationale=(
            f"«{prompt.strip()}» suena a {wanted}, pero EDOPro no ofrece esa acción "
            "en este prompt (no está en legalActions)."
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
            "label": a.label or card_name(a.cardId),
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
                    "español o inglés. Debes devolver SOLO JSON "
                    '{"actionId":"..."} eligiendo un id de la lista legal. '
                    "Si ninguna encaja, devuelve {\"actionId\": null}."
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
    action_id = parsed.get("actionId")
    legal_ids = {a.id for a in legal}
    if action_id in legal_ids:
        action = next(a for a in legal if a.id == action_id)
        return InterpretResult(
            actionId=action.id,
            kind=action.kind,
            cardId=action.cardId,
            rationale=f"LLM: «{prompt.strip()}» → {action.kind} {card_name(action.cardId)}",
            source="llm",
            matched=True,
        )
    return InterpretResult(
        actionId=None,
        kind=None,
        cardId=None,
        rationale=f"El LLM no encontró una acción legal para «{prompt.strip()}».",
        source="llm",
        matched=False,
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
