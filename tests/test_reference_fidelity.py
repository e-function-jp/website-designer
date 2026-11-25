import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "fidelity", Path(__file__).parents[1] / "scripts/web-reference-fidelity.py"
)
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


class FidelityTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.run = Path(self.tmp.name)
        self.pages = {p: "https://reference.example" + p for p in ("/", "/about/", "/projects/")}
        self.sample = {p: "https://sample.example/site" + p for p in self.pages}
        self.contract = {
            "schema": 1, "pages": self.pages,
            "criteria": [
                {"id": key, "page": p, "observation": "observed", "intent": "why",
                 "acceptance": "compare the effect", "decision": "preserve", "kind": kind,
                 "states": states}
                for key, p, kind, states in (
                    ("top-motion", "/", "interaction", ["initial", "scroll", "reduced-motion"]),
                    ("about-links", "/about/", "imagery", ["initial"]),
                    ("work-filter", "/projects/", "interaction", ["filter", "hover"]),
                )
            ]
        }
        self.cp = self.run / "reference-fidelity.json"
        self.rp = self.run / "reference-fidelity-review.json"
        self.dp = self.run / "direction-a.html"

    def write(self, path, data):
        path.write_text(json.dumps(data), encoding="utf-8")

    def fixtures(self):
        self.write(self.cp, self.contract)
        self.dp.write_text("\n".join(
            f'<p data-fidelity-id="{i["id"]}" data-fidelity-decision="{i["decision"]}">design</p>'
            for i in self.contract["criteria"]), encoding="utf-8")
        for stem in ("ref", "sample"):
            (self.run / f"{stem}.png").write_bytes(stem.encode())
        def artifact(stem):
            return {"path": f"{stem}.png", "sha256": hashlib.sha256(stem.encode()).hexdigest()}
        self.review = {
            "contract_sha256": gate.sha(self.cp), "direction_sha256": gate.sha(self.dp),
            "implementer": "builder", "reviewer": "separate reviewer", "sample_build": "staged-build",
            "sample_pages": self.sample,
            "results": [
                {"id": i["id"], "status": "pass", "finding": "compared manually",
                 "pairs": [
                     {"viewport": v, "state": s, "reference_url": self.pages[i["page"]],
                      "sample_url": self.sample[i["page"]],
                      "reference": artifact("ref"), "sample": artifact("sample")}
                     for v in ("desktop", "mobile") for s in i["states"]
                     if (v, s) != ("mobile", "hover")
                 ]}
                for i in self.contract["criteria"]
            ]
        }
        self.write(self.rp, self.review)

    def test_legacy_and_missing_required_contract(self):
        self.assertFalse(gate.check(self.run, "review"))
        self.write(self.run / "job.json", {"reference_fidelity": True})
        with self.assertRaisesRegex(gate.GateError, "job requires"):
            gate.check(self.run, "contract")

    def test_complete_pair_contract(self):
        self.fixtures()
        for phase in ("contract", "direction", "review"):
            self.assertTrue(gate.check(self.run, phase))

    def test_dropped_direction_decision(self):
        self.fixtures()
        self.dp.write_text('<p data-fidelity-id="top-motion">', encoding="utf-8")
        with self.assertRaisesRegex(gate.GateError, "exact decision"):
            gate.check(self.run, "direction")

    def test_omission_without_reason(self):
        self.contract["criteria"][0]["decision"] = "omit"
        self.fixtures()
        with self.assertRaisesRegex(gate.GateError, "need a reason"):
            gate.check(self.run, "contract")

    def test_missing_interaction_pair_and_wrong_page(self):
        self.fixtures()
        pairs = self.review["results"][2]["pairs"]
        removed = pairs.pop()
        self.write(self.rp, self.review)
        with self.assertRaisesRegex(gate.GateError, "viewport/state"):
            gate.check(self.run, "review")
        pairs.append(removed)
        pairs[0]["sample_url"] = self.sample["/"]
        self.write(self.rp, self.review)
        with self.assertRaisesRegex(gate.GateError, "wrong reference or sample"):
            gate.check(self.run, "review")

    def test_stale_and_self_review(self):
        self.fixtures()
        self.dp.write_text(self.dp.read_text() + "\n", encoding="utf-8")
        with self.assertRaisesRegex(gate.GateError, "stale"):
            gate.check(self.run, "review")
        self.fixtures()
        self.review["reviewer"] = " BUILDER "
        self.write(self.rp, self.review)
        with self.assertRaisesRegex(gate.GateError, "not independent"):
            gate.check(self.run, "review")

    def test_altered_artifact(self):
        self.fixtures()
        (self.run / "sample.png").write_bytes(b"changed")
        with self.assertRaisesRegex(gate.GateError, "hash mismatch"):
            gate.check(self.run, "review")

    def test_unverified_is_not_pass(self):
        self.fixtures()
        self.review["results"][0]["status"] = "unverified"
        self.write(self.rp, self.review)
        with self.assertRaisesRegex(gate.GateError, "not ready"):
            gate.check(self.run, "review")
