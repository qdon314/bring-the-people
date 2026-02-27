#!/usr/bin/env python3
"""Export FastAPI OpenAPI schema to frontend-v2 shared generated directory."""
from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from growth.app.main import app  # noqa: E402

OUTPUT_PATH = ROOT / "frontend-v2" / "shared" / "api" / "generated" / "openapi.json"
OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

openapi_schema = app.openapi()
OUTPUT_PATH.write_text(json.dumps(openapi_schema, indent=2) + "\n", encoding="utf-8")

print(f"Wrote OpenAPI schema to {OUTPUT_PATH}")
