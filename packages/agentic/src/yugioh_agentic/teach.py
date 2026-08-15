from __future__ import annotations

import threading
import time
from typing import Any

from .interpret import InterpretResult, interpret_prompt
from .knowledge import assemble_prompt_context
from .learn import maybe_write_lesson, write_preference
from .log import append_event, dump, utc_now
from .ranker import TARGET_BOARDS, top5
from .types import (
    DecisionProposal,
    DecisionRequest,
    DecisionResponse,
    UserChoice,
    context_from_request,
    request_from_dict,
)


class IllegalActionError(ValueError):
    pass


class TeachSession:
    def __init__(self, write_lessons: bool = True) -> None:
        self._lock = threading.Lock()
        self._pending: dict[str, tuple[DecisionRequest, DecisionProposal]] = {}
        self._choices: dict[str, UserChoice] = {}
        self._events: list[dict[str, Any]] = []
        self._cv = threading.Condition(self._lock)
        self.write_lessons = write_lessons

    def propose(self, request: DecisionRequest) -> DecisionProposal:
        started = time.perf_counter()
        ranked, situation, mode, scores = top5(request)
        _, used = assemble_prompt_context(request.deckId)
        proposal = DecisionProposal(
            requestId=request.requestId,
            top5=ranked,
            othersCount=max(0, len(request.legalActions) - len(ranked)),
            situationId=situation,
            mode=mode,
            targetBoard=TARGET_BOARDS.get(situation or "", ""),
            legalActions=request.legalActions,
            scores=scores,
            knowledgeUsed=used,
            rankMs=(time.perf_counter() - started) * 1000,
            context=context_from_request(request),
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
        if execute and result.matched and result.actionId:
            response = self.choose(
                UserChoice(requestId=request_id, actionId=result.actionId, note=prompt)
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
            legal_ids = {a.id for a in request.legalActions}
            if choice.actionId not in legal_ids:
                raise IllegalActionError(
                    f"actionId {choice.actionId} is not in legalActions"
                )
            top_ids = {a.actionId for a in proposal.top5}
            from_top5 = choice.actionId in top_ids
            response = DecisionResponse(
                requestId=choice.requestId,
                actionId=choice.actionId,
                fromTop5=from_top5,
                situationId=proposal.situationId,
                mode=proposal.mode,
                scores=proposal.scores,
            )
            pref = write_preference(request, proposal, choice, from_top5)
            lesson = None
            if self.write_lessons:
                lesson_path = maybe_write_lesson(request, proposal, choice, from_top5)
                lesson = str(lesson_path) if lesson_path else None
            event = {
                "at": utc_now(),
                "type": "choice",
                "requestId": choice.requestId,
                "choice": dump(choice),
                "response": dump(response),
                "fromTop5": from_top5,
                "preference": pref,
                "lesson": lesson,
                "rankMs": proposal.rankMs,
            }
            self._choices[choice.requestId] = choice
            self._events.append(event)
            del self._pending[choice.requestId]
            self._cv.notify_all()
        append_event(event, request.deckId)
        return response

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

    def decide_blocking(self, request: DecisionRequest, timeout: float | None = None) -> DecisionResponse:
        self.propose(request)
        choice = self.wait_choice(request.requestId, timeout=timeout)
        # choose() already ran if submitted via HTTP; wait_choice returns stored choice.
        # If choose already consumed pending, rebuild response from stored data.
        with self._lock:
            if request.requestId not in self._pending:
                top_ids: set[str] = set()
                # response already recorded
                for event in reversed(self._events):
                    if event.get("type") == "choice" and event.get("requestId") == request.requestId:
                        data = event["response"]
                        return DecisionResponse(
                            requestId=data["requestId"],
                            actionId=data["actionId"],
                            fromTop5=data["fromTop5"],
                            situationId=data.get("situationId"),
                            mode=data["mode"],
                            scores=data.get("scores") or {},
                        )
        return self.choose(choice)


SESSION = TeachSession()


def propose_from_dict(data: dict[str, Any]) -> DecisionProposal:
    return SESSION.propose(request_from_dict(data))
