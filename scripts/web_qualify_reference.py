"""参照サイトが website（多ページサイト）として適格かを判定する。

背景
----
ラン1回目で `hitorigocochi.com` が corporate の参照に選ばれたが、実際には
`<nav>` を持たない1ページ構成のサイトだった（実測: navLinks 0件 / section 1件）。
多ページサイトの情報設計を学ぶのに1ページの参照は使えない。

ギャラリーは「サイトのデザイン」で掲載しており、ページ数では絞れない。
そこで選定時に**実際にトップを取得してナビのリンク数を数える**。
ブラウザは使わない（数百件を回すには重すぎる）。国内のコーポレートサイトは
ほぼサーバーレンダリングなので、HTML の取得で十分に判定できる。
JS でナビを描くサイトは判定不能として落ちるが、それは許容する
（参照候補は他にいくらでもある）。
"""
from __future__ import annotations

import re
import urllib.error
import urllib.parse
import urllib.request

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

NAV_RE = re.compile(r'<nav\b[^>]*>(.*?)</nav>', re.S | re.I)
# ヘッダー内のリンクも拾う。<nav> を使わずヘッダー直下に並べるサイトが一定数ある。
HEADER_RE = re.compile(r'<header\b[^>]*>(.*?)</header>', re.S | re.I)
HREF_RE = re.compile(r'<a\b[^>]*\bhref=["\']([^"\']+)["\']', re.I)

# 多ページとみなす最小の内部ページ数（トップを除く）
MIN_INTERNAL_PAGES = 3


def _fetch(url: str, timeout: int = 15) -> str | None:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read(600_000)  # 先頭だけで足りる
        for enc in ("utf-8", "cp932", "euc-jp"):
            try:
                return raw.decode(enc)
            except UnicodeDecodeError:
                continue
        return raw.decode("utf-8", errors="replace")
    except (urllib.error.URLError, TimeoutError, ValueError, OSError):
        return None


def qualify(url: str) -> dict:
    """{ok, internal_pages, paths, reason} を返す。"""
    html = _fetch(url)
    if html is None:
        return {"ok": False, "internal_pages": 0, "paths": [], "reason": "取得失敗"}

    blocks = NAV_RE.findall(html) + HEADER_RE.findall(html)
    if not blocks:
        # nav も header も無い＝1ページ構成の可能性が高いが、
        # 念のためページ全体のリンクで判定する
        blocks = [html]

    base = urllib.parse.urlparse(url)
    paths: set[str] = set()
    for b in blocks:
        for href in HREF_RE.findall(b):
            if href.startswith(("mailto:", "tel:", "javascript:", "#")):
                continue
            u = urllib.parse.urlparse(urllib.parse.urljoin(url, href))
            if u.netloc and u.netloc != base.netloc:
                continue
            p = u.path.rstrip("/")
            if not p or p == base.path.rstrip("/"):
                continue
            # 画像・PDF 等はページではない
            if re.search(r"\.(jpe?g|png|gif|svg|webp|pdf|zip|mp4)$", p, re.I):
                continue
            paths.add(p)

    n = len(paths)
    ok = n >= MIN_INTERNAL_PAGES
    return {
        "ok": ok,
        "internal_pages": n,
        "paths": sorted(paths)[:12],
        "reason": "" if ok else f"内部ページが {n} 件（下限 {MIN_INTERNAL_PAGES}）。1ページ構成の可能性",
    }
