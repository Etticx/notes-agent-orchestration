"""Offline checks for evidence handoff and incomplete Writer responses."""

import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

import notes_agent
import orchestrator
import writer_agent
from test_notes_agent import ScriptedClient, response


class WriterWorkflowTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory(prefix=".test-notes-", dir=notes_agent.PROJECT_DIR)
        self.addCleanup(temp.cleanup)
        notes = Path(temp.name)
        (notes / "project.md").write_text("Our project mascot is a blue otter.", encoding="utf-8")
        directory_patch = patch.object(notes_agent, "NOTES_DIR", notes)
        directory_patch.start()
        self.addCleanup(directory_patch.stop)

    def test_notes_then_writer_passes_real_sources_in_a_fresh_context(self):
        client = ScriptedClient([
            response(tool="read_note", arguments='{"filename": "project.md"}'),
            response(content="The mascot is a blue otter. An invented finding is purple wings."),
            response(content="Our mascot is a blue otter. [project.md]"),
            response(content='{"approved": true, "issues": []}'),
        ])
        events = []
        with redirect_stdout(io.StringIO()):
            result = orchestrator.run_workflow("Describe our mascot.", client, "test-model", on_event=events.append)

        self.assertEqual(result["draft"], "Our mascot is a blue otter. [project.md]")
        self.assertEqual(result["status"], "approved")
        self.assertEqual([(event["agent"], event["status"]) for event in events], [
            ("orchestrator", "running"), ("notes", "running"), ("notes", "completed"),
            ("writer", "running"), ("writer", "completed"), ("reviewer", "running"),
            ("reviewer", "completed"), ("orchestrator", "completed"),
        ])
        writer_request = client.requests[-2]
        self.assertNotIn("tools", writer_request)
        self.assertEqual(len(writer_request["messages"]), 2)
        payload = json.loads(writer_request["messages"][1]["content"])
        self.assertEqual(payload["request"], "Describe our mascot.")
        self.assertEqual(payload["evidence"]["sources"][0]["content"],
                         "Our project mascot is a blue otter.")
        # The research summary is separate from the actual text, so it cannot replace evidence.
        self.assertNotIn("purple wings", payload["evidence"]["sources"][0]["content"])

    def test_no_successful_reads_does_not_send_an_ungrounded_writer_request(self):
        client = ScriptedClient([
            response(tool="read_note", arguments='{"filename": "missing.md"}'),
            response(content="No relevant notes were found."),
        ])
        with redirect_stdout(io.StringIO()):
            result = orchestrator.run_workflow("What is our mascot?", client, "test-model")
        self.assertIn("could not gather note content", result["draft"])
        self.assertEqual(result["status"], "no_evidence")
        self.assertEqual(len(client.requests), 2)

    def test_writer_rejects_a_draft_cut_off_by_the_output_limit(self):
        cut_off = response(content="An unfinished draft")
        cut_off.choices[0].finish_reason = "length"
        client = ScriptedClient([cut_off])
        evidence = {"findings": "Mascot details", "sources": [notes_agent.read_note("project.md")]}
        with redirect_stdout(io.StringIO()), self.assertRaisesRegex(RuntimeError, "did not finish"):
            writer_agent.run_writer("Describe it.", evidence, client, "test-model")
