"""Artifact and static-contract checks for the unified-review plan.

These tests do not execute an agent, a harness permission boundary, CI, or Jev. The
fixtures are hypothetical replay inputs: a reviewer must inspect their cited source
and policy evidence. Set UNIFIED_REVIEW_SOURCE_CHECKS=0 to validate only the
self-contained fixture artifacts while concurrent source changes are incomplete.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import unittest


TEST_DIR = Path(__file__).resolve().parent
PLAN_DIR = TEST_DIR.parent
ROOT = PLAN_DIR.parents[1]
FIXTURES = TEST_DIR / "fixtures.json"
SOURCE_CHECKS = os.environ.get("UNIFIED_REVIEW_SOURCE_CHECKS", "1") != "0"


class FixtureArtifactTests(unittest.TestCase):
    """Keep replay evidence useful without pretending it is an executable engine."""

    required_cases = {
        "small-shared-permission-default",
        "large-proven-isolated",
        "external-dynamic-unknown",
        "contradictory-containment",
        "multiple-domains",
        "uncertain-baseline",
        "expensive-verified-request",
        "unchanged-existing-nonblocking",
        "optional-nit-nonblocking",
        "new-exposure-existing-mechanism",
        "untrusted-policy-in-pr",
        "unavailable-or-malformed-jev",
        "false-high-confidence-jev",
        "stale-base-head-or-policy",
        "default-review-nonediting",
        "comment-review-nonediting",
        "explicit-nit-selection",
        "shared-three-round-initial-quality-security",
        "no-fourth-fix-head",
        "quality-fix-delta-review",
        "security-fix-returns-quality",
        "no-reset-via-remote-comments-or-monitor",
        "failed-outcome-with-green-ci",
        "no-observed-checks-not-pass",
        "expected-none-only-proven-by-policy",
        "ready-only-job-trigger-or-blocked",
    }

    @classmethod
    def setUpClass(cls) -> None:
        cls.document = json.loads(FIXTURES.read_text())
        cls.cases = cls.document["cases"]

    def test_fixture_document_is_labeled_and_hypothetical(self) -> None:
        self.assertEqual(1, self.document["version"])
        self.assertIn("Hypothetical", self.document["purpose"])
        self.assertIn("do not record model outcomes", self.document["purpose"])
        self.assertEqual(self.required_cases, {case["id"] for case in self.cases})

    def test_every_case_has_input_evidence_and_expected_decisions(self) -> None:
        for case in self.cases:
            with self.subTest(case=case["id"]):
                self.assertIn("input", case["labels"])
                self.assertIn("evidence", case["labels"])
                self.assertIsInstance(case["input"], dict)
                self.assertTrue(case["input"])
                self.assertIsInstance(case["evidence"], list)
                self.assertTrue(case["evidence"])
                self.assertTrue(all(item.get("id") and item.get("fact") for item in case["evidence"]))
                self.assertIsInstance(case["expected"], dict)
                self.assertTrue(case["expected"])
                self.assertEqual("not_run", case["replay"]["status"])
                self.assertTrue(case["replay"]["method"])

    def test_fixtures_do_not_claim_agent_or_jev_results(self) -> None:
        forbidden = {"actual_outcome", "model_output", "observed_result", "pass_count"}
        for case in self.cases:
            with self.subTest(case=case["id"]):
                self.assertFalse(forbidden & case.keys())
                self.assertNotIn("actual", case["expected"])


@unittest.skipUnless(SOURCE_CHECKS, "source-dependent checks disabled")
class SourceContractStaticTests(unittest.TestCase):
    """Check source contract wording and shapes; this cannot prove agent execution."""

    risk = ROOT / "skills/code-quality/risk-review"
    pr = ROOT / "skills/dev/pr"

    def read(self, path: Path) -> str:
        self.assertTrue(path.is_file(), f"missing source contract: {path.relative_to(ROOT)}")
        return path.read_text()

    def assert_contains(self, path: Path, *needles: str) -> str:
        text = self.read(path)
        for needle in needles:
            self.assertIn(needle, text, f"{path.relative_to(ROOT)} must state: {needle!r}")
        return text

    def test_read_only_risk_review_contract_and_links(self) -> None:
        skill = self.risk / "SKILL.md"
        self.assert_contains(
            skill,
            "Review source without changing it.",
            "Label delegated reviewer tasks `SOURCE REVIEW MODE`.",
            "must not run tests/builds, edit files, fix findings, post comments, approve, commit, push",
            "[shared packet](references/packet.md)",
            "[effect-driven checks](references/checks.md)",
            "[Jev operation](references/jev.md)",
            "[questions](references/questions.json)",
        )
        self.assert_contains(
            self.risk / "references/packet.md",
            "`not_run_by_reviewer`",
            "Uncertain baseline is a gap, never proof of `existing`.",
            "Requests remain requests when remediation is expensive.",
            "Base/policy changes do not reset the budget.",
        )
        self.assert_contains(
            self.risk / "references/checks.md",
            "Several domains can apply to one change.",
            "A tiny shared-default or permission edit can require broader review than a large proven-isolated change.",
            "Search cannot prove full transitive coverage.",
        )

    def test_jev_question_shapes_are_canonical_and_adapter_mapping_is_explicit(self) -> None:
        questions_path = self.risk / "references/questions.json"
        questions = json.loads(self.read(questions_path))
        self.assertEqual("1", questions["version"])
        impact = questions["impact"]
        self.assertEqual("choice", impact["claim_support"]["type"])
        self.assertEqual({"supported", "contradicted", "insufficient"}, set(impact["claim_support"]["criteria"]))
        for domain in ("security", "data", "contract", "deployment", "structure"):
            with self.subTest(domain=domain):
                question = impact[domain]
                self.assertEqual("noul", question["type"])
                self.assertEqual({"true", "false"}, set(question["criteria"]))
                self.assertIn("independently", question["instructions"])
        finding = questions["finding"]
        self.assertEqual("noul", finding["adequacy"]["type"])
        self.assertEqual("choice", finding["category"]["type"])
        self.assertEqual({"request", "nit", "existing"}, set(finding["category"]["criteria"]))
        operation = self.assert_contains(
            self.risk / "references/jev.md",
            'TypeSafe HTTP primitive uses `type: "noul"`',
            'codemode classifier adapter uses `type: "bool"`',
            "Do not pass raw API `noul` blindly through every tool.",
            "IDs only correlate answers. They are invisible to Jev",
            "Batch those independent claim questions and the five independent domain questions",
            "neither can depend on the other's answer.",
            "Jev remains **advisory**. It cannot reduce coverage",
        )
        self.assertIn("finite probabilities", operation)
        self.assertNotIn('"type": "bool"', questions_path.read_text())

    def test_pr_modes_findings_and_rounds_remain_bounded(self) -> None:
        gates = self.pr / "references/gates.md"
        review = self.pr / "references/review.md"
        self.assert_contains(
            gates,
            "green CI alone is insufficient.",
            "infer success from zero observed checks.",
            "New exposure/aggravation is a request; uncertain baseline is a coverage gap, not existing.",
            "An expensive fix or exhausted budget cannot dismiss or downgrade a request.",
            "`limit: 3`",
            "`initial round: 1`",
            "Round 1 includes initial quality and security visits; both clean visits share the round.",
            "broad base/policy changes need full reassessment, not a reset.",
        )
        self.assert_contains(
            review,
            "Default is report-only: no source edits, tests, commits, pushes, comments, thread changes, or approval.",
            "Label delegated reviewer tasks `SOURCE REVIEW MODE`",
            "`comment` authorizes source-verified same-head comments on another author's PR, never edits or approval.",
            "nits: they need separate explicit selection and authorization",
            "security fixes repeat affected quality and security.",
            "Never nest/reset the loop or call `/pr review` recursively.",
        )

    def test_expected_ci_and_ready_only_contract_are_not_inferred(self) -> None:
        ci = self.pr / "references/ci.md"
        ready = self.pr / "references/ready.md"
        self.assert_contains(
            ci,
            "`gh pr checks <number> --required` reports observed jobs, not proof of the complete expected set.",
            "Zero observed checks never passes by itself.",
            "only when trusted policy and applicable branch rules/workflows verify that no checks are expected",
            "For ready-only required jobs, use a supported draft/manual trigger",
            "otherwise report blocked",
        )
        ready_text = self.read(ready)
        self.assertIn("[`gates.md`](gates.md)", ready_text)
        self.assertIn("expected-check inventory", ready_text)
        self.assertIn("supported draft/manual trigger", ready_text)
        self.assertNotIn('Reported "no checks" passes this gate', ready_text)

    def test_one_pr_is_the_default_across_slices_in_one_repository(self) -> None:
        idea = ROOT / "skills/workflow/idea-to-pr/SKILL.md"
        build = ROOT / "skills/workflow/build/SKILL.md"
        idea_text = self.assert_contains(
            idea,
            "Default to one PR across all slices in one repository.",
            "Split into multiple PRs only when the user requests it or the change spans multiple repositories.",
            "For cross-repository work, create one PR per repository and record dependencies.",
            "Never infer multiple PRs from slice count, change size, or dependency order.",
            "only for user-requested dependent PRs in one repository",
        )
        build_text = self.assert_contains(
            build,
            "Default to one PR across all slices in one repository.",
            "Split only when the user requests multiple PRs or the change spans multiple repositories.",
        )
        self.assertNotIn("Default to one slice per PR", idea_text)
        self.assertNotIn("Build one slice per PR", build_text)

    def test_monitor_inherits_review_state_without_recursion_or_reset(self) -> None:
        monitor = self.pr / "references/monitor.md"
        self.assert_contains(
            monitor,
            "three-round state",
            "inherited",
            "never duplicate full reviews",
            "Never reset",
        )


class ReviewerProfileTests(unittest.TestCase):
    """The generic profile retains general review work but defines source-mode limits."""

    profile = ROOT / "agents/reviewer.md"

    def test_source_review_mode_is_explicit_and_does_not_change_frontmatter(self) -> None:
        text = self.profile.read_text()
        frontmatter, body = text.split("---", 2)[1:]
        self.assertIn("name: reviewer", frontmatter)
        self.assertIn("model: anthropic/claude-opus-5-5", frontmatter)
        self.assertIn("tools: read, grep, find, ls, bash, edit, write, codemode", frontmatter)
        self.assertIn("## Source Review Mode", body)
        for required in (
            "read-only source inspection and reporting",
            "must not edit files, run tests/builds, commit, push, or invoke any mutating tool",
            "Consume supplied validation and outcome evidence only",
            "explicitly request a read-only toolset when the harness supports it",
            "cannot enforce that restriction, warn the caller",
            "do not claim tool isolation is effective",
        ):
            self.assertIn(required, body)


if __name__ == "__main__":
    unittest.main()
