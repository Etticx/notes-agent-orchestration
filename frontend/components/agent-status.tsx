import { Check, Circle, LoaderCircle, AlertCircle, Minus, Square } from "lucide-react";
import { STATUS_LABELS, type AgentStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: AgentStatus }) {
  const Icon = status === "running" ? LoaderCircle : status === "completed" ? Check
    : status === "needs_revision" || status === "error" ? AlertCircle
    : status === "skipped" ? Minus : status === "stopped" ? Square : Circle;
  return <span className={`status-badge status-${status}`}>
    <Icon size={12} className={status === "running" ? "spin" : ""} aria-hidden="true" />
    {STATUS_LABELS[status]}
  </span>;
}
