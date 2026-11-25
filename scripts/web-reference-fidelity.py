#!/usr/bin/env python3
"""Validate opt-in reference fidelity handoffs; never judges pixels or publishes."""
import argparse
import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse


class GateError(ValueError):
    pass


def need(test, message):
    if not test:
        raise GateError(message)


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def valid_url(url):
    u = urlparse(url)
    return u.scheme in ("http", "https") and bool(u.hostname) and not u.username


def artwork(root, value):
    relative = Path(value["path"])
    path = (root / relative).resolve()
    need(not relative.is_absolute() and path.is_relative_to(root.resolve()),
         "evidence path must stay inside run directory")
    need(path.is_file() and path.stat().st_size > 0, f"missing evidence: {relative}")
    need(sha(path) == value["sha256"], f"evidence hash mismatch: {relative}")
    return path


class Direction(HTMLParser):
    def __init__(self):
        super().__init__()
        self.present = {}

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "data-fidelity-id" in a:
            key = a["data-fidelity-id"]
            need(key not in self.present, f"duplicate Direction id: {key}")
            self.present[key] = a.get("data-fidelity-decision", "")


def check(run, phase):
    path = run / "reference-fidelity.json"
    if not path.exists():
        if (run / "job.json").exists():
            need(load(run / "job.json").get("reference_fidelity") is not True,
                 "job requires reference-fidelity.json")
        return False
    c = load(path)
    need(c["schema"] == 1, "unsupported fidelity contract schema")
    need(isinstance(c["pages"], dict) and "/" in c["pages"] and len(c["pages"]) >= 3,
         "contract requires TOP and at least two distinct lower pages")
    if (run / "job.json").exists():
        ref = load(run / "job.json")["reference"]["url"]
        need(c["pages"]["/"].rstrip("/") == ref.rstrip("/"),
             "TOP reference differs from job reference")
    need(all(p.startswith("/") and p.endswith("/") and valid_url(url)
             for p, url in c["pages"].items()), "invalid page or reference URL")
    need(len(set(c["pages"].values())) == len(c["pages"]), "duplicate reference URLs")
    items = {}
    coverage = set()
    for item in c["criteria"]:
        key = item["id"]
        need(isinstance(key, str) and re.fullmatch(r"[a-z][a-z0-9-]+", key)
             and key not in items, f"invalid or duplicate criterion id: {key}")
        need(item["page"] in c["pages"], f"{key}: page is not mapped")
        for field in ("observation", "intent", "acceptance"):
            need(isinstance(item[field], str) and item[field].strip(),
                 f"{key}: missing {field}")
        need(item["decision"] in ("preserve", "adapt", "omit"),
             f"{key}: invalid decision")
        if item["decision"] != "preserve":
            need(isinstance(item.get("rationale"), str) and item["rationale"].strip(),
                 f"{key}: changed or omitted observations need a reason")
        need(item["kind"] in ("layout", "copy", "imagery", "interaction"),
             f"{key}: invalid kind")
        states = item["states"]
        need(isinstance(states, list) and states and len(states) == len(set(states))
             and set(states) <= {"initial", "scroll", "hover", "focus", "toggle", "filter", "reduced-motion"},
             f"{key}: invalid or missing states")
        if item["kind"] == "interaction":
            need(bool(set(states) - {"initial"}),
                 f"{key}: interaction needs a state beyond initial")
        coverage.add(item["page"])
        items[key] = item
    need(set(c["pages"]) == coverage, "every mapped page needs criteria")
    if phase == "contract":
        return True
    direction_file = run / "direction-a.html"
    parser = Direction()
    parser.feed(direction_file.read_text(encoding="utf-8"))
    need(parser.present == {key: item["decision"] for key, item in items.items()},
         "Direction must carry every fidelity id and exact decision, once")
    if phase == "direction":
        return True

    review = load(run / "reference-fidelity-review.json")
    need(review["contract_sha256"] == sha(path) and review["direction_sha256"] == sha(direction_file),
         "review is stale for current contract or Direction")
    need(all(isinstance(review[k], str) and review[k].strip()
             for k in ("implementer", "reviewer", "sample_build")),
         "missing reviewer, implementer, or sample-build identifier")
    need(review["reviewer"].strip().casefold() != review["implementer"].strip().casefold(),
         "self-review is not independent")
    sample_pages = review["sample_pages"]
    need(set(sample_pages) == set(c["pages"])
         and len(set(sample_pages.values())) == len(sample_pages)
         and all(valid_url(url) for url in sample_pages.values()),
         "sample must map each page to one distinct URL")
    results = {}
    for row in review["results"]:
        key = row["id"]
        need(key in items and key not in results, f"unknown or duplicate result: {key}")
        results[key] = row
        item = items[key]
        need(row["status"] == "pass", f"{key}: {row['status']}; not ready")
        need(isinstance(row["finding"], str) and row["finding"].strip(),
             f"{key}: no reviewer finding")
        pairs = set()
        for pair in row["pairs"]:
            k = (pair["viewport"], pair["state"])
            need(k not in pairs, f"{key}: duplicate evidence pair {k}")
            pairs.add(k)
            need(pair["reference_url"] == c["pages"][item["page"]]
                 and pair["sample_url"] == sample_pages[item["page"]]
                 and pair["sample_url"] != pair["reference_url"],
                 f"{key}: wrong reference or sample URL")
            ref_art = artwork(run, pair["reference"])
            sample_art = artwork(run, pair["sample"])
            need(ref_art != sample_art and pair["reference"]["sha256"] != pair["sample"]["sha256"],
                 f"{key}: reference and sample evidence are identical")
        required = {(device, state) for device in ("desktop", "mobile")
                    for state in item["states"] if not (state == "hover" and device == "mobile")}
        need(pairs == required, f"{key}: missing or unexpected viewport/state evidence {required ^ pairs}")
    need(set(results) == set(items), "one or more fidelity criteria were not reviewed")
    return True


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("run", type=Path)
    p.add_argument("phase", choices=("contract", "direction", "review"))
    a = p.parse_args()
    try:
        required = check(a.run, a.phase)
    except (ValueError, OSError, KeyError, TypeError, AttributeError) as e:
        p.exit(1, f"reference fidelity {a.phase}: {e}\n")
    if required:
        print(f"reference fidelity {a.phase}: structure checked; visual judgement is manual")


if __name__ == "__main__":
    main()
