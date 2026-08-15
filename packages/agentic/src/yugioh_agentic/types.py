from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal

Going = Literal["first", "second"]
Mode = Literal["follow", "improvise", "safe-pass"]
DecisionSource = Literal["book", "heuristic", "teach"]
ActionKind = Literal[
    "summon",
    "spsummon",
    "activate",
    "set",
    "to_ep",
    "select",
    "announce",
    "repos",
    "chain",
    "option",
]


@dataclass
class CardRef:
    code: int
    pos: int | None = None


@dataclass
class PlayerState:
    lp: int = 8000
    hand: list[int] = field(default_factory=list)
    monsters: list[int] = field(default_factory=list)
    spells: list[int] = field(default_factory=list)
    grave: list[int] = field(default_factory=list)
    banished: list[int] = field(default_factory=list)
    extra: list[int] = field(default_factory=list)
    monsterZones: list[int] = field(default_factory=list)
    spellZones: list[int] = field(default_factory=list)
    monsterStances: list[str] = field(default_factory=list)
    spellStances: list[str] = field(default_factory=list)


@dataclass
class Constraints:
    normalSummonUsed: bool = False
    summonCount: int = 0
    selectRole: str | None = None
    chainPlayer: int | None = None
    selectMin: int = 1
    selectMax: int = 1
    selectCancelable: bool = False
    selectHint: int | None = None


@dataclass
class LegalAction:
    id: str
    kind: str
    cardId: int | None = None
    place: str | None = None
    label: str | None = None
    desc: int | None = None
    optionIndex: int | None = None


@dataclass
class DecisionRequest:
    requestId: str
    duelId: str
    turn: int
    phase: str
    going: str
    self: PlayerState
    opp: PlayerState
    legalActions: list[LegalAction]
    constraints: Constraints = field(default_factory=Constraints)
    threats: list[str] = field(default_factory=list)
    promptKind: str = "idle"
    deckId: str = "toon-2026"


@dataclass
class RankedAction:
    actionId: str
    kind: str
    cardId: int | None
    score: float
    why: str
    label: str | None = None
    desc: int | None = None


@dataclass
class RankResult:
    ranked: list[RankedAction]
    situationId: str | None
    mode: Mode
    scores: dict[str, float]
    source: DecisionSource = "heuristic"
    stepIndex: int | None = None
    bookSteps: int | None = None


@dataclass
class TeachContext:
    turn: int
    phase: str
    going: str
    promptKind: str
    threats: list[str]
    self: PlayerState
    opp: PlayerState
    constraints: Constraints


@dataclass
class DecisionProposal:
    requestId: str
    top5: list[RankedAction]
    othersCount: int
    situationId: str | None
    mode: Mode
    targetBoard: str
    legalActions: list[LegalAction]
    scores: dict[str, float]
    knowledgeUsed: list[str] = field(default_factory=list)
    rankMs: float = 0.0
    context: TeachContext | None = None
    source: DecisionSource = "heuristic"
    stepIndex: int | None = None
    bookSteps: int | None = None


@dataclass
class UserChoice:
    requestId: str
    actionId: str
    actionIds: list[str] = field(default_factory=list)
    note: str | None = None


@dataclass
class DecisionResponse:
    requestId: str
    actionId: str
    fromTop5: bool
    situationId: str | None
    mode: Mode
    scores: dict[str, float]
    actionIds: list[str] = field(default_factory=list)
    kind: str | None = None
    cardId: int | None = None
    cardIds: list[int] = field(default_factory=list)
    desc: int | None = None
    optionIndex: int | None = None
    source: DecisionSource = "heuristic"
    stepIndex: int | None = None
    bookSteps: int | None = None


def _player_from(data: dict[str, Any] | None) -> PlayerState:
    data = data or {}
    return PlayerState(
        lp=int(data.get("lp", 8000)),
        hand=[int(x) for x in data.get("hand", [])],
        monsters=[int(x) for x in data.get("monsters", [])],
        spells=[int(x) for x in data.get("spells", [])],
        grave=[int(x) for x in data.get("grave", [])],
        banished=[int(x) for x in data.get("banished", [])],
        extra=[int(x) for x in data.get("extra", [])],
        monsterZones=[int(x) for x in data.get("monsterZones", [])],
        spellZones=[int(x) for x in data.get("spellZones", [])],
        monsterStances=[str(x) for x in data.get("monsterStances", [])],
        spellStances=[str(x) for x in data.get("spellStances", [])],
    )


def context_from_request(req: DecisionRequest) -> TeachContext:
    return TeachContext(
        turn=req.turn,
        phase=req.phase,
        going=req.going,
        promptKind=req.promptKind,
        threats=list(req.threats),
        self=req.self,
        opp=req.opp,
        constraints=req.constraints,
    )


def request_from_dict(data: dict[str, Any]) -> DecisionRequest:
    constraints = data.get("constraints") or {}
    actions = [
        LegalAction(
            id=str(a["id"]),
            kind=str(a["kind"]),
            cardId=_opt_int(a.get("cardId")),
            place=a.get("place"),
            label=a.get("label"),
            desc=_opt_int(a.get("desc")),
            optionIndex=_opt_int(a.get("optionIndex")),
        )
        for a in data.get("legalActions", [])
    ]
    return DecisionRequest(
        requestId=str(data["requestId"]),
        duelId=str(data.get("duelId", "duel")),
        turn=int(data.get("turn", 1)),
        phase=str(data.get("phase", "MP1")),
        going=str(data.get("going", "first")),
        self=_player_from(data.get("self")),
        opp=_player_from(data.get("opp")),
        legalActions=actions,
        constraints=Constraints(
            normalSummonUsed=bool(constraints.get("normalSummonUsed", False)),
            summonCount=int(constraints.get("summonCount", 0)),
            selectRole=constraints.get("selectRole"),
            chainPlayer=_opt_int(constraints.get("chainPlayer")),
            selectMin=int(constraints.get("selectMin", 1) or 1),
            selectMax=int(constraints.get("selectMax", 1) or 1),
            selectCancelable=bool(constraints.get("selectCancelable", False)),
            selectHint=_opt_int(constraints.get("selectHint")),
        ),
        threats=[str(t) for t in data.get("threats", [])],
        promptKind=str(data.get("promptKind", "idle")),
        deckId=str(data.get("deckId", "toon-2026")),
    )


def _opt_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    return int(value)


def choice_from_dict(data: dict[str, Any]) -> UserChoice:
    action_id = str(data["actionId"])
    extra = data.get("actionIds") or []
    action_ids = [str(x) for x in extra] if extra else [action_id]
    if action_id not in action_ids:
        action_ids = [action_id, *action_ids]
    return UserChoice(
        requestId=str(data["requestId"]),
        actionId=action_id,
        actionIds=action_ids,
        note=data.get("note"),
    )


def to_dict(obj: Any) -> Any:
    if hasattr(obj, "__dataclass_fields__"):
        return {k: to_dict(v) for k, v in asdict(obj).items()}
    if isinstance(obj, list):
        return [to_dict(x) for x in obj]
    return obj
