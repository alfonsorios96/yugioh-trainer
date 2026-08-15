from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "packages" / "agentic" / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from yugioh_agentic.paths import set_test_dirs  # noqa: E402
from yugioh_agentic.types import request_from_dict  # noqa: E402

FIXTURES = Path(__file__).resolve().parent / "fixtures"


@pytest.fixture
def tmp_memory(tmp_path: Path):
    set_test_dirs(memory=tmp_path / "memory", generated=tmp_path / "generated")
    yield tmp_path
    set_test_dirs(None, None)


def load_case(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def request_of(case: dict):
    return request_from_dict(case["request"])
