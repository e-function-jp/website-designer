#!/usr/bin/env python3
"""Print preview/report URLs for sample routes using .env (no hardcoded hosts).

Usage:
  python3 scripts/web-preview-urls.py
  python3 scripts/web-preview-urls.py --routes /sites/corporate/base-20260903-1400/ /sites/corporate/a-20260903-1400/
  python3 scripts/web-preview-urls.py --report food-oneshot-report.html --json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from env_config import preview_base, public_urls, report_base, repo_root  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--routes",
        nargs="*",
        default=[],
        help="Path routes under preview (e.g. /sites/corporate/a-20260903-1400/)",
    )
    ap.add_argument(
        "--report",
        default="",
        help="Report filename under vision-bench http root (port REPORT)",
    )
    ap.add_argument("--json", action="store_true")
    ap.add_argument(
        "--discover",
        dest="discover",
        action="store_true",
        help="Auto-add every /sites/{type}/{model}-{stamp}/ route found under src/pages/sites/ or dist/sites/",
    )
    args = ap.parse_args()

    root = repo_root()
    routes = list(args.routes)

    if args.discover:
        samples = root / "src/pages/sites"
        if samples.is_dir():
            for index in sorted(samples.glob("*/*/index.astro")):
                cat = index.parent.parent.name
                slug = index.parent.name
                routes.append(f"/sites/{cat}/{slug}/")
        dist_samples = root / "dist/sites"
        if dist_samples.is_dir():
            for cat in sorted(dist_samples.iterdir()):
                if not cat.is_dir():
                    continue
                for d in sorted(cat.iterdir()):
                    if d.is_dir() and (d / "index.html").exists():
                        r = f"/sites/{cat.name}/{d.name}/"
                        if r not in routes:
                            routes.append(r)

    pb = preview_base()
    rb = report_base()
    page_urls = []
    for r in routes:
        if not r.startswith("/"):
            r = "/" + r
        if not r.endswith("/"):
            r = r + "/"
        page_urls.append(f"{pb}{r}")

    report_url = f"{rb}/{args.report}" if args.report else ""

    payload = {
        **public_urls(),
        "routes": routes,
        "page_urls": page_urls,
        "report_url": report_url,
        "repo": str(root),
    }

    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return

    print(f"preview_base: {pb}")
    print(f"report_base:  {rb}")
    for u in page_urls:
        print(f"page: {u}")
    if report_url:
        print(f"report: {report_url}")


if __name__ == "__main__":
    main()
