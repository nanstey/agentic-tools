"""Static migration checks, not proof of agent execution or runtime uninstallation."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import unittest

from test_unified_review_contract import ROOT, SOURCE_CHECKS


def parse_method_rows(text: str) -> list[tuple[str, str]]:
    return re.findall(r"^\|\s*`([^`]+)`\s*\|\s*\[[^\]]+\]\(([^)]+)\)\s*\|$", text, re.M)


def resolve_principle_trigger(trigger: str, principles: list[dict]) -> str:
    matches = [item["id"] for item in principles
               if trigger == item["id"] or trigger in item.get("aliases", [])]
    if len(matches) != 1:
        raise ValueError(f"unregistered or ambiguous principle trigger: {trigger}")
    return matches[0]


@unittest.skipUnless(SOURCE_CHECKS, "source-dependent checks disabled")
class RefactorEncapsulationTests(unittest.TestCase):
    quality = ROOT / "skills/code-quality"
    refactor = quality / "refactor"
    dataset = refactor / "references"
    absorbed = ("sniff", "fresh-air", "extract", "dry", "srp", "principles", "deep-review", "ponytail")
    principle_order = (
        "make-it-work", "yagni", "principle-of-least-surprise", "kiss",
        "liskov-substitution", "separation-of-concerns", "single-responsibility",
        "interface-segregation", "dependency-inversion", "be-consistent",
        "composition-over-inheritance", "dry", "open-closed",
        "design-patterns-if-necessary", "agile-practices", "boy-scout-rule", "make-it-fast",
    )
    # Fixed pre-migration 6153780 values; no dependency on the caller's mutable HEAD.
    index_hashes = {
        "smells/index.json": "97755556ed54b10a0b4a3200e48ba96046d45977736d01083cd830e99adee505",
        "techniques/index.json": "036316bfd6cc2b77aa308955268050527438f7af6e23a6bd57e2db5d7903221e",
        "technique-map/smell-to-technique.json": "5f486587d40c229ea6697108f11739f1dc4e86726d90584129148e4d199fed56",
    }
    detail_hashes = {
        "smells": (23, "1735b9251d79470e8e5f192d5ca4d391d7b27e44d0f6710307c6db7810816ea4"),
        "techniques": (66, "43dbb938168496e502a0b14948a10c26529aa66e12df39fc1304afe22b4fd9f9"),
    }

    def test_only_refactor_entrypoint_and_no_specialist_discovery(self) -> None:
        for name in self.absorbed:
            self.assertFalse((self.quality / name).exists(), name)
        self.assertEqual([self.refactor / "SKILL.md"], list(self.refactor.rglob("SKILL.md")))
        for name in ("principles", "smells", "technique-map", "techniques"):
            self.assertFalse((self.refactor / name).exists(), name)
            self.assertTrue((self.dataset / name).is_dir(), name)
        names = []
        for path in (ROOT / "skills").rglob("SKILL.md"):
            names.extend(re.findall(r"^name: (.+)$", path.read_text().split("---", 2)[1], re.M))
        self.assertFalse(set(names) & set(self.absorbed))
        self.assertEqual(1, names.count("refactor"))
        self.assertEqual(1, names.count("risk-review"))
        for name in self.absorbed:
            rel = {"ponytail": "simplify.md", "sniff": "smells.md", "fresh-air": "smells.md",
                   "deep-review": "simplify.md", "dry": "extract.md", "srp": "extract.md"}.get(name, f"{name}.md")
            text = (self.refactor / "references" / rel).read_text()
            self.assertTrue(text.startswith("# "), rel)
            self.assertNotRegex(text, r"(?m)^(name|user-invocable|disable-model-invocation):")

    def test_catalog_removes_eight_rows_and_matches_router_description(self) -> None:
        catalog = (ROOT / "README.md").read_text()
        for name in self.absorbed:
            self.assertNotIn(f"| [`{name}`]", catalog)
            self.assertNotIn(f"skills/code-quality/{name}/", catalog)
        skill = (self.refactor / "SKILL.md").read_text()
        description = re.search(r"^description: (.+)$", skill, re.M).group(1)
        self.assertIn(f"| [`refactor`](skills/code-quality/refactor/SKILL.md) | {description} |", catalog)
        for term in ("code smells", "duplication (DRY)", "responsibilities (SRP)", "design principles",
                     "structural maintainability", "over-engineering", "deep review", "simplification",
                     "extraction", "refactor planning", "technique selection"): 
            self.assertIn(term, description)
        self.assertIn("| [`risk-review`]", catalog)
        self.assertIn("DietrichGebert/ponytail", catalog)
        self.assertIn("skills/code-quality/refactor/references/simplify.LICENSE", catalog)

    def test_local_method_and_risk_review_links_resolve(self) -> None:
        paths = [*self.refactor.rglob("*.md"), self.quality / "risk-review/SKILL.md",
                 self.quality / "risk-review/references/checks.md",
                 ROOT / "skills/workflow/idea-to-pr/SKILL.md"]
        for path in paths:
            text = re.sub(r"```.*?```", "", path.read_text(), flags=re.S)
            text = re.sub(r"`[^`]*`", "", text)  # Ignore code-quoted examples.
            for target in re.findall(r"(?<!!)\[[^\]]*\]\(([^)]+)\)", text):
                if re.match(r"[a-z]+:", target) or target.startswith("#"):
                    continue
                with self.subTest(path=path, target=target):
                    self.assertTrue((path.parent / target.split("#")[0]).is_file())
        checks = (self.quality / "risk-review/references/checks.md").read_text()
        for target in ("simplify.md#structural-review", "extract.md#dry-procedure",
                       "extract.md#srp-procedure", "principles.md"):
            self.assertIn(f"../../refactor/references/{target}", checks)
        for path in (ROOT / "skills").rglob("*.md"):
            for name in self.absorbed:
                self.assertNotIn(f"{name}/SKILL.md", path.read_text(), str(path))

    def test_dataset_bytes_counts_and_ids_preserved(self) -> None:
        for rel, expected in self.index_hashes.items():
            self.assertEqual(expected, hashlib.sha256((self.dataset / rel).read_bytes()).hexdigest(), rel)
        for directory, (count, expected) in self.detail_hashes.items():
            root = self.dataset / directory
            paths = sorted(root.rglob("*.md"))
            self.assertEqual(count, len(paths), directory)
            digest = hashlib.sha256()
            for path in paths:
                digest.update(str(path.relative_to(root)).encode() + b"\0" + path.read_bytes())
            self.assertEqual(expected, digest.hexdigest(), directory)

    def test_principle_records_order_and_card_prose_preserved(self) -> None:
        index = json.loads((self.dataset / "principles/index.json").read_text())
        records = [{key: value for key, value in item.items() if key not in ("path", "category_id", "priority_level")}
                   for item in sorted(index["principles"], key=lambda item: item["id"])]
        # Original retained metadata, excluding approved rank/path/group changes and clean-code references.
        self.assertEqual("777cfec8b2802c1a3c0d5deca2da49926add9d173c803ef742de3f31231fb16f",
                         hashlib.sha256(json.dumps(records, sort_keys=True, separators=(",", ":")).encode()).hexdigest())
        digest = hashlib.sha256()
        for item in sorted(index["principles"], key=lambda item: item["id"]):
            card = (self.dataset / "principles" / item["path"]).read_bytes()
            start, frontmatter, body = card.split(b"---", 2)
            normalized = start + b"---" + re.sub(rb"(?m)^(?:category(?:_id)?|priority_level):[^\n]*\n", b"", frontmatter) + b"---" + body
            digest.update(item["id"].encode() + b"\0" + normalized)
        self.assertEqual("23c7296c76cffab9111bb0c88a7894372d76a97a7bf4c24e09bf52c3286b5c8c", digest.hexdigest())

    def test_principle_priority_groups_paths_and_frontmatter_agree(self) -> None:
        root = self.dataset / "principles"
        index = json.loads((root / "index.json").read_text())
        groups = ["1-high", "2-med", "3-low"]
        ranges = [("High", range(1, 5)), ("Medium", range(5, 14)), ("Low", range(14, 18))]
        self.assertEqual(self.principle_order, tuple(item["id"] for item in index["principles"]))
        self.assertEqual(list(range(1, 18)), [item["priority_level"] for item in index["principles"]])
        self.assertNotIn("clean-code", json.dumps(index))
        self.assertEqual(groups, [item["id"] for item in index["categories"]])
        self.assertEqual(set(groups), {path.name for path in root.iterdir() if path.is_dir()})
        self.assertEqual(17, len(index["principles"]))
        self.assertEqual(17, len({item["id"] for item in index["principles"]}))
        paths = {root / item["path"] for item in index["principles"]}
        self.assertEqual(17, len(paths))
        self.assertEqual(paths, set(root.rglob("*.md")))
        for group, (name, levels) in zip(index["categories"], ranges):
            self.assertEqual(name, group["name"])
            members = [item for item in index["principles"] if item["priority_level"] in levels]
            self.assertTrue(members)
            self.assertEqual([{key: item[key] for key in ("id", "name", "path")} for item in members], group["principles"])
            for item in members:
                self.assertEqual(group["id"], item["category_id"])
                self.assertEqual(f'{group["id"]}/{item["priority_level"]:02d}-{item["id"]}.md', item["path"])
                card = (root / item["path"]).read_text()
                fields = dict(line.split(": ", 1) for line in card.split("---", 2)[1].strip().splitlines())
                self.assertEqual(item["id"], fields["id"])
                self.assertEqual(str(item["priority_level"]), fields["priority_level"])
                self.assertEqual(group["id"], fields["category_id"])
                self.assertEqual(group["name"], fields["category"])

    def test_index_paths_related_ids_and_graph_endpoints_resolve(self) -> None:
        def load(rel: str) -> dict:
            return json.loads((self.dataset / rel).read_text())

        def walk_paths(value, parent: Path) -> None:
            if isinstance(value, dict):
                for key, item in value.items():
                    if key == "path":
                        self.assertTrue((parent / item).is_file(), item)
                    else:
                        walk_paths(item, parent)
            elif isinstance(value, list):
                for item in value:
                    walk_paths(item, parent)

        for rel in (*self.index_hashes, "principles/index.json"):
            walk_paths(load(rel), (self.dataset / rel).parent)
        smells = load("smells/index.json")["smells"]
        techniques = load("techniques/index.json")
        principles = load("principles/index.json")["principles"]
        graph = load("technique-map/smell-to-technique.json")
        smell_ids = {item["id"] for item in smells}
        technique_ids = {item["id"] for item in techniques["techniques"]}
        family_ids = {item["id"] for item in techniques["families"]}
        principle_ids = {item["id"] for item in principles}
        self.assertEqual((23, 66, 17, 6, 139), (len(smell_ids), len(technique_ids), len(principle_ids), len(family_ids), len(graph["edges"])))
        for smell in smells:
            self.assertLessEqual(set(smell["related_refactorings"]), technique_ids)
            self.assertLessEqual(set(smell["related_smells"]), smell_ids)
        for technique in techniques["techniques"]:
            self.assertIn(technique["family_id"], family_ids)
            self.assertTrue((self.dataset / "techniques" / technique["family_id"] / f'{technique["id"]}.md').is_file())
        for family in techniques["families"]:
            self.assertLessEqual(set(family["technique_ids"]), technique_ids)
        self.assertEqual(technique_ids, {item["id"] for item in graph["techniques"]})
        self.assertEqual(family_ids, {item["id"] for item in graph["families"]})
        for edge in graph["edges"]:
            self.assertIn(edge["from"], technique_ids | family_ids | smell_ids)
            self.assertIn(edge["to"], technique_ids | family_ids | smell_ids)
        priorities = [item["priority_level"] for item in principles]
        self.assertEqual(sorted(priorities), priorities)
        for principle in principles:
            self.assertLessEqual(set(principle["related_principles"]), principle_ids)

    def test_public_goals_replace_manual_and_depth_selectors(self) -> None:
        text = (self.refactor / "SKILL.md").read_text()
        self.assertEqual('[simplify|extract|principles|smells] [scope] [--report]',
                         re.search(r'^argument-hint: "([^"]+)"$', text, re.M).group(1))
        rows = re.findall(r"^   \| `([^`]+)` \|", text, re.M)
        self.assertEqual(["simplify", "extract", "principles", "smells"], rows)
        self.assertIn("Bare `/refactor` exhaustively reviews all four goals", text)
        self.assertIn("applies supported behavior-preserving fixes within scope", text)
        self.assertNotIn("Bare `/refactor` requests selection only", text)
        method = (self.refactor / "references/simplify.md").read_text()
        self.assertIn("Do not force a lite-first gate", method)
        self.assertIn("A failing cut is reverted", method)
        self.assertIn("There is no public depth selector", method)
        for mode in ("full", "ultra", "audit"):
            self.assertNotIn(f"refactor simplify {mode}", method)
        audit = method.split("## Repository audit\n", 1)[1].split("\n## ", 1)[0]
        self.assertIn("grants no authority and does not force report mode", audit)

    def test_extraction_and_internal_plan_preserve_detail_and_mode(self) -> None:
        extract = (self.refactor / "references/extract.md").read_text()
        for needle in ("[DRY procedure](#dry-procedure)", "[SRP procedure](#srp-procedure)", "`same file`", "`other file`", "`new file`",
                       "Location (current path, existing target path, or proposed new path)",
                       "code type, role, runtime, domain", "execution context", "Source edits and follow-on implementation are forbidden in report mode"): 
            self.assertIn(needle, extract)
        plan = (self.refactor / "references/smells.md").read_text().split("## Plan\n", 1)[1].split("\n## ", 1)[0]
        for needle in ("Select techniques", "fully validated", "confidence", "unresolved findings",
                       "primary/fallback", "not a public command", "never target source or follow-on implementation",
                       "without another approval cycle", "stable recognized finding IDs", "without requiring a smell ID",
                       "only when requested and permitted"):
            self.assertIn(needle, plan)
        reference = (self.refactor / "REFERENCE.md").read_text()
        validation = reference.split("## Validation and fast path\n", 1)[1].split("\n## ", 1)[0]
        self.assertIn("Only smell-ID findings may use technique selection", validation)
        self.assertIn("do not require an invented smell ID", validation)
        self.assertIn("Every index `path` value resolves against the directory containing that index", reference)
        self.assertIn("not runnable commands", reference)
        self.assertNotIn("\ncp ", reference)

    def test_principles_maps_existing_ids_to_single_procedure_owners(self) -> None:
        path = self.refactor / "references/principles.md"
        text = path.read_text()
        mapping = text.split("## Method mapping\n", 1)[1].split("\n## ", 1)[0]
        self.assertRegex(mapping, r"(?m)^\|\s*Check trigger\s*\|")
        rows = parse_method_rows(mapping)
        self.assertEqual([("dry", "extract.md#dry-procedure"), ("srp", "extract.md#srp-procedure")], rows)
        index = json.loads((self.dataset / "principles/index.json").read_text())
        principles = {item["id"]: item for item in index["principles"]}
        self.assertEqual(17, len(principles))
        procedures = set()
        resolved = [(resolve_principle_trigger(trigger, index["principles"]), target) for trigger, target in rows]
        self.assertEqual([("dry", "extract.md#dry-procedure"), ("single-responsibility", "extract.md#srp-procedure")], resolved)
        for principle_id, target in resolved:
            self.assertIn(principle_id, principles)
            file_part, anchor = target.split("#")
            owner = (path.parent / file_part).resolve()
            self.assertTrue(owner.is_file())
            self.assertNotEqual(owner, (self.dataset / "principles" / principles[principle_id]["path"]).resolve())
            heading = anchor.replace("dry", "DRY").replace("srp", "SRP").replace("-", " ")
            workflow = owner.read_text().split(f"## {heading}\n", 1)[1].split("\n## ", 1)[0]
            steps = re.findall(r"^\d+\. (.+)$", workflow, re.M)
            self.assertGreaterEqual(len(steps), 4)  # Preserve focused method depth.
            for step in steps[1:]:
                self.assertNotIn(step, text)  # Delegate rather than copy the procedure.
            procedures.add(owner)
        self.assertEqual(1, len(procedures))  # both procedures live in extract.md
        self.assertIn("always assess the full `principles[]` list", text)
        self.assertIn("[default precedence rule](../REFERENCE.md#default-precedence)", text)
        details = text.split("3. Details\n", 1)[1]
        self.assertIn("Reference stable finding IDs", details)
        self.assertIn("without counting new findings", details)

    def test_mapping_padding_and_declared_aliases_resolve_without_ambiguity(self) -> None:
        rows = [("dry", "extract.md#dry-procedure"), ("srp", "extract.md#srp-procedure")]
        for padding in ("", " ", "        ", "\t"):
            table = "\n".join(f"|{padding}`{trigger}`{padding}|{padding}[method]({target}){padding}|"
                              for trigger, target in rows)
            self.assertEqual(rows, parse_method_rows(table))
        index = json.loads((self.dataset / "principles/index.json").read_text())
        self.assertEqual("dry", resolve_principle_trigger("dry", index["principles"]))
        self.assertEqual("single-responsibility", resolve_principle_trigger("srp", index["principles"]))
        self.assertEqual("single-responsibility", resolve_principle_trigger("single-responsibility", index["principles"]))
        with self.assertRaises(ValueError):
            resolve_principle_trigger("unregistered", index["principles"])
        conflicting = [*index["principles"], {"id": "other", "aliases": ["srp"]}]
        with self.assertRaises(ValueError):
            resolve_principle_trigger("srp", conflicting)
        with self.assertRaises(ValueError):
            resolve_principle_trigger("dry", [{"id": "dry"}, {"id": "other", "aliases": ["dry"]}])

    def test_all_overlapping_consumers_share_one_finding_reuse_rule(self) -> None:
        owner = self.refactor / "REFERENCE.md"
        consumers = [self.refactor / "references" / f"{name}.md"
                     for name in ("principles", "extract")]
        consumers.append(self.quality / "risk-review/references/checks.md")
        for path in consumers:
            targets = re.findall(r"\[[^\]]+\]\(([^)]+)#finding-reuse\)", path.read_text())
            self.assertEqual(1, len(targets), str(path))
            self.assertEqual(owner.resolve(), (path.parent / targets[0]).resolve())
        owners = [path for path in self.quality.rglob("*.md")
                  if "## Finding reuse\n" in path.read_text()]
        self.assertEqual([owner], owners)
        rule = owner.read_text().split("## Finding reuse\n", 1)[1].split("\n## ", 1)[0]
        for condition in ("one stable finding ID for one underlying issue", "all material findings",
                          "Do not merge independent issues", "scope, source identity, and check coverage match",
                          "reevaluate affected coverage", "Do not start a broader independent scan",
                          "Do not invent source facts"):
            self.assertIn(condition, rule)
        self.assertIn("method, reviewed units, and pass depth", rule)
        self.assertIn("diff base/head and working-tree content identity", rule)

    def test_quality_summary_is_unranked_and_precedence_is_bounded(self) -> None:
        summary_path = self.refactor / "references/principles.md"
        summary = summary_path.read_text().split("## Quality summary\n", 1)[1]
        self.assertNotRegex(summary, r"(?m)^(id|category|category_id|priority_level):")
        self.assertIn("Reuse the completed 17-principle review and its stable finding IDs", summary)
        self.assertIn("Do not propose changes merely for aesthetics", summary)
        self.assertIn("Do not add a ranked status or another report section", summary)
        self.assertIn("Robert C. Martin, *Clean Code*", summary)
        self.assertIn("9780136083238", summary)
        for path in (self.refactor / "REFERENCE.md", self.refactor / "references/principles.md"):
            targets = re.findall(r"\[[^\]]+\]\(([^)]*#quality-summary)\)", path.read_text())
            self.assertTrue(targets)
            for target in targets:
                self.assertEqual(summary_path.resolve(), (path.parent / target.split("#")[0]).resolve() if target.split("#")[0] else path.resolve())
        reference = (self.refactor / "REFERENCE.md").read_text()
        precedence = reference.split("### Default precedence\n", 1)[1].split("\n## ", 1)[0]
        for guard in ("never overrides correctness, security, compatibility, or explicit product requirements",
                      "concrete evidence and guardrails", "including requests from higher-numbered principles",
                      "False coupling is not worth deduplication", "does not justify speculative abstractions"):
            self.assertIn(guard, precedence)
        method = (self.refactor / "references/principles.md").read_text()
        self.assertIn("Lower numbers win design trade-offs by default", method)
        self.assertIn("request from a higher-numbered principle", method)
        self.assertNotIn("lower-ranked", method)
        self.assertIn("Add one short unranked", method.split("1. Scope\n", 1)[1].split("2. Report\n", 1)[0])
        for path in (self.dataset / "principles").rglob("*.md"):
            self.assertNotIn("clean-code", path.read_text(), str(path))

    def test_full_mit_license_and_attribution_preserved(self) -> None:
        references = self.refactor / "references"
        self.assertFalse((references / "ponytail").exists())
        self.assertFalse((references / "simplify").exists())
        license_path = references / "simplify.LICENSE"
        self.assertEqual("fb1bc6909ac3ef82d5c22106e32ef682b0cff66788fa915fb9b53b15c9d2f3ab",
                         hashlib.sha256(license_path.read_bytes()).hexdigest())
        self.assertIn("DietrichGebert/ponytail", (references / "simplify.md").read_text())

    def test_actual_installer_discovery_and_temporary_links(self) -> None:
        # Use the real collector/linker only, with every destination in a disposable sandbox.
        with tempfile.TemporaryDirectory(prefix="refactor-discovery-") as temporary:
            env = dict(os.environ, HOME=temporary, REPO_ROOT=str(ROOT), DEST=str(Path(temporary) / "skills"))
            result = subprocess.run(
                ["bash", "-euc", 'source "$REPO_ROOT/install/modules/artifacts.sh"; collect_skills; '
                 'install_artifacts skills "$DEST"; install_artifacts skills "$DEST"'],
                env=env, text=True, capture_output=True, check=True,
            )
            discovered = {line.split("\t")[0] for line in result.stdout.splitlines() if "\t" in line}
            self.assertEqual({"refactor", "risk-review"}, discovered & (set(self.absorbed) | {"refactor", "risk-review"}))
            destination = Path(env["DEST"])
            for name in self.absorbed:
                self.assertFalse((destination / name).is_symlink(), name)
            for name in ("refactor", "risk-review"):
                self.assertEqual(self.quality / name, (destination / name).resolve())
            self.assertIn("ok", result.stdout)


if __name__ == "__main__":
    unittest.main()
