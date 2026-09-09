#!/usr/bin/env python3
"""Look 段の解析結果をサイト種別ごとのプレイブックへ蓄積する。

背景
----
Look の解析はラン限りで使い捨てられ、次回以降のディレクションに参照されない。
`docs/playbooks/{site_type}.md` に積み上げ、Direction 段の入力にする。

やること
--------
1. 今回の `look-analysis.md` を「観測ログ」へ新しい順で追記する
2. 全ログから **決定的に集計できるもの** だけを「機械集計」節に出す
   - 配色（16進コード）の頻度
   - モーションの実測値（reveal 種別 / duration / easing）— これは website 固有。
     参照サイトの演出は `motion/summary.json` に数値で残っているので、
     種別をまたいだ傾向として集計できる
   意味的なマージ（「この型は一般化できるか」等）はしない。
   それは読み手（ディレクター）の仕事であって、スクリプトの仕事ではない。

Usage:
    python3 scripts/web-update-playbook.py <run_dir> <site_type>
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PLAYBOOK_DIR = ROOT / "docs" / "playbooks"
RUNS_DIR = ROOT / "docs" / "quality" / "runs"

OBS_MARKER = "## 観測ログ"
AGG_MARKER = "## 機械集計（自動更新。手動編集しない）"

HEADER_TEMPLATE = """# プレイブック: {label}

Look 段の解析結果を蓄積したサイト種別別ドキュメント。
Direction 段と実装 SKILL の入力として参照する。
観測ログと機械集計は `scripts/web-update-playbook.py` が自動更新する。

**これは一般論のガイドではなく、実測の積み上げ**である。1件しか観測して
いないことは「要追加観測」と明記し、断定しない。

{agg}

{obs}
"""


def collect_motion(site_type: str) -> dict:
    """同じサイト種別の全ランから motion/summary.json を集める。"""
    kinds: Counter[str] = Counter()
    durations: list[int] = []
    easings: Counter[str] = Counter()
    headers: Counter[str] = Counter()
    reduced_ok = [0, 0]

    for d in sorted(RUNS_DIR.glob(f"{site_type}-*")):
        p = d / "motion" / "summary.json"
        if not p.exists():
            continue
        try:
            s = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        # direction_hints は**トップページ限定**の集計なので、
        # トップに演出が無いサイトでは空になる（実測: corp.ezobolic.jp は
        # トップ 0 件 / 下層 11 件だった）。プレイブックはサイト全体の傾向を
        # 見たいので pages[] を使う。
        hints = s.get("direction_hints") or {}
        for k, n in (hints.get("reveal_kinds") or {}).items():
            if k != "lazy-blur-up" and n:
                kinds[k] += n
        for page in s.get("pages") or []:
            dk = page.get("dominantKind")
            if dk and dk != "lazy-blur-up" and page.get("revealCount"):
                kinds[dk] += page["revealCount"]
            d = page.get("durationMs") or {}
            if d.get("median"):
                durations.append(d["median"])
            for e in page.get("easings") or []:
                easings[e] += 1
        dur = hints.get("duration_ms") or {}
        if dur.get("median"):
            durations.append(dur["median"])
        for e in hints.get("easings") or []:
            easings[e] += 1
        hb = (s.get("cross_page") or {}).get("header_behavior") or {}
        if hb:
            flags = [k for k in ("shrinks", "hides", "changesBackground", "togglesClass") if hb.get(k)]
            headers[",".join(flags) or "変化なし"] += 1
        rm = s.get("reduced_motion") or {}
        if rm:
            reduced_ok[0 if rm.get("respected") else 1] += 1

    return {
        "kinds": kinds, "durations": sorted(durations),
        "easings": easings, "headers": headers, "reduced": reduced_ok,
    }


def collect_colors(playbook_text: str, look_text: str) -> Counter:
    return Counter(re.findall(r"#[0-9A-Fa-f]{6}", playbook_text + "\n" + look_text))


def build_aggregation(site_type: str, colors: Counter, motion: dict) -> str:
    lines = [AGG_MARKER, ""]

    lines.append("### 参照サイトの配色（頻度）")
    if colors:
        top = colors.most_common(12)
        lines.append("")
        lines.append(" ".join(f"`{c}`×{n}" for c, n in top))
    else:
        lines.append("\nまだ観測なし。")

    lines += ["", "### モーション実測（同種別の全ランを集計）", ""]
    if motion["kinds"]:
        lines.append("- リビール種別: " + " / ".join(
            f"{k} {n}" for k, n in motion["kinds"].most_common()))
    if motion["durations"]:
        ds = motion["durations"]
        lines.append(f"- duration(median) の観測: {ds} ms")
    if motion["easings"]:
        lines.append("- easing: " + " / ".join(
            f"`{e}`×{n}" for e, n in motion["easings"].most_common(5)))
    if motion["headers"]:
        lines.append("- ヘッダーのスクロール挙動: " + " / ".join(
            f"{k}×{n}" for k, n in motion["headers"].most_common()))
    ok, ng = motion["reduced"]
    if ok or ng:
        lines.append(f"- prefers-reduced-motion 尊重: あり {ok} / なし {ng}"
                     "（参照が非対応でも真似しないこと）")
    if not any([motion["kinds"], motion["durations"], motion["easings"],
                motion["headers"], any(motion["reduced"])]):
        lines.append("まだ観測なし。`web-analyze-reference-motion.mjs` を実行したランが必要。")

    lines.append("")
    return "\n".join(lines)


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: web-update-playbook.py <run_dir> <site_type>", file=sys.stderr)
        return 2
    run_dir, site_type = Path(sys.argv[1]), sys.argv[2]

    look = run_dir / "look-analysis.md"
    if not look.exists():
        print(f"look-analysis.md がありません: {look}", file=sys.stderr)
        return 1
    look_text = look.read_text(encoding="utf-8").strip()

    sys.path.insert(0, str(ROOT / "scripts"))
    from site_categories import BY_ID  # noqa: E402
    label = (BY_ID.get(site_type) or {}).get("label", site_type)

    PLAYBOOK_DIR.mkdir(parents=True, exist_ok=True)
    path = PLAYBOOK_DIR / f"{site_type}.md"
    existing = path.read_text(encoding="utf-8") if path.exists() else ""

    run_id = run_dir.name
    if f"### run: {run_id}" in existing:
        print(f"{run_id} は記録済み。二重登録を避けてスキップします。")
        return 0

    # 既存の観測ログ本文（機械集計節は毎回作り直すので取り除く）
    obs_body = ""
    if OBS_MARKER in existing:
        obs_body = existing[existing.index(OBS_MARKER) + len(OBS_MARKER):].strip()
        # 末尾に機械集計が来ている場合は切る
        if AGG_MARKER in obs_body:
            obs_body = obs_body[: obs_body.index(AGG_MARKER)].strip()

    ref = ""
    job = run_dir / "job.json"
    if job.exists():
        j = json.loads(job.read_text(encoding="utf-8"))
        r = j.get("reference") or {}
        ref = f"参照: {r.get('title','')} （{r.get('url','')}） / 業種: {j.get('industry_label') or r.get('industry','')}"

    entry = (f"### run: {run_id}（{datetime.now().strftime('%Y-%m-%d')}）\n\n"
             f"{ref}\n\n{look_text}\n")

    colors = collect_colors(obs_body, look_text)
    motion = collect_motion(site_type)
    agg = build_aggregation(site_type, colors, motion)
    obs = OBS_MARKER + "\n\n" + entry + ("\n---\n\n" + obs_body if obs_body else "")

    path.write_text(HEADER_TEMPLATE.format(label=label, agg=agg, obs=obs), encoding="utf-8")
    print(f"更新: {path.relative_to(ROOT)}（配色 {len(colors)} 色 / "
          f"モーション観測 {sum(motion['kinds'].values())} 件）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
