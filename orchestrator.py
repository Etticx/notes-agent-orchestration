"""Step 3: coordinate Notes, Writer, and Reviewer with at most two revisions."""

import argparse
import os
import sys
from typing import Callable

from dotenv import load_dotenv
from groq import APIConnectionError, APIStatusError, AuthenticationError, Groq, RateLimitError

from notes_agent import PROJECT_DIR, run_agent
from reviewer_agent import run_reviewer
from writer_agent import run_writer

MAX_REVISIONS = 2


def run_workflow(question: str, client: Groq, model: str,
                 on_event: Callable[[dict], None] | None = None) -> dict:
    """Return the final draft, review status, pending issues, and revision count."""
    def status(agent: str, state: str, message: str, revision: int = 0):
        if on_event:
            on_event({"type": "status", "agent": agent, "status": state,
                      "message": message, "revision": revision})

    status("orchestrator", "running", "Starting a new notes workflow")
    status("notes", "running", "Finding relevant notes")
    print("[Workflow] Notes agent: gather evidence")
    evidence = run_agent(question, client, model)
    status("notes", "completed", f"Gathered {len(evidence['sources'])} source(s)")
    print(f"[Workflow] Passing {len(evidence['sources'])} source(s) to the Writer")
    if evidence["sources"]:
        status("writer", "running", "Writing from your notes")
    draft = run_writer(question, evidence, client, model)
    if not evidence["sources"]:
        status("writer", "skipped", "No note evidence to write from")
        status("reviewer", "skipped", "No draft to review")
        status("orchestrator", "completed", "Finished without note evidence")
        return {"status": "no_evidence", "draft": draft, "issues": [], "revisions": 0}
    status("writer", "completed", "First draft ready")

    # Review the original draft, then review after each of at most two revisions.
    for revisions in range(MAX_REVISIONS + 1):
        status("reviewer", "running", "Checking claims and citations", revisions)
        review = run_reviewer(question, evidence, draft, client, model)
        if review["approved"]:
            status("reviewer", "completed", "Draft approved", revisions)
            status("orchestrator", "completed", "Answer ready", revisions)
            print("[Workflow] Reviewer approved")
            return {"status": "approved", "draft": draft, "issues": [], "revisions": revisions}

        print("[Workflow] Reviewer requested changes:")
        for issue in review["issues"]:
            print(f"  - {issue}")
        status("reviewer", "needs_revision", " • ".join(review["issues"]), revisions)
        if revisions == MAX_REVISIONS:
            status("orchestrator", "needs_revision", "Stopped at the two-revision limit", revisions)
            return {"status": "revision_limit", "draft": draft,
                    "issues": review["issues"], "revisions": revisions}

        print(f"[Workflow] Writer revision {revisions + 1}/{MAX_REVISIONS}")
        status("writer", "running", "Revising using reviewer feedback", revisions + 1)
        draft = run_writer(question, evidence, client, model,
                           previous_draft=draft, feedback=review["issues"])
        status("writer", "completed", "Revised draft ready", revisions + 1)


def main() -> int:
    # Model output can include Unicode characters that Windows' default encoding cannot print.
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("question", help="What you want the assistant to write from your notes")
    args = parser.parse_args()

    load_dotenv(PROJECT_DIR / ".env")
    if not os.getenv("GROQ_API_KEY", "").strip():
        print("Set GROQ_API_KEY in your local .env file. See .env.example.")
        return 1
    model = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
    try:
        # All agents share one client/key but send different instructions and contexts.
        with Groq(timeout=30, max_retries=0) as client:
            result = run_workflow(args.question, client, model)
        if result["status"] == "approved":
            print(f"\nAnswer (Reviewer approved):\n{result['draft']}")
            return 0
        if result["status"] == "no_evidence":
            print(f"\nCould not answer from notes:\n{result['draft']}")
            return 1
        print(f"\nDraft (not approved after {result['revisions']} revisions):\n{result['draft']}")
        print("\nUnresolved review issues:")
        for issue in result["issues"]:
            print(f"- {issue}")
        return 2
    except AuthenticationError:
        print("Groq rejected the API key. Check GROQ_API_KEY locally.")
    except RateLimitError:
        print("Groq rate limit reached. Wait for your quota to recover before retrying.")
    except APIConnectionError:
        print("Could not reach Groq. Check your internet connection.")
    except APIStatusError as error:
        print(f"Groq returned HTTP {error.status_code}. Check model access and request settings.")
    except RuntimeError as error:
        print(str(error))
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
