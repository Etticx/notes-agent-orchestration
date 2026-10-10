"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpen, CheckCheck, Circle, Clock3, FileText, GitBranch, Layers3, MessageCircle, PenLine, RotateCcw, ShieldCheck, Sun, Workflow } from "lucide-react";
import { StatusBadge } from "@/components/agent-status";
import { useWorkspace } from "@/components/workspace-provider";
import { AGENTS, type AgentId } from "@/lib/types";

const icons = { notes: BookOpen, writer: PenLine, reviewer: ShieldCheck };
const subagents = ["notes", "writer", "reviewer"] as const;

export default function OverviewPage() {
  const { agents, events, busy, result, elapsed, lastRequest, files } = useWorkspace();
  const revisions = Math.max(agents.writer.revision, agents.reviewer.revision);
  const complete = subagents.filter((id) => agents[id].status === "completed").length;
  return <div className="overview-page">
    <div className="overview-heading"><div><span className="eyebrow">A PEEK BEHIND THE ANSWER</span><h1>Small team. Thoughtful work.</h1><p>See how your notes become an answer, one agent at a time.</p></div><Link href="/" className="outline-button"><MessageCircle size={15} /> Back to chat <ArrowUpRight size={14} /></Link></div>
    <div className="overview-stats">
      <div className="stat"><span className="stat-icon"><Layers3 size={17} /></span><div><span>Workflow</span><strong>One step at a time</strong></div><span className="stat-tag">Sequential</span></div>
      <div className="stat"><span className="stat-icon"><Clock3 size={17} /></span><div><span>{busy ? "Run in progress" : events.length ? "Last run" : "Ready when you are"}</span><strong>{busy || events.length ? `${elapsed.toFixed(1)}s elapsed` : "No runs yet"}</strong></div></div>
      <div className="stat"><span className="stat-icon"><RotateCcw size={17} /></span><div><span>Revision rounds</span><strong>{revisions} <small>/ 2 maximum</small></strong></div></div>
    </div>
    <section className="workflow-panel" aria-labelledby="workflow-title">
      <div className="panel-heading"><div><h2 id="workflow-title"><Workflow size={17} /> The bigger picture</h2><p>Three specialists, guided by one orchestrator.</p></div><span className="map-live"><span className={busy ? "live-dot live-dot-active" : "live-dot"} />{busy ? "Live run" : events.length ? "Latest run" : "Waiting for a request"}</span></div>
      <div className="workflow-map">
        <div className="request-node"><MessageCircle size={14} /><span>Your request</span><ArrowRight size={13} /></div>
        <div className={`orchestrator-node node-${agents.orchestrator.status}`}><span className="orchestrator-icon"><Sun size={24} strokeWidth={1.5} /></span><div><span className="node-kicker">THE CONDUCTOR</span><h3>Orchestrator</h3><p>Passes the context. Keeps the rhythm.</p></div><StatusBadge status={agents.orchestrator.status} /></div>
        <div className="map-stem" /><div className="map-branches"><span /><span /><span /></div>
        <div className="agent-nodes">{subagents.map((id, index) => {
          const Icon = icons[id];
          return <div className={`agent-node node-${agents[id].status}`} key={id}><div className="agent-node-top"><span className={`agent-icon agent-icon-${id}`}><Icon size={21} strokeWidth={1.5} /></span><span className="agent-number">{AGENTS[id].number}</span></div><h3>{AGENTS[id].name}</h3><p>{AGENTS[id].role}</p><div className="agent-node-bottom"><StatusBadge status={agents[id].status} />{index < 2 && <ArrowRight size={15} className="node-next-arrow" />}</div></div>;
        })}</div>
        <div className="revision-loop"><span className="loop-line" /><span><RotateCcw size={13} /> Feedback goes back to Writer · up to 2 revisions</span><span className="loop-line" /></div>
        <div className={`output-node ${result?.status === "approved" ? "output-approved" : ""}`}><CheckCheck size={14} /><span>{result?.status === "approved" ? "Reviewed answer ready" : result?.status === "revision_limit" ? "Draft needs more attention" : result?.status === "no_evidence" ? "No note evidence found" : "Your reviewed answer"}</span></div>
      </div>
      <div className="map-caption"><span><Circle size={6} fill="currentColor" /> Local notes stay read-only</span><span>Shared model · different roles</span><span>Reviewer approval can still miss mistakes</span></div>
    </section>
    <div className="overview-bottom">
      <section className="agent-details" aria-labelledby="agent-details-title"><div className="section-heading"><h2 id="agent-details-title">Meet your agents</h2><span>{events.length ? `${complete} of 3 done` : "3 specialists"}</span></div>{subagents.map((id) => {
        const Icon = icons[id];
        return <div className="agent-detail" key={id}><span className={`detail-icon agent-icon-${id}`}><Icon size={18} /></span><div className="detail-copy"><div><h3>{AGENTS[id].name}</h3><StatusBadge status={agents[id].status} /></div><p>{AGENTS[id].detail}</p><span className="detail-live-message">{agents[id].message}</span></div></div>;
      })}<div className="note-source-caption"><FileText size={13} />{files.length} local note{files.length === 1 ? "" : "s"} available to the Notes agent</div></section>
      <section className="activity-panel" aria-labelledby="activity-title"><div className="section-heading"><h2 id="activity-title">Run activity</h2><span className={busy ? "activity-live" : ""}>{busy ? "● Live" : "Latest request"}</span></div>{lastRequest && <div className="run-request"><MessageCircle size={13} /><p>{lastRequest}</p></div>}{!events.length ? <div className="activity-empty"><GitBranch size={29} strokeWidth={1.2} /><h3>A quiet moment.</h3><p>Send a message in Chat and watch<br />your team get to work here.</p><Link href="/">Start a conversation <ArrowUpRight size={13} /></Link></div> : <ol className="activity-list" aria-live="polite">{events.map((entry) => <li key={entry.id}><span className={`activity-dot activity-dot-${entry.status}`} /><div><div className="activity-meta"><strong>{AGENTS[entry.agent as AgentId].name}</strong><time dateTime={entry.time}>{new Date(entry.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time></div><p>{entry.message}</p></div></li>)}</ol>}</section>
    </div>
  </div>;
}
