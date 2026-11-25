#!/usr/bin/env python3
"""採点で撮るページを「参照キャプチャ ↔ 自サイトのページ」の対で決める。

固定の `/ /about/ /service/` を撮っていた頃は、参照に無いページを 404 として
減点し、実装側がその減点を消すために参照に無いページを足してしまった
（実測 2026-11-24, corporate-20261124-1613）。

対の決め方:
  1. motion/{slug}.json の url と motion/{slug}-full.jpg が揃っているものを参照ページとする
  2. direction-a.html の sitemap 表で「参照の対応ページ」がその url を指す行の URL 列を自ページにする
  3. 表に無ければ参照と同じパスを使う（再現モードはサイトマップを写すため）

出力: 1行1対、タブ区切り `ref_img<TAB>our_path<TAB>ref_path`。トップが先頭。
"""
import json
import re
import sys
from html import unescape
from pathlib import Path
from urllib.parse import urlparse


def norm(path: str) -> str:
    path = path or "/"
    if not path.startswith("/"):
        path = "/" + path
    if not path.endswith("/"):
        path += "/"
    return path


def sitemap_map(run_dir: Path) -> dict:
    """参照パス → 自サイトのパス。"""
    out = {}
    for name in ("direction-a.html", "direction-b.html"):
        p = run_dir / name
        if not p.exists():
            continue
        html = p.read_text(encoding="utf-8", errors="replace")
        m = re.search(r'<section id="sitemap">(.*?)</section>', html, re.S)
        if not m:
            continue
        for row in re.findall(r"<tr>(.*?)</tr>", m.group(1), re.S):
            cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)
            if len(cells) < 3:
                continue
            ours = unescape(re.sub(r"<[^>]+>", "", cells[0])).strip()
            href = re.search(r'href="([^"]+)"', cells[2])
            if not ours.startswith("/") or not href:
                continue
            out.setdefault(norm(urlparse(href.group(1)).path), norm(ours))
        if out:
            break
    return out


def main() -> int:
    run_dir = Path(sys.argv[1])
    motion = run_dir / "motion"
    mapping = sitemap_map(run_dir)
    pairs = []
    for js in sorted(motion.glob("*.json")):
        if js.name == "summary.json":
            continue
        img = motion / f"{js.stem}-full.jpg"
        if not img.exists():
            continue
        try:
            url = json.loads(js.read_text(encoding="utf-8")).get("url") or ""
        except json.JSONDecodeError:
            continue
        if not url:
            continue
        ref_path = norm(urlparse(url).path)
        pairs.append((img, mapping.get(ref_path, ref_path), ref_path))
    pairs.sort(key=lambda t: (t[2] != "/", t[2]))
    for img, ours, ref in pairs:
        print(f"{img}\t{ours}\t{ref}")
    return 0 if pairs else 1


if __name__ == "__main__":
    sys.exit(main())
