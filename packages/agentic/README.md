# @yugioh agentic (Toon 2026)

Teach-mode runtime: rank legal EDOPro actions, ask the user for the top 5, log preferences.

```bash
PYTHONPATH=packages/agentic/src python -m yugioh_agentic compile-book
PYTHONPATH=packages/agentic/src python -m yugioh_agentic serve
pytest agents/toon-2026/cases packages/agentic/tests
```

- `GET /v1/pending` — current `DecisionProposal` (204 if none)
- `POST /v1/propose` — rank and publish
- `POST /v1/choice` — `{ requestId, actionId, note? }`
- `POST /v1/decide` — long-poll until the user chooses (WindBot executor)
