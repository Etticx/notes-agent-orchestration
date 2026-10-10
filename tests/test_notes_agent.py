"""Offline checks: no API key or real model requests."""

import copy
import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from groq.types.chat import ChatCompletionMessage

import notes_agent


def response(content=None, tool=None, arguments="{}", call_id="call_1"):
    calls = None if tool is None else [{
        "id": call_id,
        "type": "function",
        "function": {"name": tool, "arguments": arguments},
    }]
    message = ChatCompletionMessage(role="assistant", content=content, tool_calls=calls)
    return SimpleNamespace(choices=[SimpleNamespace(
        message=message, finish_reason="stop" if tool is None else "tool_calls",
    )])


class ScriptedClient:
    """Pretend to be Groq to check the message exchange, not model quality."""

    def __init__(self, responses):
        self.responses = iter(responses)
        self.requests = []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self.create))

    def create(self, **kwargs):
        self.requests.append(copy.deepcopy(kwargs))
        return next(self.responses)


class NotesAgentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix=".test-notes-", dir=notes_agent.PROJECT_DIR)
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.notes = self.root / "notes"
        self.notes.mkdir()
        (self.notes / "project.md").write_text("Our project mascot is a blue otter.", encoding="utf-8")
        (self.root / "outside.md").write_text("Do not expose this file.", encoding="utf-8")
        (self.notes / "private.env").write_text("not a note", encoding="utf-8")
        self.directory_patch = patch.object(notes_agent, "NOTES_DIR", self.notes)
        self.directory_patch.start()
        self.addCleanup(self.directory_patch.stop)

    def test_file_tools_read_notes_and_reject_paths_outside_notes(self):
        self.assertEqual(notes_agent.list_notes()["files"], ["project.md"])
        self.assertIn("blue otter", notes_agent.read_note("project.md")["content"])
        for filename in ["../outside.md", "..\\outside.md", str(self.root / "outside.md"), "private.env"]:
            with self.subTest(filename=filename):
                result = notes_agent.execute_tool("read_note", json.dumps({"filename": filename}))
                self.assertIn("error", result)
                self.assertNotIn("Do not expose", json.dumps(result))

    def test_malformed_or_unknown_tool_requests_return_errors(self):
        for name, arguments in [
            ("read_note", "not JSON"), ("read_note", "[]"),
            ("read_note", '{"filename": 123}'), ("delete_note", "{}"),
            ("list_notes", '{"unexpected": true}'),
        ]:
            with self.subTest(name=name, arguments=arguments):
                self.assertIn("error", notes_agent.execute_tool(name, arguments))

    def test_note_content_is_bounded(self):
        (self.notes / "long.md").write_text("a" * 30000, encoding="utf-8")
        result = notes_agent.read_note("long.md")
        self.assertEqual(len(result["content"]), notes_agent.MAX_NOTE_CHARS)
        self.assertTrue(result["truncated"])

    def test_agent_sends_actual_tool_results_with_matching_call_ids(self):
        client = ScriptedClient([
            response(tool="list_notes", call_id="list_1"),
            response(tool="read_note", arguments='{"filename": "project.md"}', call_id="read_1"),
            response(content="The mascot is a blue otter. [project.md]"),
        ])
        with redirect_stdout(io.StringIO()):
            evidence = notes_agent.run_agent("What is our mascot?", client, "test-model")
        self.assertIn("blue otter", evidence["findings"])
        self.assertEqual(evidence["sources"], [{
            "filename": "project.md", "content": "Our project mascot is a blue otter.", "truncated": False,
        }])
        list_result = client.requests[1]["messages"][-1]
        self.assertEqual(list_result["tool_call_id"], "list_1")
        self.assertEqual(json.loads(list_result["content"])["files"], ["project.md"])
        read_result = client.requests[2]["messages"][-1]
        self.assertEqual(read_result["tool_call_id"], "read_1")
        self.assertIn("blue otter", json.loads(read_result["content"])["content"])

    def test_endless_tool_requests_stop_at_the_model_call_limit(self):
        client = ScriptedClient([response(tool="list_notes")] * notes_agent.MAX_MODEL_CALLS)
        with redirect_stdout(io.StringIO()), self.assertRaisesRegex(RuntimeError, "model-call limit"):
            notes_agent.run_agent("Keep reading", client, "test-model")
        self.assertEqual(len(client.requests), notes_agent.MAX_MODEL_CALLS)


if __name__ == "__main__":
    unittest.main()
