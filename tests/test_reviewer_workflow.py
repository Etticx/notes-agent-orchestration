"""Offline checks for review decisions, feedback handoff, and bounded revisions."""

import io
import json
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch

import orchestrator
import reviewer_agent
from test_notes_agent import ScriptedClient, response


EVIDENCE = {
    "findings": "The mascot is a blue otter. Invented finding: it has wings.",
    "sources": [{"filename": "project.md", "content": "The mascot is a blue otter.",
                 "truncated": False}],
}


def decision(approved, issues=None):
    return response(content=json.dumps({"approved": approved, "issues": issues or []}))


class ReviewerWorkflowTests(unittest.TestCase):
    def run_script(self, responses):
        client = ScriptedClient(responses)
        with patch.object(orchestrator, "run_agent", return_value=EVIDENCE) as notes:
            with redirect_stdout(io.StringIO()):
                result = orchestrator.run_workflow("Describe our mascot.", client, "test-model")
            # Every revision reuses the same evidence instead of gathering notes again.
            notes.assert_called_once()
        return result, client

    def test_review_receives_request_draft_and_actual_sources(self):
        draft = "The mascot is a blue otter. [project.md]"
        client = ScriptedClient([decision(True)])
        with redirect_stdout(io.StringIO()):
            review = reviewer_agent.run_reviewer("Describe it.", EVIDENCE, draft, client, "test-model")
        self.assertTrue(review["approved"])
        request = client.requests[0]
        self.assertEqual(request["response_format"], {"type": "json_object"})
        self.assertNotIn("tools", request)
        payload = json.loads(request["messages"][1]["content"])
        self.assertEqual(payload, {"request": "Describe it.", "draft": draft,
                                   "sources": EVIDENCE["sources"]})
        self.assertNotIn("wings", json.dumps(payload))

    def test_approval_stops_without_revisions(self):
        result, client = self.run_script([response(content="A blue otter. [project.md]"), decision(True)])
        self.assertEqual(result["status"], "approved")
        self.assertEqual(result["revisions"], 0)
        self.assertEqual(len(client.requests), 2)

    def test_rejection_passes_previous_draft_and_feedback_then_checks_revision(self):
        original = "Our mascot is a blue otter with wings. [project.md]"
        revised = "Our mascot is a blue otter. [project.md]"
        issues = ["Remove wings; project.md only describes a blue otter."]
        result, client = self.run_script([
            response(content=original), decision(False, issues),
            response(content=revised), decision(True),
        ])
        self.assertEqual(result, {"status": "approved", "draft": revised,
                                  "issues": [], "revisions": 1})
        revision_payload = json.loads(client.requests[2]["messages"][1]["content"])
        self.assertEqual(revision_payload["previous_draft"], original)
        self.assertEqual(revision_payload["reviewer_feedback"], issues)
        self.assertEqual(revision_payload["evidence"], EVIDENCE)
        self.assertEqual(len(client.requests[2]["messages"]), 2)
        checked_draft = json.loads(client.requests[3]["messages"][1]["content"])["draft"]
        self.assertEqual(checked_draft, revised)

    def test_persistent_rejection_stops_after_two_revisions_with_latest_issues(self):
        result, client = self.run_script([
            response(content="Draft 0"), decision(False, ["First issue"]),
            response(content="Draft 1"), decision(False, ["Second issue"]),
            response(content="Draft 2"), decision(False, ["Still unsupported"]),
        ])
        self.assertEqual(result, {"status": "revision_limit", "draft": "Draft 2",
                                  "issues": ["Still unsupported"], "revisions": 2})
        self.assertEqual(len(client.requests), 6)

    def test_malformed_or_contradictory_decisions_are_not_approvals(self):
        invalid = ["not JSON", "[]", "null", "{}",
                   '{"approved": "false", "issues": ["Fix it"]}',
                   '{"approved": 1, "issues": []}',
                   '{"approved": true, "issues": ["Fix it"]}',
                   '{"approved": false, "issues": []}',
                   '{"approved": false, "issues": [" "]}',
                   '{"approved": false, "issues": [123]}',
                   '{"approved": true, "issues": [], "extra": "data"}']
        for content in invalid:
            with self.subTest(content=content), self.assertRaisesRegex(RuntimeError, "not approved"):
                reviewer_agent.parse_review(content)
        self.assertEqual(reviewer_agent.parse_review('{"approved": false, "issues": ["Fix it"]}'),
                         {"approved": False, "issues": ["Fix it"]})

    def test_invalid_review_stops_the_workflow_without_another_writer_call(self):
        client = ScriptedClient([
            response(content="A draft"), response(content='{"approved": "false", "issues": []}'),
        ])
        with patch.object(orchestrator, "run_agent", return_value=EVIDENCE):
            with redirect_stdout(io.StringIO()), self.assertRaisesRegex(RuntimeError, "not approved"):
                orchestrator.run_workflow("Describe it.", client, "test-model")
        self.assertEqual(len(client.requests), 2)

    def test_incomplete_review_is_not_approval(self):
        cut_off = decision(True)
        cut_off.choices[0].finish_reason = "length"
        client = ScriptedClient([cut_off])
        with redirect_stdout(io.StringIO()), self.assertRaisesRegex(RuntimeError, "not approved"):
            reviewer_agent.run_reviewer("Describe it.", EVIDENCE, "A draft", client, "test-model")
