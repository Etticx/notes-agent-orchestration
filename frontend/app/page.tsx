"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, ArrowUpRight, BookOpen, CheckCheck, Copy, FileText, ListChecks, LoaderCircle, Sparkles, Square, Sun, Workflow } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useWorkspace } from "@/components/workspace-provider";
import { AGENTS, type AgentId } from "@/lib/types";

const suggestions = [
  { icon: FileText, title: "Connect the dots", detail: "Get a clear summary of your notes", prompt: "Summarize the main ideas in my notes. Cite your sources." },
  { icon: BookOpen, title: "Make it make sense", detail: "Explain a topic in simple terms", prompt: "Explain agent orchestration from my notes in beginner-friendly language. Cite your sources." },
  { icon: ListChecks, title: "Put it into practice", detail: "Turn your notes into revision questions", prompt: "Create three revision questions with answers based on my notes. Cite your sources." },
];

export default function ChatPage() {
  const { messages, busy, send, stop, agents, configured } = useWorkspace();
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages]);
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);
  useEffect(() => {
    if (textarea.current) {
      textarea.current.style.height = "auto";
      textarea.current.style.height = `${Math.min(textarea.current.scrollHeight, 150)}px`;
    }
  }, [input]);
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!input.trim() || busy || configured === false) return;
    void send(input); setInput("");
  };
  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); }
  };
  const active = (Object.keys(agents) as AgentId[]).find((id) => id !== "orchestrator" && agents[id].status === "running");
  const copy = async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content); setCopied(id); setCopyError(false);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(null), 2000);
    } catch { setCopyError(true); }
  };

  return <div className="chat-page">
    <div className="chat-heading"><div><h1>Your notes, in conversation</h1><p>A thoughtful answer starts with what you already know.</p></div><Link href="/overview" className="text-link"><Workflow size={15} /> View agents <ArrowUpRight size={14} /></Link></div>
    <div className={`chat-content ${messages.length ? "has-messages" : ""}`}>
      {!messages.length ? <div className="welcome">
        <div className="welcome-symbol"><Sun size={48} strokeWidth={1.2} /><span className="symbol-spark">✦</span></div>
        <span className="eyebrow">A SMALL TEAM. A CLEARER PICTURE.</span>
        <h2>A little clarity,<br />from your notes.</h2>
        <p>Bring a question. Your agents will find the right notes,<br className="desktop-break" /> write an answer, and give it a second look.</p>
        <div className="suggestions">{suggestions.map(({ icon: Icon, title, detail, prompt }) => <button key={title} onClick={() => { setInput(prompt); textarea.current?.focus(); }} className="suggestion-card"><Icon size={20} strokeWidth={1.5} /><strong>{title}</strong><span>{detail}</span><ArrowUpRight size={14} className="suggestion-arrow" /></button>)}</div>
      </div> : <div className="messages" aria-live="polite" aria-relevant="additions text">
        {messages.map((message) => <article key={message.id} className={`message message-${message.role}`}>
          {message.role === "assistant" && <span className="assistant-avatar"><Sun size={19} strokeWidth={1.6} /></span>}
          <div className="message-body">
            {message.role === "assistant" && <div className="message-author">Butter <span>your notes assistant</span></div>}
            {message.pending ? <div className="thinking"><LoaderCircle size={15} className="spin" /><span>{active ? agents[active].message : "Getting your agents ready"}<span className="thinking-dots">…</span></span><Link href="/overview">Follow the workflow <ArrowUpRight size={12} /></Link></div>
              : <div className={`message-text markdown ${message.error ? "message-error" : ""}`}><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown></div>}
            {message.result && <div className={`answer-review ${message.result.status !== "approved" ? "answer-unapproved" : ""}`}><CheckCheck size={14} />{message.result.status === "approved" ? `Reviewed against your notes${message.result.revisions ? ` · ${message.result.revisions} revision${message.result.revisions > 1 ? "s" : ""}` : ""}` : message.result.status === "no_evidence" ? "No source evidence found" : "Draft · review issues remain"}</div>}
            {!!message.result?.issues.length && <div className="unresolved-issues"><strong>Still needs attention</strong><ul>{message.result.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul></div>}
            {message.role === "assistant" && !message.pending && <button className="copy-button" onClick={() => void copy(message.id, message.content)} aria-label="Copy answer">{copied === message.id ? <CheckCheck size={13} /> : <Copy size={13} />}{copied === message.id ? "Copied" : "Copy answer"}</button>}
          </div>
        </article>)}<div ref={bottom} />
      </div>}
    </div>
    <div className="composer-area">
      <div className="team-strip"><span className="team-caption">YOUR LITTLE TEAM</span>{(["notes", "writer", "reviewer"] as AgentId[]).map((id) => <span key={id} className={`team-agent team-${agents[id].status}`}><span className="team-dot" />{AGENTS[id].name}</span>)}<Link href="/overview" aria-label="Open agent overview"><ArrowUpRight size={14} /></Link></div>
      <form className="composer" onSubmit={submit}>
        <label htmlFor="chat-message" className="sr-only">Ask a question about your notes</label>
        <textarea id="chat-message" ref={textarea} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={onKey} placeholder="What would you like to untangle today?" maxLength={4000} rows={1} disabled={configured === false} />
        <div className="composer-bottom"><span><FileText size={13} /> Grounded in your local notes</span><div className="composer-controls">{input.length > 3500 && <span>{input.length}/4000</span>}{busy ? <button type="button" className="send-button stop-button" onClick={stop} aria-label="Stop workflow"><Square size={14} fill="currentColor" /></button> : <button type="submit" className="send-button" disabled={!input.trim() || configured === false} aria-label="Send message"><ArrowUp size={19} /></button>}</div></div>
      </form>
      <div className="composer-note"><Sparkles size={11} /><span>Each request starts fresh. Review helps, but can still miss things.</span></div>
      {copyError && <p className="copy-error" role="alert">Could not copy. Select the answer text to copy it manually.</p>}
    </div>
  </div>;
}
