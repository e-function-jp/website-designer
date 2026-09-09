#!/usr/bin/env python3
"""独立judge の採点結果（良い点・悪い点）を実装 SKILL へ書き戻す。

背景
----
採点しても指摘が実装側に反映されず、同じ問題が繰り返し起きる。
実測（corporate-20260903-1448）では、judge が挙げた
「実績数値がトップと下層で食い違う」「CTA文言と遷移先が一致しない」
「装飾的な英語見出しの連発」といった指摘が、次のランへ引き継がれる経路が
無かった。Measure 段の直後にこれを実行して蓄積する。

方針
----
- issues / strengths は **意味解釈をしない**。そのまま追記し、重複っぽいものを
  正規化して機械的に除外するだけにする。
  解釈は後続のエージェント／人間の仕事であって、スクリプトの仕事ではない。
- 静的節（実装前チェックリスト）は一切書き換えない。
  「自動更新ログ」マーカー以降だけを更新する。
- 直近 MAX_ENTRIES ラン分だけ保持する（無限に肥大化させない）。

Usage:
    python3 scripts/web-update-skill-from-score.py <run_dir>
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKILL_PATH = ROOT / ".claude" / "skills" / "web-implementation-tips" / "SKILL.md"
MARKER = "## 自動更新ログ（design-score後に追記。手動編集しない）"
MAX_ENTRIES = 30
MAX_ISSUES_PER_MODEL = 5
MAX_STRENGTHS_PER_MODEL = 3


def normalize(text: str) -> str:
    """重複判定用の正規化。空白を潰して先頭40文字だけ見る。"""
    return re.sub(r"\s+", "", text)[:40]


def load_score(run_dir: Path) -> dict:
    p = run_dir / "design-score-data.json"
    if not p.exists():
        print(f"design-score-data.json がありません: {p}", file=sys.stderr)
        sys.exit(1)
    return json.loads(p.read_text(encoding="utf-8"))


def build_entry(run_dir: Path, data: dict, existing_norms: set[str]) -> tuple[str, set[str]]:
    run_id = data.get("run_id") or run_dir.name
    site_type = data.get("site_type", "")
    today = datetime.now().strftime("%Y-%m-%d")

    lines = [f"### {run_id} ({site_type}, {today})"]
    new_norms: set[str] = set()

    for model, v in (data.get("models") or {}).items():
        issues = [i for i in (v.get("issues") or []) if normalize(i) not in existing_norms]
        strengths = [s for s in (v.get("strengths") or []) if normalize(s) not in existing_norms]
        if not issues and not strengths:
            continue
        lines.append(f"\n**{model}** (total={v.get('total')})")
        for i in issues[:MAX_ISSUES_PER_MODEL]:
            lines.append(f"- ⚠ {i}")
            new_norms.add(normalize(i))
        for s in strengths[:MAX_STRENGTHS_PER_MODEL]:
            lines.append(f"- ✓ {s}")
            new_norms.add(normalize(s))

    if len(lines) == 1:
        return "", new_norms   # 新規情報なし
    return "\n".join(lines), new_norms


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: web-update-skill-from-score.py <run_dir>", file=sys.stderr)
        return 2
    run_dir = Path(sys.argv[1])
    data = load_score(run_dir)

    if not SKILL_PATH.exists():
        print(f"SKILL がありません: {SKILL_PATH}", file=sys.stderr)
        return 1

    text = SKILL_PATH.read_text(encoding="utf-8")
    idx = text.find(MARKER)
    if idx == -1:
        print(f"マーカーが見つかりません: {MARKER!r}", file=sys.stderr)
        return 1

    head = text[: idx + len(MARKER)]
    tail = text[idx + len(MARKER):]

    comment_m = re.search(r"(<!--.*?-->)", tail, re.S)
    comment = comment_m.group(1) if comment_m else ""
    body = tail[comment_m.end():] if comment_m else tail
    existing = [e.strip() for e in re.split(r"(?=^### )", body, flags=re.M) if e.strip()]

    run_id = data.get("run_id") or run_dir.name
    if any(e.startswith(f"### {run_id} ") for e in existing):
        print(f"{run_id} は記録済み。二重登録を避けてスキップします。")
        return 0

    existing_norms = {normalize(m) for m in re.findall(r"^- [⚠✓] (.+)$", tail, re.M)}
    entry, new_norms = build_entry(run_dir, data, existing_norms)
    if not entry:
        print("新規情報なし。SKILL 更新をスキップします。")
        return 0

    entries = ([entry] + existing)[:MAX_ENTRIES]
    SKILL_PATH.write_text(head + "\n\n" + comment + "\n\n" + "\n\n".join(entries) + "\n",
                          encoding="utf-8")
    print(f"更新: {SKILL_PATH.relative_to(ROOT)} "
          f"（新規 {len(new_norms)} 件 / 保持 {len(entries)} ラン分）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
