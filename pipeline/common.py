from __future__ import annotations

from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "config" / "universe.yaml"
DATA_DIR = ROOT / "data"
WEB_DATA = ROOT / "web" / "public" / "data"


def load_universe() -> dict:
    return yaml.safe_load(CONFIG.read_text(encoding="utf-8"))
