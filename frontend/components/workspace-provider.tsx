"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { AgentId, AgentState, LogEntry, Message, WorkflowEvent, WorkflowResult } from "@/lib/types";

const initialAgents = (): Record<AgentId, AgentState> => ({
  orchestrator: { status: "idle", message: "Waiting for your request", revision: 0 },
  notes: { status: "idle", message: "Ready to read your notes", revision: 0 },
  writer: { status: "idle", message: "Waiting for evidence", revision: 0 },
  reviewer: { status: "idle", message: "Waiting for a draft", revision: 0 },
});
type Workspace = {
  messages: Message[];
  agents: Record<AgentId, AgentState>;
  events: LogEntry[];
  busy: boolean;
  files: string[];
  configured: boolean | null;
  infoError: string;
  filesTruncated: boolean;
  result: WorkflowResult | null;
  elapsed: number;
  lastRequest: string;
  send: (message: string) => Promise<void>;
  stop: () => void;
  reset: () => void;
};
const WorkspaceContext = createContext<Workspace | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [agents, setAgents] = useState(initialAgents);
  const [events, setEvents] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [infoError, setInfoError] = useState("");
  const [filesTruncated, setFilesTruncated] = useState(false);
  const [result, setResult] = useState<WorkflowResult | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [lastRequest, setLastRequest] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/info", { signal: abort.signal })
      .then(async (response) => {
        const info = await response.json();
        if (!response.ok) throw new Error(info.error || "Could not connect to your local workspace.");
        setFiles(info.files);
        setFilesTruncated(info.truncated);
        setConfigured(info.configured);
      })
      .catch((error) => { if (!abort.signal.aborted) setInfoError(error.message); });
    return () => { abort.abort(); };
  }, []);
  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed((Date.now() - started) / 1000), 500);
    return () => clearInterval(timer);
  }, [busy]);

  const send = useCallback(async (text: string) => {
    const message = text.trim();
    if (!message || message.length > 4000 || abortRef.current) return;
    const abort = new AbortController();
    abortRef.current = abort;
    const startedAt = Date.now();
    const assistantId = crypto.randomUUID();
    setMessages((current) => [...current,
      { id: crypto.randomUUID(), role: "user", content: message },
      { id: assistantId, role: "assistant", content: "", pending: true },
    ]);
    setAgents(initialAgents());
    setEvents([]);
    setResult(null);
    setElapsed(0);
    setLastRequest(message);
    setBusy(true);
    let terminal = false;

    const finishMessage = (content: string, extra: Partial<Message> = {}) => {
      setMessages((current) => current.map((entry) => entry.id === assistantId
        ? { ...entry, content, pending: false, ...extra } : entry));
    };
    const fail = (errorMessage: string, stopped = false) => {
      terminal = true;
      finishMessage(errorMessage, { error: !stopped });
      setAgents((current) => Object.fromEntries(Object.entries(current).map(([id, state]) =>
        [id, state.status === "running" || id === "orchestrator"
          ? { ...state, status: stopped ? "stopped" : "error", message: errorMessage } : state]
      )) as Record<AgentId, AgentState>);
      setEvents((current) => [...current, { id: crypto.randomUUID(), agent: "orchestrator",
        message: errorMessage, status: stopped ? "stopped" : "error", time: new Date().toISOString() }]);
    };
    const receive = (event: WorkflowEvent) => {
      if (terminal) return;
      if (event.type === "status") {
        setAgents((current) => ({ ...current, [event.agent]: {
          status: event.status, message: event.message, revision: event.revision,
        } }));
        setEvents((current) => [...current, { ...event, id: crypto.randomUUID(), time: new Date().toISOString() }]);
      } else if (event.type === "result") {
        terminal = true;
        setResult(event.result);
        finishMessage(event.result.draft, { result: event.result });
      } else if (event.type === "error") fail(event.message);
    };

    try {
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }), signal: abort.signal,
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "The request could not be sent.");
      }
      if (!response.body) throw new Error("No workflow response was received.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) if (line.trim()) receive(JSON.parse(line));
        if (done) break;
      }
      if (buffer.trim()) receive(JSON.parse(buffer));
      if (!terminal) throw new Error("The workflow connection ended before an answer was ready.");
    } catch (error) {
      if (!terminal) {
        if (abort.signal.aborted) fail("This run was stopped. You can send a new request whenever you’re ready.", true);
        else fail(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      }
    } finally {
      abortRef.current = null;
      setElapsed((Date.now() - startedAt) / 1000);
      setBusy(false);
    }
  }, []);

  const reset = () => {
    if (abortRef.current) return;
    setMessages([]); setAgents(initialAgents()); setEvents([]);
    setResult(null); setElapsed(0); setLastRequest("");
  };
  return <WorkspaceContext.Provider value={{ messages, agents, events, busy, files, configured,
    infoError, filesTruncated, result, elapsed, lastRequest, send,
    stop: () => abortRef.current?.abort(), reset }}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("WorkspaceProvider is missing.");
  return value;
}
