#!/usr/bin/env python3
"""dist/ を本番配信向けに後処理する。

やること
--------
開発中のホスト（localhost / 127.0.0.1 / プライベート IP / Tailscale MagicDNS）を
指す絶対 URL が成果物に混ざっていたら、相対パスへ書き換える。
プレビュー用の URL がそのまま本番に出ると、本番でリンクが死ぬ。

**本番ドメイン（astro.config.mjs の `site`）を指す絶対 URL は書き換えない。**
canonical / og:url / sitemap は絶対 URL でなければ意味がないため。
lp-designer 版は対象を all-samples-report.html 1枚に決め打ちしていたが、
website は多ページなので dist 配下の HTML を全件走査する。

呼び出し元: scripts/release-deploy.sh
Usage:
  python3 scripts/web-postprocess-deploy.py [dist_dir]
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

# 開発時にしか出てこないホスト。ここに一致する絶対 URL だけを相対化する。
DEV_HOST = re.compile(
    r"""^(
        localhost |
        127\.0\.0\.1 |
        0\.0\.0\.0 |
        10\.\d+\.\d+\.\d+ |
        192\.168\.\d+\.\d+ |
        172\.(1[6-9]|2\d|3[01])\.\d+\.\d+ |
        100\.\d+\.\d+\.\d+ |          # Tailscale CGNAT
        [\w-]+\.ts\.net
    )(:\d+)?$""",
    re.VERBOSE | re.IGNORECASE,
)

URL_ATTR = re.compile(
    r"""(href|src|action|content)=(['"])(https?://)([^/"']+)([^"']*)\2""",
    re.IGNORECASE,
)


def relativize(html: str) -> tuple[str, int]:
    count = 0

    def sub(m: re.Match[str]) -> str:
        nonlocal count
        attr, quote, _scheme, host, path = m.groups()
        if not DEV_HOST.match(host):
            return m.group(0)
        count += 1
        return f"{attr}={quote}.{path or '/'}{quote}"

    return URL_ATTR.sub(sub, html), count


def main() -> int:
    dist = Path(sys.argv[1] if len(sys.argv) > 1 else "dist")
    if not dist.is_dir():
        print(f"[error] {dist} is not a directory", file=sys.stderr)
        return 1

    files = sorted(dist.rglob("*.html"))
    changed = total = 0
    for f in files:
        try:
            original = f.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        rewritten, n = relativize(original)
        if n:
            f.write_text(rewritten, encoding="utf-8")
            changed += 1
            total += n
            print(f"[rewritten] {f.relative_to(dist)} ({n} 件)")

    print(f"[postprocess] HTML {len(files)} 件を走査 / {changed} ファイル・{total} 件の開発用URLを相対化")
    return 0


if __name__ == "__main__":
    sys.exit(main())
