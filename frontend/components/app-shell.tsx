"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Sun, MessageCircle, Workflow, Plus, FileText, FolderOpen, ArrowUpRight, Circle } from "lucide-react";
import type { ReactNode } from "react";
import { useWorkspace } from "./workspace-provider";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { busy, reset, files, filesTruncated, configured, infoError } = useWorkspace();
  const overview = pathname === "/overview";
  const newChat = () => { reset(); router.push("/"); };
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/" className="brand" aria-label="Butter home"><span className="brand-icon"><Sun size={25} strokeWidth={1.6} /></span><span>butter<span className="brand-period">.</span></span></Link>
      <div className="workspace-label"><span className="workspace-avatar">Y</span><span>Your workspace<small>A little room for your thoughts</small></span></div>
      <button className="new-chat" onClick={newChat} disabled={busy}><Plus size={16} /> New chat<span>↗</span></button>
      <span className="nav-label">WORKSPACE</span>
      <nav aria-label="Main navigation">
        <Link className={`nav-item ${!overview ? "active" : ""}`} href="/" aria-current={!overview ? "page" : undefined}><MessageCircle size={18} /> Chat</Link>
        <Link className={`nav-item ${overview ? "active" : ""}`} href="/overview" aria-current={overview ? "page" : undefined}><Workflow size={18} /> Agent overview<span className="nav-count">3</span></Link>
      </nav>
      <div className="sidebar-notes">
        <div className="notes-label"><FolderOpen size={14} /><span>YOUR NOTES</span><span>{files.length}{filesTruncated ? "+" : ""}</span></div>
        {files.map((filename) => <div className="note-file" key={filename} title={filename}><FileText size={14} /><span>{filename}</span></div>)}
        {!files.length && <p className="notes-empty">{infoError ? "Notes unavailable" : configured === null ? "Connecting to your notes…" : "Add .md or .txt files to notes/"}</p>}
      </div>
      <div className="sidebar-bottom"><span className="tiny-sun"><Sun size={18} /></span><p>Good notes. Clearer thoughts.<small>Made for your learning journey.</small></p></div>
    </aside>
    <div className="main-shell">
      <header className="topbar">
        <div className="breadcrumbs"><span>Your workspace</span><span>/</span><strong>{overview ? "Agent overview" : "Chat"}</strong></div>
        <div className="topbar-actions"><span className={`connection ${infoError || configured === false ? "connection-warning" : ""}`}><Circle size={7} fill="currentColor" />{infoError ? "Workspace offline" : configured === false ? "Key needed" : configured === null ? "Connecting" : "Local workspace"}</span><span className="user-avatar">Y</span></div>
      </header>
      {infoError && <div className="setup-alert" role="alert">{infoError}</div>}
      {configured === false && <div className="setup-alert" role="alert">Add your Groq API key to the project’s .env file, then refresh this page.</div>}
      <main className={overview ? "page-main overview-main" : "page-main chat-main"}>{children}</main>
      <footer className="app-footer"><span>YOUR NOTES, A LITTLE MORE CONNECTED</span><Link href={overview ? "/" : "/overview"}>{overview ? "Back to chat" : "See how it works"}<ArrowUpRight size={12} /></Link></footer>
    </div>
  </div>;
}
