from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import urlparse

from .learn import export_finetune
from .teach import SESSION, IllegalActionError
from .types import UserChoice, request_from_dict, to_dict

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8765


class AgentHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args: Any) -> None:
        return

    def _json(self, code: int, payload: Any) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _empty(self, code: int) -> None:
        self.send_response(code)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

    def _read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8") or "{}")

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path in ("/health", "/v1/health"):
            self._json(200, {"ok": True})
            return
        if path == "/v1/pending":
            proposal = SESSION.pending()
            if proposal is None:
                self._empty(204)
                return
            self._json(200, to_dict(proposal))
            return
        self._json(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        try:
            data = self._read_json()
        except json.JSONDecodeError:
            self._json(400, {"error": "invalid json"})
            return
        if path == "/v1/propose":
            request = request_from_dict(data)
            proposal = SESSION.propose(request)
            self._json(200, to_dict(proposal))
            return
        if path == "/v1/choice":
            try:
                choice = UserChoice(
                    requestId=str(data["requestId"]),
                    actionId=str(data["actionId"]),
                    note=data.get("note"),
                )
                response = SESSION.choose(choice)
            except KeyError as exc:
                self._json(404, {"error": str(exc)})
                return
            except IllegalActionError as exc:
                self._json(400, {"error": str(exc)})
                return
            self._json(200, to_dict(response))
            return
        if path == "/v1/decide":
            request = request_from_dict(data)
            timeout = data.get("timeout")
            try:
                response = SESSION.decide_blocking(
                    request, timeout=float(timeout) if timeout else None
                )
            except TimeoutError:
                self._json(504, {"error": "no user choice"})
                return
            self._json(200, to_dict(response))
            return
        if path == "/v1/interpret":
            try:
                result, response = SESSION.interpret(
                    str(data["requestId"]),
                    str(data.get("prompt") or ""),
                    api_key=data.get("apiKey"),
                    base_url=data.get("baseUrl"),
                    model=data.get("model"),
                    execute=bool(data.get("execute")),
                )
            except KeyError as exc:
                self._json(404, {"error": str(exc)})
                return
            payload = {
                "actionId": result.actionId,
                "kind": result.kind,
                "cardId": result.cardId,
                "rationale": result.rationale,
                "source": result.source,
                "matched": result.matched,
            }
            if response is not None:
                payload["response"] = to_dict(response)
            self._json(200 if result.matched else 422, payload)
            return
        if path == "/v1/export-finetune":
            path_out = export_finetune(str(data.get("deckId", "toon-2026")))
            self._json(200, {"path": str(path_out)})
            return
        self._json(404, {"error": "not found"})


def serve(host: str = DEFAULT_HOST, port: int = DEFAULT_PORT) -> None:
    httpd = ThreadingHTTPServer((host, port), AgentHandler)
    print(f"yugioh-agentic listening on http://{host}:{port}")
    httpd.serve_forever()
