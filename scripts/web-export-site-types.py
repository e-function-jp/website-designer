#!/usr/bin/env python3
"""site_categories.py の required_pages などを JSON に書き出す。

Python 側（収集・ローテ）と Node 側（品質チェック）で定義が二重管理になると
必ずズレるため、正本は site_categories.py 1 本にし、Node へは生成物を渡す。

    python3 scripts/web-export-site-types.py   # -> docs/site-types.json
"""
from __future__ import annotations
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from site_categories import SITE_TYPES, INDUSTRIES  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
out = ROOT / "docs" / "site-types.json"
out.write_text(
    json.dumps({"site_types": SITE_TYPES, "industries": INDUSTRIES}, ensure_ascii=False, indent=2),
    encoding="utf-8",
)
print(f"wrote {out.relative_to(ROOT)} ({len(SITE_TYPES)} site types)")
