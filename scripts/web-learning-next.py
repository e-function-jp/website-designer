#!/usr/bin/env python3
"""次に作るサイト種別を選び、作業ラン用ディレクトリを開く。

lp-designer の `lp-learning-cron-next.py` の website 版。
違いは主軸が「業種」ではなく「サイト種別」であること、および
成果物が 1 ファイルではなく複数ページのディレクトリ束であること。

さらに 2026-09 から corporate は主軸が1つしかなく参照サイトを
random.choice で選ぶため**同じ業種が連続する**問題があったため、
種別内の**業種**を従軸として足した（lp-designer と同じ式）。
参照が一定数未満の業種は対象外、直近の業種も避ける。

出力パス規約:
    src/pages/sites/{site_type}/{model}-{YYYYMMDD-HHMM}/   # 複数ページ
    public/sites/{site_type}/_shared/{stamp}/              # 共有画像資産
    docs/quality/runs/{site_type}-{stamp}/                 # 作業単位

使い方:
    python3 scripts/web-learning-next.py            # ラン作成
    python3 scripts/web-learning-next.py --dry-run  # 選定結果の確認のみ
"""
from __future__ import annotations

import argparse
import csv
import json
import random
import re
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))
from env_config import preview_base, report_base, repo_root  # noqa: E402
from site_categories import (  # noqa: E402
    rotation_site_types,
    BY_ID,
    INDUSTRY_BY_ID,
)
from web_qualify_reference import qualify  # noqa: E402

ROOT = repo_root()
STATE = ROOT / "docs/quality/run-state.json"
ARCHIVE = ROOT / "site_archive/site_archive_latest.csv"
RUNS = ROOT / "docs/quality/runs"
SITES_DIR = ROOT / "src/pages/sites"

TYPES = rotation_site_types()

# 目標構成比の平滑化。ギャラリーの新着は入れ替わりが激しいので、
# 一様分布とブレンドして目標が乱高下しないようにする（lp-designer の実測知見）。
UNIFORM_BLEND = 0.5
RECENT_TYPE_EXCLUDE = 2    # 直近何回分のサイト種別を避けるか
TARGET_CAP_MULTIPLE = 2.0  # 1種別が目標を独占しないための上限

# 業種（従軸）の足切り閾値。corporate は22業種に散っているが、参照が3件未満は
# 候補プールが狭すぎて偏る（lp-designer で同じ数値を採用、2026-08 時点で検証済）。
MIN_INDUSTRY_REFS = 3
RECENT_INDUSTRY_EXCLUDE = 1  # 種別に比べ対象が少ないので除外幅は小さく


def own_site_count(type_id: str) -> int:
    d = SITES_DIR / type_id
    return sum(1 for c in d.iterdir() if c.is_dir()) if d.exists() else 0


def own_industry_counts() -> dict[str, int]:
    """{industry_id: サンプル数} を _site.ts の `industry` から実数で数える。

    `_site.ts` を素のパースで読むのは brittle なので、決め打ちの正規表現で
    `industry: '<id>'` 行 1 行だけを拾う（複数行やコメントは外さない）。
    見つからないサンプルは集計に入れない（=不明）。
    """
    counts: dict[str, int] = {}
    if not SITES_DIR.exists():
        return counts
    pat = re.compile(r"^\s*industry:\s*['\"]([a-z0-9-]+)['\"]", re.M)
    for type_dir in SITES_DIR.iterdir():
        if not type_dir.is_dir():
            continue
        for sample_dir in type_dir.iterdir():
            if not sample_dir.is_dir():
                continue
            f = sample_dir / "_site.ts"
            if not f.exists():
                continue
            m = pat.search(f.read_text(encoding="utf-8"))
            if not m:
                continue
            ind = m.group(1)
            counts[ind] = counts.get(ind, 0) + 1
    return counts


def load_archive() -> list[dict]:
    if not ARCHIVE.exists():
        return []
    with ARCHIVE.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def compute_weights(archive: list[dict]) -> dict[str, float]:
    """{site_type_id: 不足度} を返す。不足度 = 目標構成比 - 自前の構成比。"""
    total = len(archive) or 1
    counts: dict[str, int] = {}
    for row in archive:
        cid = row.get("site_type") or "other"
        counts[cid] = counts.get(cid, 0) + 1

    n = len(TYPES) or 1
    uniform = 1.0 / n
    occ_sum = sum(counts.get(t["id"], 0) / total for t in TYPES) or 1.0

    target = {
        t["id"]: UNIFORM_BLEND * uniform
        + (1 - UNIFORM_BLEND) * ((counts.get(t["id"], 0) / total) / occ_sum)
        for t in TYPES
    }

    cap = TARGET_CAP_MULTIPLE * uniform
    for _ in range(5):
        over = [k for k, v in target.items() if v > cap]
        if not over:
            break
        for k in over:
            target[k] = cap
        s = sum(target.values()) or 1.0
        target = {k: v / s for k, v in target.items()}

    own = {t["id"]: own_site_count(t["id"]) for t in TYPES}
    total_own = sum(own.values())
    return {
        cid: round(target[cid] - (own[cid] / total_own if total_own else 0.0), 4)
        for cid in target
    }


def pick_type(archive: list[dict], recent: list[str]) -> dict:
    weights = compute_weights(archive)
    ranked = sorted(TYPES, key=lambda t: weights[t["id"]], reverse=True)
    blocked = set(recent[-RECENT_TYPE_EXCLUDE:])
    for t in ranked:
        if t["id"] not in blocked:
            return t
    return ranked[0]


def _industry_pool(archive: list[dict], type_id: str) -> dict[str, int]:
    """{industry_id: 件数} を (サイト種別 AND 業種) で集計。"""
    out: dict[str, int] = {}
    for r in archive:
        if r.get("site_type") != type_id:
            continue
        ind = r.get("industry") or ""
        if not ind or ind not in INDUSTRY_BY_ID:
            continue
        out[ind] = out.get(ind, 0) + 1
    return out


def pick_industry(archive: list[dict], type_id: str, recent: list[str],
                  own: dict[str, int]) -> tuple[str | None, dict]:
    """種別に属する業種を、参照数と保有数の不足度で選ぶ。

    戻り値は (industry_id | None, weights_industry, skipped)。
      - None: 候補が枯れた（call 側で業種条件を落として参照選択を再走する）
      - weights_industry: 重み（job.json に書く）
      - skipped: 足切り除外した業種（reason つき）
    """
    pool = _industry_pool(archive, type_id)
    eligible = {k: v for k, v in pool.items() if v >= MIN_INDUSTRY_REFS}
    skipped = {k: v for k, v in pool.items() if v < MIN_INDUSTRY_REFS}

    if not eligible:
        return None, {}, skipped

    # 目標構成比 = 種別に属する参照での一様分布
    n = len(eligible)
    target = {k: 1.0 / n for k in eligible}
    total_own = sum(own.get(k, 0) for k in eligible) or 1
    weights = {
        k: round(target[k] - (own.get(k, 0) / total_own), 4) for k in eligible
    }
    blocked = {h.get("industry", "") for h in recent if h.get("industry")}
    ranked = sorted(eligible.keys(), key=lambda k: weights[k], reverse=True)
    for k in ranked:
        if k not in blocked:
            return k, weights, skipped
    # 全部 blocked なら一番重みの高いもの（ブロック設計は目安）
    return ranked[0], weights, skipped


def pick_reference(type_id: str, archive: list[dict], used: set[str],
                   industry: str | None,
                   industry_fallback: bool = False,
                   max_probe: int = 12) -> dict:
    """同じサイト種別の参照サイトを1件選ぶ。使用済みは避ける。

    industry が指定されていれば「種別 AND 業種」で絞る。候補が枯れたら
    `industry_fallback=True` を渡すことで業種条件を落として再走する。
    """
    pool = [r for r in archive
            if r.get("site_type") == type_id
            and (industry_fallback or not industry or r.get("industry") == industry)
            and r["id"] not in used]
    if not pool and not industry_fallback:
        # 業種条件を緩める（この関数では外さない。呼び出し側で再走する）
        return {"_retry_without_industry": True}
    if not pool:
        pool = [r for r in archive if r.get("site_type") == type_id and r["id"] not in used]
    if not pool:
        # サイト種別で絞れない場合は業種を問わず新着から選ぶ（初回など）
        pool = [r for r in archive if r["id"] not in used] or archive
    if not pool:
        return {"id": "", "title": "(参照サイト未取得。先に archive:fetch を実行)", "url": "",
                "detail_url": "", "gallery": "", "industry": "", "qualification": {}}

    candidates = pool[:]
    random.shuffle(candidates)
    rejected = []
    for r in candidates[:max_probe]:
        q = qualify(r.get("url", ""))
        if q["ok"]:
            out = {k: r.get(k, "") for k in
                   ("id", "title", "url", "detail_url", "gallery", "gallery_industry", "industry")}
            out["qualification"] = q
            out["rejected_candidates"] = rejected
            return out
        rejected.append({"id": r.get("id"), "url": r.get("url"), "reason": q["reason"]})

    # 全部落ちた場合は先頭を返しつつ、適格でないことを明示する
    r = candidates[0]
    out = {k: r.get(k, "") for k in
           ("id", "title", "url", "detail_url", "gallery", "gallery_industry", "industry")}
    out["qualification"] = {"ok": False, "reason": f"{max_probe}件を検査したが適格な参照が無かった"}
    out["rejected_candidates"] = rejected
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true",
                    help="選定結果の表示のみ。ディレクトリも state も作らない")
    ap.add_argument("--type", help="サイト種別を明示指定（ローテを使わない）")
    ap.add_argument("--industry", help="業種を明示指定（ローテを使わない）")
    ap.add_argument("--models", default=None,
                    help="実装案の識別子 CSV（既定 .env の WEB_DESIGNER_MODELS / 'a,b'）")
    args = ap.parse_args()

    state = json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {"history": []}
    history = state.get("history", [])
    recent = [h["site_type"] for h in history]
    recent_industries = [{"site_type": h["site_type"], "industry": h.get("industry", "")}
                          for h in history[-RECENT_INDUSTRY_EXCLUDE:]]
    used_refs = {h.get("reference_id", "") for h in history}

    archive = load_archive()
    weights = compute_weights(archive)
    stype = BY_ID[args.type] if args.type else pick_type(archive, recent)
    own_industry = own_industry_counts()

    industry_id = args.industry
    industry_weights: dict[str, float] = {}
    industry_skipped: dict[str, int] = {}
    industry_fallback = False
    if industry_id is None and stype["id"] == "corporate":
        # 2026-09 から corporate のみ業種を従軸にする（他種別は rotation=False で
        # 観察専用なので、参照プールが薄くて偏る）。
        industry_id, industry_weights, industry_skipped = pick_industry(
            archive, stype["id"], recent_industries, own_industry,
        )

    ref = pick_reference(stype["id"], archive, used_refs, industry_id)
    if ref.get("_retry_without_industry"):
        # 業種条件で候補が枯れた → 業種条件を落として再走
        industry_fallback = True
        ref = pick_reference(stype["id"], archive, used_refs, industry_id,
                             industry_fallback=True)

    import os
    models = [m.strip() for m in
              (args.models or os.environ.get("WEB_DESIGNER_MODELS", "a,b")).split(",") if m.strip()]

    now = datetime.now(ZoneInfo("Asia/Tokyo"))
    stamp = now.strftime("%Y%m%d-%H%M")
    run_id = f"{stype['id']}-{stamp}"
    run_dir = RUNS / run_id

    selection_method = (
        "deficit = target_share - own_share; "
        f"target = {UNIFORM_BLEND}*uniform + {1 - UNIFORM_BLEND}*gallery_occupancy; "
        f"argmax excluding last {RECENT_TYPE_EXCLUDE} types"
    )
    if industry_id is not None and not industry_fallback:
        selection_method += (
            f"; industry axis: deficit = uniform - own_share "
            f"(min_refs={MIN_INDUSTRY_REFS}, recent_exclude={RECENT_INDUSTRY_EXCLUDE})"
        )
    elif industry_fallback:
        selection_method += (
            f"; industry axis dropped (pool exhausted), "
            f"weights_recorded_only=true"
        )

    payload = {
        "run_id": run_id,
        "site_type": stype["id"],
        "site_type_label": stype["label"],
        "industry": industry_id or "",
        "industry_label": (INDUSTRY_BY_ID.get(industry_id, {}).get("label")
                            if industry_id else ""),
        "stamp": stamp,
        "tone_hint": stype["tone"],
        "required_pages": stype["required_pages"],
        "recommended_pages": stype["recommended_pages"],
        "selection": {
            "method": selection_method,
            "weights": weights,
            "industry_weights": industry_weights,
            "industry_skipped": industry_skipped,
            "industry_fallback": industry_fallback,
            "recent_types": recent[-RECENT_TYPE_EXCLUDE:],
            "recent_industries": recent_industries,
            "forced": bool(args.type or args.industry),
        },
        "models": models,
        "reference": ref,
        "paths": {
            "repo": str(ROOT),
            "run_dir": str(run_dir.relative_to(ROOT)),
            "shared_public": f"public/sites/{stype['id']}/_shared/{stamp}",
            "sites": {m: f"src/pages/sites/{stype['id']}/{m}-{stamp}/" for m in models},
            "routes": {m: f"/sites/{stype['id']}/{m}-{stamp}/" for m in models},
            "pipeline_doc": "docs/learning-pipeline.md",
        },
        "urls": {"preview_base": preview_base(), "report_base": report_base()},
        "workflow": [
            "Look: 参照サイトを実際に開き、トップ+下層2ページをキャプチャして構造を言語化する",
            "Direction: direction.html に IA(サイトマップ)・各ページの構成・トーン・コンポーネント選定を確定",
            "Fix: 2案を paths.sites に実装。_site.ts を必ず置き、`industry` も書く（全ページ SiteLayout を使う）",
            "npm run check:web",
            "bash scripts/web-design-score.sh <run_dir> <site_type> <stamp> <models...>",
            "Extract: 両案から再利用ブロックを src/components/ に切り出す（arch-component-reuse が消えるまで）",
            "npm run check:web:strict && npm run check:catalog",
        ],
        "started_at": now.isoformat(timespec="seconds"),
    }

    if args.dry_run:
        payload["dry_run"] = True
    else:
        run_dir.mkdir(parents=True, exist_ok=True)
        (run_dir / "meta").mkdir(exist_ok=True)
        (run_dir / "job.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        history.append({
            "run_id": run_id, "site_type": stype["id"],
            "industry": industry_id or "",
            "reference_id": ref.get("id", ""), "reference_title": ref.get("title", ""),
            "weight": weights.get(stype["id"], 0.0),
            "industry_weight": industry_weights.get(industry_id, 0.0) if industry_id else 0.0,
            "at": payload["started_at"],
        })
        state["history"] = history
        STATE.parent.mkdir(parents=True, exist_ok=True)
        STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
