"use client";

/**
 * PipelineAnimation
 *
 * Follows globals.css design system exactly:
 *   L1 text-foreground      active agent name
 *   L2 text-muted-foreground  idle/done agent name, log line
 *   L3 text-tertiary        tool names always
 *   No opacity modifiers on text. No /50, /60, /70.
 *   Font sizes: 16px agent name, 13px tool, 13px log
 *   Border: border-border only  no /40 /50 variants
 *
 * Panel header (title + subtitle) lives in playground/page.tsx.
 * This component owns the agent list body only.
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentId, PipelineStatus } from "@/types";

/* ── Agent registry ─────────────────────────────────────────────────────────── */

const AGENTS: { id: AgentId; label: string; tool: string }[] = [
  { id: "N1",  label: "Sequence Ingestor",     tool: "UniProt · NCBI"           },
  { id: "N2",  label: "Antigenicity Screener", tool: "VaxiJen 2.0 · Phobius"    },
  { id: "N3",  label: "MHC Binding Predictor", tool: "NetMHCpan 4.1 · IEDB"     },
  { id: "N4",  label: "Linear Epitope Mapper", tool: "BepiPred 2.0 · ESM-2"     },
  { id: "N5",  label: "Structural Resolver",   tool: "AlphaFold DB · EBI"       },
  { id: "N6",  label: "Immunosafety Filter",   tool: "AllerTOP · HemoPI"        },
  { id: "N7",  label: "Population Coverage",   tool: "IEDB · AFND 2020"         },
  { id: "N8",  label: "Construct Assembler",   tool: "ProtParam · RS09 · PADRE" },
  { id: "N9",  label: "Evidence Retriever",    tool: "PubMed · Qdrant · Anthropic Claude" },
  { id: "N10", label: "Validation Roadmap",    tool: "Anthropic Claude"               },
];

const ORDER = AGENTS.map(a => a.id);

const STAGE_MAP: Record<string, AgentId> = {
  data_curation:       "N1",
  antigen_screening:   "N2",
  tcell_prediction:    "N3",
  bcell_prediction:    "N4",
  structure_retrieval: "N5",
  safety_filter:       "N6",
  coverage_analysis:   "N7",
  construct_design:    "N8",
  literature_search:   "N9",
  experiment_planning: "N10",
};

function toAgentId(node: string | null | undefined): AgentId | null {
  if (!node) return null;
  if (/^N(10|[1-9])$/.test(node)) return node as AgentId;
  return STAGE_MAP[node] ?? null;
}

type NodeState = "waiting" | "active" | "done" | "error";

function resolveStates(
  current: AgentId | null,
  status: string | undefined,
): NodeState[] {
  return ORDER.map(id => {
    if (status === "completed") return "done";
    if (!current || status === "pending") return "waiting";
    const ci = ORDER.indexOf(current);
    const ni = ORDER.indexOf(id);
    if (ni < ci)   return "done";
    if (ni === ci) return status === "failed" ? "error" : "active";
    return "waiting";
  });
}

function trunc(s: string, max = 120) {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/* ── Right-side indicator ───────────────────────────────────────────────────── */

function StateIndicator({ state }: { state: NodeState }) {
  if (state === "done") {
    return (
      <div className="w-5 h-5 rounded-full bg-[var(--signal-green)] flex items-center justify-center flex-shrink-0">
        <Check size={11} color="white" strokeWidth={2.5} />
      </div>
    );
  }
  if (state === "error") {
    return (
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border border-destructive"
        style={{ background: "var(--signal-red-bg)" }}
      >
        <AlertTriangle size={10} className="text-destructive" />
      </div>
    );
  }
  if (state === "active") {
    return <Loader2 size={16} className="animate-spin text-foreground flex-shrink-0" />;
  }
  return <div className="w-4 h-4 flex-shrink-0" />;
}

/* ── Single agent row ───────────────────────────────────────────────────────── */

function AgentRow({
  label,
  tool,
  state,
  logLine,
  isIdle,
}: {
  label: string;
  tool: string;
  state: NodeState;
  logLine?: string;
  isIdle?: boolean;
}) {
  const isActive  = state === "active";
  const isDone    = state === "done";
  const isError   = state === "error";
  const isWaiting = state === "waiting";

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 rounded-lg border transition-colors",
        // height: active row is taller to fit log line
        isActive ? "py-3" : "py-2.5",
        // borders only border-border, no opacity variants
        isActive  && "border-border bg-card",
        isDone    && "border-border bg-transparent",
        isError   && "border-destructive bg-transparent",
        isWaiting && "border-border bg-transparent",
        isIdle    && "border-border bg-transparent",
      )}
    >
      {/* Left: label + tool + log line */}
      <div className="flex-1 min-w-0">

        {/* Agent name + tool on same line */}
        <div className="flex items-baseline gap-3 min-w-0">
          <span
            className={cn(
              // 16px / 500 section header weight per design system
              "text-base font-medium leading-tight shrink-0",
              // L1 for active and error, L2 for done and waiting
              isActive  && "text-foreground",
              isDone    && "text-muted-foreground",
              isWaiting && "text-muted-foreground",
              isIdle    && "text-muted-foreground",
              isError   && "text-destructive",
            )}
          >
            {label}
          </span>
          {/* L3 tool name  text-tertiary, 13px mono, explicit per CSS */}
          <span className="text-sm font-mono text-tertiary leading-tight truncate">
            {tool}
          </span>
        </div>

        {/* Live log line  L2 color, 13px mono, fades on change */}
        {isActive && logLine && (
          <AnimatePresence mode="wait">
            <motion.p
              key={logLine}
              initial={{ opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="text-sm font-mono text-muted-foreground mt-1.5 leading-relaxed"
            >
              {logLine}
            </motion.p>
          </AnimatePresence>
        )}
      </div>

      {/* Right: state indicator hidden in idle */}
      {!isIdle && <StateIndicator state={state} />}
    </div>
  );
}

/* ── Public component ───────────────────────────────────────────────────────── */

export interface PipelineAnimationProps {
  currentNode?: string | null;
  status?: PipelineStatus | string;
  message?: string | null;
}

export function PipelineAnimation({
  currentNode,
  status,
  message,
}: PipelineAnimationProps) {
  const isIdle  = !status || status === "idle";
  const current = toAgentId(currentNode);
  const states  = isIdle
    ? AGENTS.map(() => "waiting" as NodeState)
    : resolveStates(current, status);
  const logLine = message ? trunc(message) : "Initialising…";

  return (
    <div className="flex flex-col gap-2 w-full">
      {AGENTS.map((agent, i) => (
        <AgentRow
          key={agent.id}
          label={agent.label}
          tool={agent.tool}
          state={states[i]}
          logLine={logLine}
          isIdle={isIdle}
        />
      ))}
    </div>
  );
}