# Notes assistant — Notes + Writer + Reviewer, with a Next.js frontend

The Notes agent gathers evidence, the Writer drafts an answer, and the Reviewer
checks it against the source text. Ordinary Python code in `orchestrator.py` runs
these roles using Groq and allows at most two Writer revisions. Persistent memory
is a later addition.

## Open the web app

The `frontend/` folder contains **Butter**, a minimalist Next.js interface with a
soft yellow theme. It has Chat and Agent overview pages. Chat sends requests to
the real Python workflow. The overview shows live agent statuses, revision rounds,
and the current run's activity; it does not simulate agent progress.

With the Python `.venv`, requirements, and Groq `.env` already set up, install
Node.js 20.9 or newer and run:

```powershell
cd frontend
npm install
npm run dev
```

Open the Local URL printed in the terminal (normally http://127.0.0.1:3000).
Leave that terminal running while using the app. If you prefer a production build,
run `npm run build` then `npm start` from `frontend/`.

The Chat page includes suggested requests, Markdown answers, review outcomes,
copying answers, starting a new chat, and stopping an active run. You can switch
to Agent overview while a request is running without interrupting it. A rejected
draft is clearly labelled and shows the unresolved issues.

The interface displays earlier messages while the page is open, but each request
is independent: earlier chat messages are not supplied to the agents. Refreshing
the browser clears the displayed conversation and run state. Persistent memory
is not implemented.

### How the frontend connects

Browser → Next.js `/api/chat` → `web_runner.py` → `run_workflow()`.

The Next.js route starts Python from the root project's `.venv`, sends the request
via standard input, and streams newline-delimited JSON status events and the final
result back to the browser. `web_runner.py` loads the existing root `.env`; the API
key stays on the server and is never returned to the browser. No additional Python
web framework or Python dependencies are required.

The optional `on_event` callback in `run_workflow()` supplies status updates without
changing the original terminal workflow. Notes still use their read-only tools;
Writer and Reviewer still use the same existing Python functions.

Stopping a run aborts the browser request and terminates its Python process. It
does not undo any Groq request already sent. The server also stops a run after
six minutes, and malformed reviews or API errors appear as errors in the UI.

The local Node server is bound to `127.0.0.1`. The Python bridge requires a local
Node runtime and the project `.venv`; it is not a static export or an edge-runtime
deployment. Do not expose this learning app as a public service without adding
authentication and managing shared request limits.

Frontend checks: `npm run typecheck` and `npm run build` from `frontend/`.
Next.js route handlers reference: https://nextjs.org/docs/app/api-reference/file-conventions/route

## Run it in PowerShell

The project environment is `.venv`. If setting up on another machine, install
Python 3.10 or newer, then run `python -m venv .venv` and
`.\.venv\Scripts\python.exe -m pip install -r requirements.txt`.

1. If you do not already have `.env`, copy `.env.example` to `.env` with
   `Copy-Item .env.example .env`. Keep your existing key when upgrading this project.
2. Edit `.env` locally and set `GROQ_API_KEY` to your key from https://console.groq.com/keys.
   Keep the key in that file, rather than pasting it into chat. `.env` is ignored by Git.
3. Check local tools without any model request:

   ```powershell
   .\.venv\Scripts\python.exe notes_agent.py --list-notes
   ```

4. Run the three-agent workflow:

   ```powershell
   .\.venv\Scripts\python.exe orchestrator.py "Explain agent orchestration from my notes in beginner-friendly language."
   ```

   With your virtual environment activated, `python orchestrator.py "your request"`
   works too. Try asking for a summary or three revision questions.

5. To inspect just the Notes agent's evidence packet:

   ```powershell
   python notes_agent.py "How does agent orchestration work?"
   ```

   This command now returns findings and sources, rather than the final answer.

`GROQ_MODEL` defaults to `openai/gpt-oss-20b`, listed in Groq's current model
catalog. Availability and quotas depend on your account; change it in `.env`
if needed. Tool calls and note excerpts included in requests go to Groq.

## Read the code in this order

1. `list_notes()` and `read_note()`: ordinary local Python functions.
2. `TOOLS`: JSON descriptions that let the LLM request those functions.
3. `execute_tool()`: checks the model's request and executes an allowed function.
4. `run_agent()` in `notes_agent.py`: sends messages, handles tool calls,
   and returns `{"findings": "...", "sources": [...]}`. Python collects sources
   directly from successful file reads; filenames and excerpts are not invented
   by the model. Repeated reads of the same filename appear only once.
5. `run_writer()` in `writer_agent.py`: gives a separate model request the user's
   task and evidence. It returns a draft, with no file tools. For a revision, it
   also receives the previous draft and Reviewer feedback. If there are no
   sources, it returns an insufficient-evidence message without a model request.
6. `run_reviewer()` in `reviewer_agent.py`: sends the request, actual source text,
   and current draft to a separate model request. It returns an approval boolean
   and a list of issues. Research findings are not used as review evidence.
7. `parse_review()` in `reviewer_agent.py`: checks that the JSON has exactly an
   `approved` boolean and an `issues` list of nonempty strings. Approval requires
   no issues; rejection requires at least one. Invalid or incomplete output stops
   the workflow without approving the draft.
8. `run_workflow()` in `orchestrator.py`: coordinates the agents and enforces
   `MAX_REVISIONS = 2`. It returns a result with status, draft, issues, and the
   number of revisions performed.
9. `main()` in `orchestrator.py`: loads settings and prints the result.

The Writer's system instructions define its role. Its user message contains JSON
with the original request, research findings, and actual source text. Findings are
an LLM-generated guide; source text is the evidence. The Writer is instructed to
check claims against that text, cite filenames, and disclose missing information.
Instructions do not guarantee factual accuracy. The Reviewer adds a separate
check, but can still make mistakes, especially when using the same model.

All three roles use the same client, API key, and model with different instructions.
They do not automatically share conversations: Python explicitly passes evidence.
The Writer is a simple specialized LLM role, rather than a tool-calling loop.
The Reviewer is also a specialized LLM role with no file tools.

## Review and revision flow

The initial sequence is Notes → Writer → Reviewer. Approval stops the workflow.
Rejection sends the current draft and specific issues to the Writer, followed by
another review. Notes are gathered once and reused throughout the revisions.

There can be three drafts and three reviews: the original draft, revision 1,
and revision 2. If the final review rejects revision 2, the terminal displays the
latest draft labelled **not approved**, along with the remaining issues.
The terminal also prints Reviewer feedback as the workflow runs.

The command exits with code 0 for approval, 1 for missing evidence or an error,
and 2 when the revision limit is reached without approval. Approval is an LLM
assessment of support in the supplied notes, not a factual guarantee.

For example, the Reviewer can return:

```json
{"approved": false, "issues": ["Remove the claim that memory is implemented; the source describes it as planned."]}
```

Python parses that response and passes the issue to the Writer. A string such as
`"approved": "false"` is rejected rather than treated as an approval.
There are no automatic retries for malformed reviews or API errors.

This version reads top-level `.md` and `.txt` files in `notes/`, returns at most
6,000 characters per note, and makes at most six Notes-agent model requests plus
three Writer and three Reviewer requests (at most 12 model requests total).
Notes are sent as bounded excerpts, without chunking or vector
search. Each command starts a new conversation. Notes remain read-only. Drafts
print in the terminal; the Writer does not save or change files.

The sample notes are learning material created for this project. Try adding a
short note with a fact the model would not know and ask about that fact.

## Next steps, one at a time

The original three-role workflow is now implemented. Explore it and understand
the handoffs before choosing another feature. Note search, vector retrieval,
and SQLite memory are optional later improvements; they are not additional
agents required by this workflow.

Groq reference: https://console.groq.com/docs/tool-use/local-tool-calling

Reviewer JSON mode reference: https://console.groq.com/docs/structured-outputs
JSON mode requests valid JSON syntax; Python still validates the decision fields.

## Offline checks

Run `.\.venv\Scripts\python.exe -m unittest discover -s tests -v` to check
file access restrictions, invalid tool requests, note-size bounds, the full
list/read/findings message exchange with a simulated model, and the call limit.
They also check the Notes-to-Writer evidence handoff, failed reads, and an
incomplete Writer response.
Reviewer checks cover source handoff, immediate approval, revision feedback,
the two-revision limit, invalid decisions, and incomplete review responses.
These checks do not verify live Groq responses or model quality.
