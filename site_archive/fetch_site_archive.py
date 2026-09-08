#!/usr/bin/env python3
"""website ギャラリーからの参照サイト収集。

lp-designer の `lp_archive/fetch_lp_archive.py`（rdlp.jp スクレイプ）に相当する。
rdlp.jp は LP 専用のギャラリーなので website には使えず、収集元ごと差し替えている。

## なぜタクソノミ巡回なのか

当初は新着一覧を取り、タイトルと URL のキーワードでサイト種別を推測していた。
結果は **190 件中 98 件（52%）が 'other'**。ギャラリーの掲載タイトルは
ブランド名だけのことが多く、推測では届かない。

muuuuu.org は自前で `category/sitetype/`（16種）と `category/industry/`（34種）の
タクソノミを持つ。掲載側が人手で付けた分類なので、推測より正確で安定している。
そこで **アーカイブページを巡回**し、そこに載っているという事実をもって分類する。

サイト種別・業種とも同じやり方で取る。当初は業種を各アイテムの詳細ページ URL
（`/industry/{slug}/{id}.html`）から拾おうとしたが、**パーマリンクは industry とは
限らない**（`/color/white/{id}.html` のこともある）。実測で 981 件中 173 件が
これで取れず 'other' に落ちたため、業種も archive 巡回に統一した。

日本市場向けサイトを作るのが目的なので、`overseas-site` アーカイブを
除外集合として別途取得し、海外サイトは候補から外す。

## 出力

    site_archive/site_archive_{YYYYMMDD}.csv       … その日のスナップショット
    site_archive/site_archive_diff_{YYYYMMDD}.csv … 前回からの新規分
    site_archive/site_archive_latest.csv           … 最新スナップショットのコピー
    site_archive/categories.json                   … 分類の分布スナップショット

## 使い方

    python3 site_archive/fetch_site_archive.py                  # ローテ対象のみ・1ページ
    python3 site_archive/fetch_site_archive.py --pages 3        # 各 sitetype 3ページ
    python3 site_archive/fetch_site_archive.py --all-types      # 観察カテゴリも含める
    python3 site_archive/fetch_site_archive.py --keep-overseas  # 海外サイトも残す
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
from site_categories import (  # noqa: E402
    EXCLUDE_GALLERY_SITETYPES,
    INDUSTRIES,
    SITE_TYPES,
    classify_site_type,
    classify_site_type_by_gallery,
    gallery_sitetype_slugs,
)

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")
BASE = "https://muuuuu.org"

FIELDS = ["id", "title", "url", "detail_url", "gallery", "gallery_sitetypes",
          "gallery_industry", "site_type", "industry", "overseas", "thumb", "fetched_at"]

# 一覧アイテムの構造（sitetype アーカイブでも新着一覧でも同じ）。
# 注意: class 属性のあとに属性が続く（アーカイブ側は data-post-id /
# data-page-number / data-page-start が付く）。`">` で閉じ決め打ちにすると
# 新着一覧では通ってアーカイブでは 0 件になる（実測で踏んだ）。
# 属性の有無・順序に依存しないこと。
ITEM_RE = re.compile(r'<li class="c-post-list__item[^"]*"[^>]*>(.*?)</li>', re.S)
LINK_RE = re.compile(r'<a\s+href="([^"]+)"\s+class="c-post-list__link"[^>]*data-post-id="(\d+)"', re.S)
IMG_RE = re.compile(r'<img[^>]+src="([^"]+)"[^>]*class="c-post-list__image[^"]*"[^>]*alt="([^"]*)"', re.S)
DETAIL_RE = re.compile(r'href="(https://muuuuu\.org/industry/([a-z0-9\-]+)/(\d+)\.html)"')


def fetch(url: str, retries: int = 3) -> str | None:
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode("utf-8", errors="replace")
        except (urllib.error.URLError, TimeoutError) as e:  # noqa: PERF203
            last = e
            time.sleep(1.5 * (i + 1))
    print(f"  WARN: 取得失敗 {url} ({last})", file=sys.stderr)
    return None


def parse_items(html: str) -> list[dict]:
    """一覧 HTML からアイテムを抜く。"""
    out = []
    for block in ITEM_RE.findall(html):
        link = LINK_RE.search(block)
        if not link:
            continue
        img = IMG_RE.search(block)
        detail = DETAIL_RE.search(block)
        out.append({
            "id": f"muuuuu-{link.group(2)}",
            "title": (img.group(2).strip() if img else "") or link.group(1),
            "url": link.group(1),
            "detail_url": detail.group(1) if detail else "",
            "gallery_industry": detail.group(2) if detail else "",
            "thumb": img.group(1) if img else "",
            "gallery": "muuuuu",
        })
    return out


def crawl_taxonomy(kind: str, slug: str, pages: int) -> list[dict]:
    """`/category/{kind}/{slug}` を pages ページ分たどる。

    末尾スラッシュを付けると 301 になるので付けない（実測）。
    """
    found = []
    for n in range(1, pages + 1):
        url = f"{BASE}/category/{kind}/{slug}" if n == 1 else f"{BASE}/category/{kind}/{slug}/page/{n}"
        html = fetch(url)
        if html is None:
            break
        items = parse_items(html)
        if not items:
            if n == 1:
                print(f"  WARN: {url} から1件も取れなかった。セレクタ変更の可能性", file=sys.stderr)
            break
        found.extend(items)
        time.sleep(1.0)   # ギャラリー側への負荷を避ける
    return found


def crawl_industries(pages: int) -> dict[str, list[str]]:
    """{post_id: [industry スラッグ]} を返す。

    業種軸は参照サイトを揃えるのに使うだけで品質ルールには効かないが、
    サイト種別と同じくギャラリーの分類を正とする。
    """
    out: dict[str, list[str]] = {}
    for cat in INDUSTRIES:
        slug = cat["id"]
        print(f"  industry/{slug}")
        for it in crawl_taxonomy("industry", slug, pages):
            out.setdefault(it["id"], []).append(slug)
    return out


def collect(pages: int, all_types: bool, keep_overseas: bool) -> tuple[dict[str, dict], set[str]]:
    """{post_id: entry} と海外サイトの id 集合を返す。"""
    by_id: dict[str, dict] = {}
    slugs = gallery_sitetype_slugs(rotation_only=not all_types)

    for slug in slugs:
        print(f"  sitetype/{slug}")
        for it in crawl_taxonomy("sitetype", slug, pages):
            e = by_id.setdefault(it["id"], {**it, "gallery_sitetypes": []})
            if slug not in e["gallery_sitetypes"]:
                e["gallery_sitetypes"].append(slug)

    overseas: set[str] = set()
    if not keep_overseas:
        for slug in EXCLUDE_GALLERY_SITETYPES:
            print(f"  sitetype/{slug}（除外集合）")
            overseas |= {it["id"] for it in crawl_taxonomy("sitetype", slug, pages)}

    return by_id, overseas


def enrich(by_id: dict[str, dict], overseas: set[str],
           industry_map: dict[str, list[str]], fetched_at: str) -> list[dict]:
    industry_ids = {c["id"] for c in INDUSTRIES}
    order = [c["id"] for c in INDUSTRIES]
    out = []
    for e in by_id.values():
        # archive 巡回で得た所属を優先し、無ければ詳細URL由来のスラッグを使う
        tags = industry_map.get(e["id"], [])
        if tags:
            e["gallery_industry"] = ",".join(sorted(tags, key=order.index))
            e["industry"] = sorted(tags, key=order.index)[0]
        else:
            gi = e.get("gallery_industry", "")
            e["industry"] = gi if gi in industry_ids else "other"
        # 掲載側の分類を正とし、取れないときだけキーワード推測にフォールバックする
        e["site_type"] = (classify_site_type_by_gallery(e["gallery_sitetypes"])
                          or classify_site_type(e["title"], e["url"]))
        e["overseas"] = "1" if e["id"] in overseas else ""
        e["gallery_sitetypes"] = ",".join(e["gallery_sitetypes"])
        e["fetched_at"] = fetched_at
        out.append(e)
    return sorted(out, key=lambda x: x["id"])


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
    ap.add_argument("--pages", type=int, default=1, help="各タクソノミで何ページ分たどるか")
    ap.add_argument("--all-types", action="store_true", help="観察カテゴリ(rotation=False)も収集する")
    ap.add_argument("--keep-overseas", action="store_true", help="海外サイトを除外しない")
    ap.add_argument("--industry-pages", type=int, default=None,
                    help="業種アーカイブを何ページ分たどるか（既定 --pages と同じ。0 で業種収集を省略）")
    args = ap.parse_args()

    ARCHIVE.mkdir(exist_ok=True)
    today = datetime.date.today().strftime("%Y%m%d")
    fetched_at = datetime.datetime.now().astimezone().isoformat(timespec="seconds")

    print(f"muuuuu.org の sitetype タクソノミを巡回（各 {args.pages} ページ）")
    by_id, overseas = collect(args.pages, args.all_types, args.keep_overseas)
    if not by_id:
        print("1件も取得できなかった。中止する。", file=sys.stderr)
        return 1

    ind_pages = args.pages if args.industry_pages is None else args.industry_pages
    industry_map: dict[str, list[str]] = {}
    if ind_pages > 0:
        print(f"\nindustry タクソノミを巡回（{len(INDUSTRIES)} 種 × 各 {ind_pages} ページ）")
        industry_map = crawl_industries(ind_pages)

    entries = enrich(by_id, overseas, industry_map, fetched_at)
    kept = [e for e in entries if not e["overseas"]]
    if not args.keep_overseas:
        print(f"\n海外サイト {len(entries) - len(kept)} 件を除外")
        entries = kept

    snapshot = ARCHIVE / f"site_archive_{today}.csv"
    write_csv(snapshot, entries)

    prev_ids = {r["id"] for r in read_csv(ARCHIVE / "site_archive_latest.csv")}
    new = [e for e in entries if e["id"] not in prev_ids]
    if prev_ids:
        write_csv(ARCHIVE / f"site_archive_diff_{today}.csv", new)
    write_csv(ARCHIVE / "site_archive_latest.csv", entries)

    def tally(key: str) -> dict[str, int]:
        c: dict[str, int] = {}
        for e in entries:
            c[e[key]] = c.get(e[key], 0) + 1
        return dict(sorted(c.items(), key=lambda kv: -kv[1]))

    st, ind = tally("site_type"), tally("industry")
    (ARCHIVE / "categories.json").write_text(json.dumps({
        "fetched_at": fetched_at,
        "source": "muuuuu",
        "method": "sitetype taxonomy crawl",
        "total": len(entries),
        "site_type": st,
        "industry": ind,
        "site_type_labels": {c["id"]: c["label"] for c in SITE_TYPES},
        "industry_labels": {c["id"]: c["label"] for c in INDUSTRIES},
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    unclassified = st.get("other", 0)
    print(f"\n{len(entries)} 件を取得（新規 {len(new)} 件）")
    print(f"  {snapshot.relative_to(ROOT)}")
    print(f"  サイト種別: {st}")
    print(f"  未分類(サイト種別): {unclassified} 件 ({unclassified / len(entries) * 100:.0f}%)")
    no_ind = ind.get("other", 0)
    print(f"  未分類(業種): {no_ind} 件 ({no_ind / len(entries) * 100:.0f}%)")
    print(f"  業種 上位: {dict(list(ind.items())[:6])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
