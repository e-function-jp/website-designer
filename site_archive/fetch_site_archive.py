#!/usr/bin/env python3
"""website ギャラリーからの参照サイト収集。

lp-designer の `lp_archive/fetch_lp_archive.py`（rdlp.jp スクレイプ）に相当する。
rdlp.jp は LP 専用のギャラリーなので website には使えず、収集元ごと差し替えている。

対応ギャラリー
--------------
- muuuuu … https://muuuuu.org/ 縦長・多ページのサイトを中心とした国内ギャラリー。
  詳細ページ URL に `/industry/{slug}/` という業種タクソノミを持っており、
  rdlp.jp の業種列に相当する情報がそのまま取れる。

出力
----
    site_archive/site_archive_{YYYYMMDD}.csv   … その日のスナップショット
    site_archive/site_archive_diff_{YYYYMMDD}.csv … 前回からの新規分
    site_archive/site_archive_latest.csv       … 最新スナップショットのコピー
    site_archive/categories.json               … サイト種別/業種の占有率スナップショット

使い方
------
    python3 site_archive/fetch_site_archive.py               # 1ページ目のみ
    python3 site_archive/fetch_site_archive.py --pages 5     # 5ページ分
    python3 site_archive/fetch_site_archive.py --source muuuuu
"""
from __future__ import annotations

import argparse
import csv
import datetime
import json
import pathlib
import re
import sys
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
ARCHIVE = ROOT / "site_archive"
sys.path.insert(0, str(ROOT / "scripts"))
from site_categories import classify_site_type, classify_industry, SITE_TYPES, INDUSTRIES  # noqa: E402

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")

FIELDS = ["id", "title", "url", "detail_url", "gallery", "gallery_industry",
          "site_type", "industry", "thumb", "fetched_at"]


def fetch(url: str, retries: int = 3) -> str:
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode("utf-8", errors="replace")
        except (urllib.error.URLError, TimeoutError) as e:  # noqa: PERF203
            last = e
            time.sleep(1.5 * (i + 1))
    raise RuntimeError(f"fetch failed: {url} ({last})")


# --- muuuuu.org -------------------------------------------------------------
# <li class="c-post-list__item js-post-list__item">
#   <a href="{掲載サイトURL}" class="c-post-list__link" data-post-id="{id}">
#     <img src="{サムネ}" alt="{サイト名}">
#   <a href="https://muuuuu.org/industry/{slug}/{id}.html">  ← 詳細ページ = 業種入り
ITEM_RE = re.compile(r'<li class="c-post-list__item[^"]*">(.*?)</li>', re.S)
LINK_RE = re.compile(r'<a\s+href="([^"]+)"\s+class="c-post-list__link"[^>]*data-post-id="(\d+)"', re.S)
IMG_RE = re.compile(r'<img[^>]+src="([^"]+)"[^>]*class="c-post-list__image[^"]*"[^>]*alt="([^"]*)"', re.S)
DETAIL_RE = re.compile(r'href="(https://muuuuu\.org/industry/([a-z0-9\-]+)/(\d+)\.html)"')


def parse_muuuuu(html: str) -> list[dict]:
    out = []
    for block in ITEM_RE.findall(html):
        link = LINK_RE.search(block)
        if not link:
            continue
        url, post_id = link.group(1), link.group(2)
        img = IMG_RE.search(block)
        detail = DETAIL_RE.search(block)
        title = (img.group(2).strip() if img else "") or url
        out.append({
            "id": f"muuuuu-{post_id}",
            "title": title,
            "url": url,
            "detail_url": detail.group(1) if detail else "",
            "gallery": "muuuuu",
            "gallery_industry": detail.group(2) if detail else "",
            "thumb": img.group(1) if img else "",
        })
    return out


SOURCES = {
    "muuuuu": {
        "page_url": lambda n: "https://muuuuu.org/" if n == 1 else f"https://muuuuu.org/page/{n}/",
        "parse": parse_muuuuu,
    },
}


def collect(source: str, pages: int) -> list[dict]:
    cfg = SOURCES[source]
    seen, out = set(), []
    for n in range(1, pages + 1):
        url = cfg["page_url"](n)
        print(f"  fetching {url}")
        try:
            html = fetch(url)
        except RuntimeError as e:
            print(f"  WARN: {e}", file=sys.stderr)
            break
        items = cfg["parse"](html)
        if not items:
            print(f"  WARN: {url} から1件も取れなかった。セレクタが変わった可能性がある", file=sys.stderr)
            break
        for it in items:
            if it["id"] in seen:
                continue
            seen.add(it["id"])
            out.append(it)
        time.sleep(1.0)  # ギャラリー側への負荷を避ける
    return out


def enrich(entries: list[dict], fetched_at: str) -> list[dict]:
    """サイト種別・業種を付与する。

    サイト種別はタイトル（例「JR東日本 障がい者採用」）から推定する。
    業種はギャラリー側のタクソノミを優先し、無ければタイトルから推定する。
    """
    gallery_to_industry = {
        "technology": "it", "company": "manufacturing", "building": "construction",
        "interior": "construction", "food": "food", "school": "education",
        "hospital": "medical", "finance": "professional", "shopping": "retail",
        "car": "manufacturing", "eco": "manufacturing",
    }
    for e in entries:
        e["site_type"] = classify_site_type(e["title"], e["url"])
        gi = e.get("gallery_industry", "")
        e["industry"] = gallery_to_industry.get(gi) or classify_industry(e["title"])
        e["fetched_at"] = fetched_at
    return entries


def write_csv(path: pathlib.Path, rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in FIELDS})


def read_csv(path: pathlib.Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default="muuuuu", choices=sorted(SOURCES))
    ap.add_argument("--pages", type=int, default=1)
    args = ap.parse_args()

    ARCHIVE.mkdir(exist_ok=True)
    today = datetime.date.today().strftime("%Y%m%d")
    fetched_at = datetime.datetime.now().astimezone().isoformat(timespec="seconds")

    print(f"collecting from {args.source} ({args.pages} page(s))")
    entries = enrich(collect(args.source, args.pages), fetched_at)
    if not entries:
        print("1件も取得できなかった。中止する。", file=sys.stderr)
        return 1

    snapshot = ARCHIVE / f"site_archive_{today}.csv"
    write_csv(snapshot, entries)

    prev_ids = {r["id"] for r in read_csv(ARCHIVE / "site_archive_latest.csv")}
    new = [e for e in entries if e["id"] not in prev_ids]
    if prev_ids:
        write_csv(ARCHIVE / f"site_archive_diff_{today}.csv", new)

    write_csv(ARCHIVE / "site_archive_latest.csv", entries)

    # 占有率スナップショット（ローテ選定は latest.csv から都度再計算するので、
    # これはレビュー用の記録。lp-designer の categories.json と同じ位置づけ）
    def tally(key: str) -> dict[str, int]:
        c: dict[str, int] = {}
        for e in entries:
            c[e[key]] = c.get(e[key], 0) + 1
        return dict(sorted(c.items(), key=lambda kv: -kv[1]))

    (ARCHIVE / "categories.json").write_text(json.dumps({
        "fetched_at": fetched_at,
        "source": args.source,
        "total": len(entries),
        "site_type": tally("site_type"),
        "industry": tally("industry"),
        "gallery_industry": tally("gallery_industry"),
        "site_type_labels": {c["id"]: c["label"] for c in SITE_TYPES},
        "industry_labels": {c["id"]: c["label"] for c in INDUSTRIES},
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n{len(entries)} 件を取得（新規 {len(new)} 件）")
    print(f"  {snapshot.relative_to(ROOT)}")
    print(f"  サイト種別: {tally('site_type')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
