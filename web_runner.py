"""Bridge Next.js to the Python workflow using newline-delimited JSON events."""

import json
import os
import sys
from contextlib import redirect_stdout

from dotenv import load_dotenv
from groq import APIConnectionError, APIStatusError, AuthenticationError, Groq, RateLimitError

from notes_agent import PROJECT_DIR, list_notes
from orchestrator import run_workflow


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    output = sys.stdout

    def emit(event: dict):
        print(json.dumps(event, ensure_ascii=False), file=output, flush=True)

    load_dotenv(PROJECT_DIR / ".env")
    if "--info" in sys.argv:
        try:
            emit({**list_notes(), "configured": bool(os.getenv("GROQ_API_KEY", "").strip())})
            return 0
        except OSError:
            emit({"error": "The notes folder could not be read."})
            return 1

    if not os.getenv("GROQ_API_KEY", "").strip():
        emit({"type": "error", "message": "Add your Groq API key to the project's .env file."})
        return 1
    try:
        request = json.loads(sys.stdin.readline())
        question = request.get("message") if isinstance(request, dict) else None
        if not isinstance(question, str) or not question.strip() or len(question) > 4000:
            raise ValueError("Enter a request between 1 and 4,000 characters.")
        model = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
        # Existing learning logs go to stderr; stdout contains only JSON events.
        with redirect_stdout(sys.stderr), Groq(timeout=30, max_retries=0) as client:
            result = run_workflow(question.strip(), client, model, on_event=emit)
        emit({"type": "result", "result": result})
        return 0
    except AuthenticationError:
        message = "Groq rejected the API key. Check your project's .env file."
    except RateLimitError:
        message = "Groq's rate limit was reached. Wait a little, then try again."
    except APIConnectionError:
        message = "Could not reach Groq. Check your internet connection."
    except APIStatusError as error:
        message = f"Groq returned HTTP {error.status_code}. Check your model settings."
    except (RuntimeError, ValueError) as error:
        message = str(error)
    except Exception:
        message = "The workflow could not finish. Check your Python environment and notes folder."
    emit({"type": "error", "message": message})
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
