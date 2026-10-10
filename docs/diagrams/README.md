# Notes assistant: planned architecture

This is a proposed learning project, not an implemented application. The editable Eraser architecture source is in `notes-assistant-architecture.eraser`.

The diagram was rendered and visually checked in Eraser's guest editor. `notes-assistant-architecture.png` is the exported image; `eraser-editor-preview.jpg` records the editor preview. Browser sign-in was unavailable, so saving the file to the user's Eraser account has not been verified. The guest editor URL is https://app.eraser.io/workspace/bUPmYW8F6H2q6TXDRyT1; keep the local source and PNG as the durable copies.

Example task: "Use my notes to explain AI agent orchestration and create five revision questions."

## First version

- Run a Python terminal application locally, with Groq providing remote LLM inference.
- A research agent selects and reads Markdown or text notes through local Python tools.
- A writer agent drafts an explanation using the retrieved evidence.
- A reviewer agent checks the draft against the supplied note excerpts and requests revisions if needed. This check can still make mistakes; it is not a guarantee of correctness.
- The Python orchestrator controls the sequence, passes evidence and feedback, saves run state, and enforces a maximum of two revision rounds. If review still fails, report that outcome rather than presenting the answer as approved.
- SQLite stores conversation history and workflow state. Relevant stored context is supplied to future model calls; this does not retrain the model.
- A shared Groq SDK wrapper handles the model requests for all three roles, with bounded retries and model-call limits. Prompts, selected note excerpts, and tool results included in requests leave the laptop for Groq.
- Tool execution validates tool names, arguments, and resolved file paths against a configured notes directory. Notes are read-only in the first version.
- Return an answer with references to its source notes and record agent transitions and tool calls for learning and debugging.

## Later options

PostgreSQL is an optional replacement for SQLite once database operations become part of the learning goal. It is not needed for the initial project. Saving summaries or editing notes can be added later with a preview and user approval before a write.

Build one agent with tools first, then memory, then the writer/reviewer workflow. Separate models, Docker, vector databases, and cloud deployment are not prerequisites.
