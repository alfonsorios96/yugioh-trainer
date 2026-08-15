from __future__ import annotations

import os
import threading
import time
from typing import Any

from .duel_log import append_duel_decision
from .follow import LineCursor
from .interpret import InterpretResult, interpret_prompt
from .knowledge import assemble_prompt_context
from .labels import enrich_legal_labels
from .learn import write_preference
from .log import append_event, dump, utc_now
from .ranker import TARGET_BOARDS, top5
from .types import (
    DecisionProposal,
    DecisionRequest,
    DecisionResponse,
    DecisionSource,
    UserChoice,
    context_from_request,
    request_from_dict,
)


class IllegalActionError(ValueError):
    pass


def teach_mode_enabled(data: dict[str, Any] | None = None) -> bool:
    if data and data.get("teach") in (True, 1, "1", "true", "yes"):
        return True
    return os.environ.get("YGO_TEACH", "").strip().lower() in ("1", "true", "yes")


class TeachSession:
    def __init__(self, write_lessons: bool = True) -> None:
        self._lock = threading.Lock()
        self._pending: dict[str, tuple[DecisionRequest, DecisionProposal]] = {}
        self._choices: dict[str, UserChoice] = {}
        self._events: list[dict[str, Any]] = []
        self._cv = threading.Condition(self._lock)
        self._cursors: dict[str, LineCursor] = {}
        self._duel_steps: dict[str, int] = {}
        self.write_lessons = write_lessons

    def propose(self, request: DecisionRequest) -> DecisionProposal:
        started = time.perf_counter()
        enrich_legal_labels(request)
        with self._lock:
            cursor = self._cursors.get(request.duelId)
        result = top5(request, cursor)
        _, used = assemble_prompt_context(request.deckId)
        proposal = DecisionProposal(
            requestId=request.requestId,
            top5=result.ranked,
            othersCount=max(0, len(request.legalActions) - len(result.ranked)),
            situationId=result.situationId,
            mode=result.mode,
            targetBoard=TARGET_BOARDS.get(result.situationId or "", ""),
            legalActions=request.legalActions,
            scores=result.scores,
            knowledgeUsed=used,
            rankMs=(time.perf_counter() - started) * 1000,
            context=context_from_request(request),
            source=result.source,
            stepIndex=result.stepIndex,
            bookSteps=result.bookSteps,
        )
        event = {
            "at": utc_now(),
            "type": "proposal",
            "request": dump(request),
            "proposal": dump(proposal),
        }
        with self._cv:
            self._pending[request.requestId] = (request, proposal)
            self._events.append(event)
        append_event(event, request.deckId)
        return proposal

    def interpret(
        self,
        request_id: str,
        prompt: str,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str | None = None,
        execute: bool = False,
    ) -> tuple[InterpretResult, DecisionResponse | None]:
        with self._lock:
            pair = self._pending.get(request_id)
            if pair is None:
                raise KeyError(f"No pending proposal for {request_id}")
            request, _proposal = pair
            legal = list(request.legalActions)
        result = interpret_prompt(
            prompt, legal, api_key=api_key, base_url=base_url, model=model
        )
        ids = list(result.actionIds or ([result.actionId] if result.actionId else []))
        if execute and result.matched and ids and not result.ambiguous:
            response = self.choose(
                UserChoice(
                    requestId=request_id,
                    actionId=ids[0],
                    actionIds=ids,
                    note=prompt,
                )
            )
            return result, response
        return result, None

    def pending(self) -> DecisionProposal | None:
        with self._lock:
            if not self._pending:
                return None
            _, proposal = next(reversed(list(self._pending.values())))
            return proposal

    def choose(self, choice: UserChoice) -> DecisionResponse:
        with self._cv:
            pair = self._pending.get(choice.requestId)
            if pair is None:
                raise KeyError(f"No pending proposal for {choice.requestId}")
            request, proposal = pair
            response = _response_for(request, proposal, choice)
            self._update_cursor(request, proposal, response)
            from_top5 = response.fromTop5
            pref = write_preference(request, proposal, choice, from_top5)
            step_no = self._duel_steps.get(request.duelId, 0) + 1
            self._duel_steps[request.duelId] = step_no
            log_path = append_duel_decision(
                request, proposal, choice, response, step_no=step_no
            )
            event = {
                "at": utc_now(),
                "type": "choice",
                "requestId": choice.requestId,
                "choice": dump(choice),
                "response": dump(response),
                "fromTop5": from_top5,
                "preference": pref,
                "lesson": str(log_path),
                "rankMs": proposal.rankMs,
            }
            self._choices[choice.requestId] = choice
            self._events.append(event)
            del self._pending[choice.requestId]
            self._cv.notify_all()
        append_event(event, request.deckId)
        return response

    def _update_cursor(
        self,
        request: DecisionRequest,
        proposal: DecisionProposal,
        response: DecisionResponse,
    ) -> None:
        if response.source == "book" and proposal.situationId and proposal.stepIndex is not None:
            nxt = proposal.stepIndex + 1 if response.source == "book" else proposal.stepIndex
            # glue (select) does not advance; detect via same action kind
            chosen = next((a for a in request.legalActions if a.id == response.actionId), None)
            book_kinds = {"summon", "spsummon", "activate", "set"}
            if chosen and chosen.kind in book_kinds:
                self._cursors[request.duelId] = LineCursor(proposal.situationId, nxt)
            else:
                self._cursors[request.duelId] = LineCursor(
                    proposal.situationId, proposal.stepIndex
                )
            return
        self._cursors.pop(request.duelId, None)

    def wait_choice(self, request_id: str, timeout: float | None = None) -> UserChoice:
        deadline = None if timeout is None else time.time() + timeout
        with self._cv:
            while request_id not in self._choices:
                remaining = None
                if deadline is not None:
                    remaining = deadline - time.time()
                    if remaining <= 0:
                        raise TimeoutError(request_id)
                self._cv.wait(timeout=remaining)
            return self._choices[request_id]

    def decide_auto(self, request: DecisionRequest) -> DecisionResponse:
        proposal = self.propose(request)
        if not proposal.top5:
            raise IllegalActionError("no legal actions to decide")
        top = proposal.top5[0]
        return self.choose(
            UserChoice(
                requestId=request.requestId,
                actionId=top.actionId,
                actionIds=[top.actionId],
                note="auto",
            )
        )

    def decide_blocking(self, request: DecisionRequest, timeout: float | None = None) -> DecisionResponse:
        self.propose(request)
        choice = self.wait_choice(request.requestId, timeout=timeout)
        with self._lock:
            if request.requestId not in self._pending:
                for event in reversed(self._events):
                    if event.get("type") == "choice" and event.get("requestId") == request.requestId:
                        data = event["response"]
                        return _response_from_event(data)
        return self.choose(choice)


def _chosen_ids(choice: UserChoice) -> list[str]:
    ids = list(choice.actionIds or [])
    if choice.actionId and choice.actionId not in ids:
        ids.insert(0, choice.actionId)
    return ids


def _response_for(
    request: DecisionRequest,
    proposal: DecisionProposal,
    choice: UserChoice,
) -> DecisionResponse:
    legal_by_id = {a.id: a for a in request.legalActions}
    chosen_ids = _chosen_ids(choice)
    for action_id in chosen_ids:
        if action_id not in legal_by_id:
            raise IllegalActionError(f"actionId {action_id} is not in legalActions")
    primary = legal_by_id[choice.actionId]
    extras = [legal_by_id[i] for i in chosen_ids]
    top_ids = {a.actionId for a in proposal.top5}
    from_top5 = choice.actionId in top_ids
    card_ids = [a.cardId for a in extras if a.cardId]
    source: DecisionSource = proposal.source
    if proposal.top5 and choice.actionId != proposal.top5[0].actionId:
        source = "teach"
    return DecisionResponse(
        requestId=choice.requestId,
        actionId=choice.actionId,
        actionIds=chosen_ids,
        kind=primary.kind,
        cardId=primary.cardId,
        cardIds=card_ids,
        desc=primary.desc,
        optionIndex=primary.optionIndex,
        fromTop5=from_top5,
        situationId=proposal.situationId,
        mode=proposal.mode,
        scores=proposal.scores,
        source=source,
        stepIndex=proposal.stepIndex if source == "book" else None,
        bookSteps=proposal.bookSteps if source == "book" else None,
    )


def _response_from_event(data: dict[str, Any]) -> DecisionResponse:
    return DecisionResponse(
        requestId=data["requestId"],
        actionId=data["actionId"],
        fromTop5=data["fromTop5"],
        situationId=data.get("situationId"),
        mode=data["mode"],
        scores=data.get("scores") or {},
        actionIds=list(data.get("actionIds") or [data["actionId"]]),
        kind=data.get("kind"),
        cardId=data.get("cardId"),
        cardIds=list(data.get("cardIds") or []),
        desc=data.get("desc"),
        optionIndex=data.get("optionIndex"),
        source=data.get("source") or "heuristic",
        stepIndex=data.get("stepIndex"),
        bookSteps=data.get("bookSteps"),
    )


SESSION = TeachSession()


def propose_from_dict(data: dict[str, Any]) -> DecisionProposal:
    return SESSION.propose(request_from_dict(data))
