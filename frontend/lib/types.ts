export type AgentId = "orchestrator" | "notes" | "writer" | "reviewer";
export type AgentStatus = "idle" | "running" | "completed" | "needs_revision" | "error" | "skipped" | "stopped";
export type AgentState = { status: AgentStatus; message: string; revision: number };
export type WorkflowResult = {
  status: "approved" | "revision_limit" | "no_evidence";
  draft: string;
  issues: string[];
  revisions: number;
};
export type WorkflowEvent =
  | { type: "status"; agent: AgentId; status: AgentStatus; message: string; revision: number }
  | { type: "result"; result: WorkflowResult }
  | { type: "error"; message: string };
export type LogEntry = { id: string; agent: AgentId; message: string; time: string; status: AgentStatus };
export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
  result?: WorkflowResult;
  error?: boolean;
};
export const AGENTS: Record<AgentId, { name: string; role: string; detail: string; number: string }> = {
  orchestrator: { name: "Orchestrator", role: "Keeps everything in order", detail: "Passes evidence between agents and manages up to two revisions.", number: "00" },
  notes: { name: "Notes agent", role: "Finds the right evidence", detail: "Reads relevant local notes and gathers the source text.", number: "01" },
  writer: { name: "Writer agent", role: "Brings your notes together", detail: "Turns the evidence into a clear draft, then revises when needed.", number: "02" },
  reviewer: { name: "Reviewer agent", role: "Gives it a second look", detail: "Checks the draft’s claims and citations against the original notes.", number: "03" },
};
export const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: "Ready", running: "Working", completed: "Done", needs_revision: "Changes needed",
  error: "Error", skipped: "Skipped", stopped: "Stopped",
};
