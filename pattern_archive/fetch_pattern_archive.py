#!/usr/bin/env python3
"""部分パターンのギャラリーから実例を収集する。

site_archive との違い
---------------------
`site_archive/` は **サイト全体** の参照（muuuuu.org）で、学習ランの
ローテ対象になる。こちらは **部分パターン**（CTA / ナビ / モバイル）で、
ローテには使わない。Direction 段が「部品カタログ」として引く。

同じテーブルに混ぜるとサイト種別のローテが歪むので、別に置く。

収集元と、本プロジェクトのどの弱点に効くか
------------------------------------------
| 収集元 | パターン | 効く先 |
|---|---|---|
| cta.gallery | CTA の文言と配置 | 独立judge が繰り返し指摘する「CTA文言と遷移先の不一致」 |
| navbar.gallery | グローバルナビ | IA定義の中核。「事業内容が読めない空ラベル」問題 |
| loadmo.re | モバイル表現 | 規約でモバイルファースト必須なのに参照観測が無い |

出力
----
    pattern_archive/patterns_{YYYYMMDD}.csv
    pattern_archive/patterns_latest.csv
    pattern_archive/summary.json   … Direction が読む要約

使い方
------
    python3 pattern_archive/fetch_pattern_archive.py
    python3 pattern_archive/fetch_pattern_archive.py --source cta
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
ARCHIVE = ROOT / "pattern_archive"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

FIELDS = ["id", "pattern", "source", "title", "site_url", "detail_url",
          "credits", "tags", "media", "fetched_at"]


def fetch(url: str, retries: int = 3) -> str | None:
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode("utf-8", errors="replace")
        except (urllib.error.URLError, TimeoutError) as e:  # noqa: PERF203
            if i == retries - 1:
                print(f"  WARN: 取得失敗 {url} ({e})", file=sys.stderr)
            time.sleep(1.5 * (i + 1))
    return None


# --- loadmo.re（モバイル） -------------------------------------------------
# <div class="post"><a href="{detail}"><div class="post-item">
#   <div class="post-poster" style="background-image: url({img})">
#     <video><source src="{mp4}">
# <div class="post-meta"><p class="post-sitename">{name}</p>
#                        <p class="post-credits">by {credits}</p>
POST_RE = re.compile(
    r'<div class="post">\s*<a href="([^"]+)">([\s\S]*?)</a>\s*'
    r'<div class="post-meta">([\s\S]*?)</div>', re.S)


def parse_loadmore(html: str) -> list[dict]:
    out = []
    for m in POST_RE.finditer(html):
        detail, body, meta = m.group(1), m.group(2), m.group(3)
        name = (re.search(r'class="post-sitename">([^<]*)<', meta) or [None, ""])[1].strip()
        cred = (re.search(r'class="post-credits">([^<]*)<', meta) or [None, ""])[1].strip()
        img = (re.search(r'background-image:\s*url\(([^)]+)\)', body) or [None, ""])[1].strip()
        vid = (re.search(r'<source src="([^"]+)"', body) or [None, ""])[1].strip()
        slug = detail.rstrip("/").split("/")[-1]
        out.append({
            "id": f"loadmore-{slug}", "pattern": "mobile", "source": "loadmo.re",
            "title": name, "site_url": "", "detail_url": detail,
            "credits": re.sub(r"^by\s+", "", cred),
            "tags": "", "media": vid or img,
        })
    return out


# --- navbar.gallery（ナビ） -------------------------------------------------
# Webflow。<div class="work_item w-dyn-item"> の中に
#   <a aria-label="Visit Website" href="{site}">  と work_title
NAV_ITEM_RE = re.compile(r'<div[^>]*class="work_item[^"]*"[\s\S]*?(?=<div[^>]*class="work_item|\Z)')
NAV_SITE_RE = re.compile(r'aria-label="Visit Website"\s+href="([^"]+)"')
NAV_TITLE_RE = re.compile(r'class="work_title[^"]*"[^>]*>([^<]*)<')


def parse_navbar(html: str) -> list[dict]:
    out, seen = [], set()
    for blk in NAV_ITEM_RE.findall(html):
        site = (NAV_SITE_RE.search(blk) or [None, ""])[1]
        if not site or site in seen:
            continue
        seen.add(site)
        title = (NAV_TITLE_RE.search(blk) or [None, ""])[1].strip()
        host = re.sub(r"^https?://(www\.)?", "", site).rstrip("/").split("/")[0]
        out.append({
            "id": f"navbar-{host}", "pattern": "navbar", "source": "navbar.gallery",
            "title": title or host, "site_url": site, "detail_url": "",
            "credits": "", "tags": "", "media": "",
        })
    return out


# --- cta.gallery（CTA） -----------------------------------------------------
# Framer 製でクラス名が難読。掲載サイトへの外部リンクを拾い、
# ギャラリー自身・CDN・SNS を除外する。
CTA_EXCLUDE = re.compile(
    r"(framer|cta\.gallery|x\.com|twitter|linkedin|instagram|facebook|youtube|"
    r"gtm|google|gstatic|fonts|vercel|webflow|substack)", re.I)


def parse_cta(html: str) -> list[dict]:
    out, seen = [], set()
    for m in re.finditer(r'href="(https?://[^"]+)"', html):
        url = m.group(1)
        if CTA_EXCLUDE.search(url):
            continue
        host = re.sub(r"^https?://(www\.)?", "", url).rstrip("/").split("/")[0]
        if not host or host in seen:
            continue
        seen.add(host)
        out.append({
            "id": f"cta-{host}", "pattern": "cta", "source": "cta.gallery",
            "title": host, "site_url": url, "detail_url": "",
            "credits": "", "tags": "", "media": "",
        })
    return out


SOURCES = {
    "loadmore": ("https://loadmo.re/", parse_loadmore),
    "navbar": ("https://navbar.gallery/", parse_navbar),
    # cta.gallery は https://cta.gallery/ が 308 を返す（urllib は 308 を追従しない）。
    # 正規URLの www 付きを直接指定する。
    "cta": ("https://www.cta.gallery/", parse_cta),
}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", choices=sorted(SOURCES), help="1つだけ収集する")
    args = ap.parse_args()

    ARCHIVE.mkdir(exist_ok=True)
    fetched_at = datetime.datetime.now().astimezone().isoformat(timespec="seconds")
    names = [args.source] if args.source else list(SOURCES)

    rows: list[dict] = []
    for name in names:
        url, parser = SOURCES[name]
        print(f"  {name}: {url}")
        html = fetch(url)
        if html is None:
            continue
        items = parser(html)
        if not items:
            print(f"  WARN: {name} から1件も取れなかった。セレクタ変更の可能性", file=sys.stderr)
        for it in items:
            it["fetched_at"] = fetched_at
        rows.extend(items)
        time.sleep(1.0)

    if not rows:
        print("1件も取得できなかった。中止する。", file=sys.stderr)
        return 1

    today = datetime.date.today().strftime("%Y%m%d")
    for path in (ARCHIVE / f"patterns_{today}.csv", ARCHIVE / "patterns_latest.csv"):
        with path.open("w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=FIELDS)
            w.writeheader()
            for r in rows:
                w.writerow({k: r.get(k, "") for k in FIELDS})

    by_pattern: dict[str, list[dict]] = {}
    for r in rows:
        by_pattern.setdefault(r["pattern"], []).append(r)

    (ARCHIVE / "summary.json").write_text(json.dumps({
        "fetched_at": fetched_at,
        "counts": {k: len(v) for k, v in by_pattern.items()},
        "note": "Direction 段が部品カタログとして参照する。ローテ対象ではない。",
        "samples": {
            k: [{"title": x["title"], "url": x["site_url"] or x["detail_url"]} for x in v[:12]]
            for k, v in by_pattern.items()
        },
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n{len(rows)} 件を取得")
    for k, v in by_pattern.items():
        print(f"  {k}: {len(v)} 件")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
