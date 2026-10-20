"""Static wording/structure assertions for the approved public surface, not a parser or agent replay.

These checks inspect authored instructions and immutable corpus bytes. They do not
exercise flag rejection or runtime enforcement, and cannot prove that an agent honors
permissions, completes exhaustive coverage, or fixes code.
"""

from __future__ import annotations

import hashlib
from pathlib import Path
import re
import unittest

from test_unified_review_contract import ROOT, SOURCE_CHECKS


@unittest.skipUnless(SOURCE_CHECKS, "source-dependent checks disabled")
class RefactorSurfaceTests(unittest.TestCase):
    refactor = ROOT / "skills/code-quality/refactor"

    def text(self, relative: str = "SKILL.md") -> str:
        return (self.refactor / relative).read_text()

    def test_bare_requires_exhaustive_coverage_and_supported_fixes(self) -> None:
        text = self.text()
        for requirement in (
            "Bare `/refactor` exhaustively reviews all four goals",
            "applies supported behavior-preserving fixes within scope",
            "not a menu, diff-only review, shallow smell scan",
            "never load every card or treat techniques as compulsory transformations",
            "all 17 in rank order",
            "applicable families, catalog evidence",
            "the single [DRY]",
            "needless code, complexity, indirection",
            "Unexamined files, categories, or checks mean incomplete coverage",
            "never claim exhaustive completion",
        ):
            self.assertIn(requirement, text)
        self.assertIn("all applicable families for bare exhaustive and selected smells reviews",
                      self.text("references/smells.md"))
        self.assertIn("Include it in bare exhaustive review and simplification",
                      self.text("references/simplify.md"))

    def test_default_scope_is_maintained_repository_not_diff(self) -> None:
        text = self.text()
        for requirement in (
            "Explicit scope comes first", "repository guidance and exclusions",
            "maintained source, tests, and configuration",
            "exclude generated, vendor, dependency, and build output",
            "manifests, tracked paths, and ownership/layout conventions",
            "A bare review never silently becomes the current branch diff",
            "coverage ledger across chunks",
        ):
            self.assertIn(requirement, text)
        for relative in ("references/simplify.md",):
            self.assertNotIn("no diff: say", self.text(relative))
        self.assertIn("honor repository exclusions".lower(),
                      self.text("references/simplify.md").lower())

    def test_four_goals_narrow_primary_methods_and_preserve_placement(self) -> None:
        text = self.text()
        table = text.split("   | Goal |", 1)[1].split("\n\n", 1)[0]
        rows = dict(re.findall(r"^   \| `([^`]+)` \| (.*) \|$", table, re.M))
        expected = {
            "simplify": ("needless code, complexity, indirection", "structural review"),
            "extract": ("single [DRY]", "[SRP]", "`same file`", "`other file`", "`new file`"),
            "principles": ("all 17 in rank order", "bounded precedence"),
            "smells": ("applicable families", "catalog evidence", "suitable techniques"),
        }
        self.assertEqual(set(expected), set(rows))
        for goal, requirements in expected.items():
            for requirement in requirements:
                self.assertIn(requirement, rows[goal])
        self.assertIn("do not run every method for every route", text)
        self.assertIn("neither is a public command or approval gate", text)

    def test_report_preserves_coverage_with_bare_and_selected_argument_orders(self) -> None:
        text = self.text()
        self.assertIn("`--report` keeps that coverage", text)
        self.assertIn("it changes mutation permission, not coverage", text)
        self.assertIn("`--report` may appear before or after goal/scope", text)
        self.assertIn("never edit target source or invoke follow-on implementation", text)
        self.assertIn("Artifacts require caller permission", text)
        context = self.text("REFERENCE.md").split("## Execution context\n", 1)[1].split("\n## ", 1)[0]
        self.assertIn("In report mode, all implementation imperatives are proposals only", context)
        self.assertIn("No method may invoke an implementation step or promote itself to fix mode", context)
        self.assertIn("authorizes justified fixes without another approval cycle", text)

    def test_unknown_flags_and_legacy_selectors_cannot_fall_through(self) -> None:
        text = self.text()
        rejection = text.split("Unknown options and old selectors", 1)[1].split("\n", 1)[0]
        for selector in ("inspect", "plan", "dry", "srp", "deep-review", "lite", "full", "ultra", "audit"):
            self.assertIn(f"`{selector}`", rejection)
        self.assertIn("including depth tokens after `simplify`", rejection)
        self.assertIn("also stop with a concise correction", rejection)
        self.assertIn("before analysis or edits", text)
        self.assertIn("fall through into bare exhaustive auto-fix", text)
        self.assertIn("`./plan`", rejection)
        self.assertNotRegex(text, r"(?m)^   \| `(?:inspect|plan|dry|srp|deep-review|audit)` \|")

    def test_argument_grammar_rejects_unsafe_nonflag_fallbacks(self) -> None:
        text = self.text()
        grammar = text.split("1. **Resolve arguments and authority before work.**", 1)[1].split("2. **Resolve full scope", 1)[0]
        for requirement in (
            "Remove `--report` wherever it appears",
            "at most one goal",
            "before one optional scope",
            "existing explicit path(s)",
            "nonempty matching glob(s)",
            "expressly recognized diff/PR scope",
            "a second goal, a goal after scope, invalid/unmatched scope",
            "any unrecognized token",
            "fall through into bare exhaustive auto-fix",
            "before analysis or edits",
            "These declarative rules guide interpretation; they are not an executable argument parser",
        ):
            self.assertIn(requirement, grammar)
        for invocation in ("/refactor smell", "/refactor simplfy", "/refactor simplify extract",
                           "/refactor src extract", "/refactor nonexistent"):
            self.assertIn(f"`{invocation}`", grammar)
        self.assertIn("`./plan`", grammar)
        for invocation in ("/refactor` is bare", "/refactor simplify src", "--report` may appear before or after goal/scope"):
            self.assertIn(invocation, grammar)

    def test_all_methods_inherit_mode_scope_and_caller_authority(self) -> None:
        methods = [f"references/{name}.md" for name in
                   ("smells", "extract", "principles")]
        methods += ["references/simplify.md"]
        for relative in methods:
            with self.subTest(method=relative):
                path = self.refactor / relative
                text = path.read_text()
                self.assertIn("[execution context](../REFERENCE.md#execution-context)", text)
                self.assertIn("authority", text)
                targets = re.findall(r"\[[^\]]+\]\(([^)]+)#execution-context\)", text)
                self.assertEqual(1, len(targets))
                self.assertEqual(self.refactor / "REFERENCE.md", (path.parent / targets[0]).resolve())
                for obsolete in ("This method only reads and reports", "Entry level is always **lite**",
                                 "Use only when explicitly selected", "This route is planning only",
                                 "Lists findings, applies nothing", "stop for explicit user review"):
                    self.assertNotIn(obsolete, text)
        context = self.text("REFERENCE.md")
        for requirement in ("resolved scope/exclusions", "immutable source identity", "coverage/depth",
                            "existing findings", "caller constraints"):
            self.assertIn(requirement, context)

    def test_external_review_callers_do_not_inherit_direct_invocation_writes(self) -> None:
        text = self.text()
        for requirement in (
            "A slash invocation or explicit request to review and fix",
            "Loading, quoting, discussion, or review-only requests do not",
            "External callers retain stricter permissions",
            "root mode cannot expand them",
        ):
            self.assertIn(requirement, text)
        callers = (
            ROOT / "skills/code-quality/risk-review/SKILL.md",
            ROOT / "skills/code-quality/risk-review/references/checks.md",
            ROOT / "skills/workflow/review-code/SKILL.md",
        )
        for caller in callers:
            with self.subTest(caller=caller):
                body = caller.read_text()
                self.assertIn("`mode: report`", body)
                self.assertIn("SOURCE REVIEW MODE", body)
                self.assertIn("existing findings", body)
        context = self.text("REFERENCE.md")
        self.assertIn("the root default cannot expand those permissions", context)
        self.assertIn("forbid tests/builds and artifact writes", context)
        self.assertIn("Missing mutation authority means report mode", context)
        checks = callers[1].read_text()
        self.assertIn("Do not invoke bare `/refactor` as a substitute for selected checks", checks)

    def test_exception_validation_and_user_change_boundaries(self) -> None:
        text = self.text()
        for requirement in (
            "Fix findings supported by evidence", "Preserve intentional exceptions",
            "avoid compulsory aesthetic cleanup", "correctness, security, compatibility, and product requirements",
            "Meaningful API, behavior, or dependency changes", "unsafe or ambiguous fixes",
            "secrets, and shared-system effects need explicit authority",
            "Leave them unresolved with evidence rather than guessing",
            "Baseline and run permitted focused checks", "behavior-preserving reversible changes",
            "record pre-existing failures", "Revert only your own failing changes",
            "preserve user edits/tests", "invalidate affected evidence",
            "Never infer permission to commit, push, approve, post comments, install, or mutate remotes",
        ):
            self.assertIn(requirement, text)
        self.assertIn("A failing cut is reverted", self.text("references/simplify.md"))
        self.assertIn("Never delete requirements because they have no observed caller",
                      self.text("references/simplify.md"))

    def test_all_110_protected_paths_and_bytes_are_immutable(self) -> None:
        # Fixed from the approved pre-surface snapshot, independent of /tmp and mutable HEAD.
        references = self.refactor / "references"
        paths = [path for directory in ("principles", "smells", "technique-map", "techniques")
                 for path in (references / directory).rglob("*") if path.is_file()]
        self.assertFalse((references / "ponytail").exists())
        self.assertFalse((references / "simplify").exists())
        self.assertEqual(110, len(paths))
        manifest = {path.relative_to(ROOT).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
                    for path in paths}
        digest = hashlib.sha256("".join(f"{path}\0{manifest[path]}\n" for path in sorted(manifest)).encode()).hexdigest()
        self.assertEqual("b47aacd09a4d05a3c504621b26b612610e64ae47815422bedf9a27c67e4be24e", digest)

    def test_user_padded_mapping_table_is_byte_preserved(self) -> None:
        mapping = self.text("references/principles.md").split("## Method mapping\n", 1)[1].split("\n## ", 1)[0]
        table = "\n".join(line for line in mapping.splitlines() if line.startswith("|")) + "\n"
        self.assertEqual("b53d6d400fa0b29f50dbd31c62944015ea4eb53885e6c24bcbb649469e6608cc",
                         hashlib.sha256(table.encode()).hexdigest())
        self.assertIn("`srp`", table)


if __name__ == "__main__":
    unittest.main()
