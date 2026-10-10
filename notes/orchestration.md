# Agent orchestration

An orchestrator controls which agent runs next, what context it receives,
and when a workflow stops. The orchestrator can be ordinary Python code.

Our planned sequence is research agent, writer agent, then reviewer agent.
The research agent gathers notes. The writer drafts an explanation using those
notes. The reviewer checks whether the draft is supported by the supplied notes.
Review feedback can return to the writer for at most two revision rounds.
A reviewer can still make mistakes; its approval is not a guarantee of accuracy.

These roles can use the same Groq model with different instructions and context.
SQLite will be added later to store conversation history and workflow state.
