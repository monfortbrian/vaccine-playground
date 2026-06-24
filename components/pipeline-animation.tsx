"use client";

/**
 * PipelineAnimation
 * 14px Geist regular throughout — no medium weight, no tool name secrets.
 * Agent labels: plain scientific names, no tool stack revealed.
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentId, PipelineStatus } from "@/types";

const AGENTS: { id: AgentId; label: string; short: string }[] = [
  { id: "N1",  label: "Sequence Ingestor",     short: "Data validation"     },
  { id: "N2",  label: "Antigenicity Screener", short: "Antigen scoring"     },
  { id: "N3",  label: "MHC Binding Predictor", short: "T-cell prediction"   },
  { id: "N4",  label: "Linear Epitope Mapper", short: "B-cell prediction"   },
  { id: "N5",  label: "Structural Resolver",   short: "3D structure"        },
  { id: "N6",  label: "Immunosafety Filter",   short: "Safety screening"    },
  { id: "N7",  label: "Population Coverage",   short: "HLA analysis"        },
  { id: "N8",  label: "Construct Assembler",   short: "Construct design"    },
  { id: "N9",  label: "Evidence Retriever",    short: "Literature search"   },
  { id: "N10", label: "Validation Roadmap",    short: "Experiment planning" },
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

function resolveStates(current: AgentId | null, status: string | undefined): NodeState[] {
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
      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border border-destructive"
        style={{ background: "var(--signal-red-bg)" }}>
        <AlertTriangle size={10} className="text-destructive" />
      </div>
    );
  }
  if (state === "active") {
    return <Loader2 size={16} className="animate-spin text-foreground flex-shrink-0" />;
  }
  return <div className="w-4 h-4 flex-shrink-0" />;
}

function AgentRow({
  label, short, state, logLine, isIdle,
}: {
  label: string; short: string; state: NodeState; logLine?: string; isIdle?: boolean;
}) {
  const isActive  = state === "active";
  const isDone    = state === "done";
  const isError   = state === "error";

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 rounded-lg border transition-colors",
      isActive ? "py-3" : "py-2.5",
      isActive  && "border-border bg-card",
      isDone    && "border-border bg-transparent",
      isError   && "border-destructive bg-transparent",
      !isActive && !isDone && !isError && "border-border bg-transparent",
    )}>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-3 min-w-0">
          {/* 14px Geist regular — agent name */}
          <span className={cn(
            "leading-tight shrink-0",
            "text-[14px] font-normal",
            isActive  && "text-foreground",
            isDone    && "text-muted-foreground",
            isError   && "text-destructive",
            !isActive && !isDone && !isError && "text-muted-foreground",
          )}>
            {label}
          </span>
          {/* 13px Geist Mono regular — short descriptor, no secrets */}
          <span className="text-[13px] font-normal font-mono text-tertiary leading-tight truncate">
            {short}
          </span>
        </div>

        {isActive && logLine && (
          <AnimatePresence mode="wait">
            <motion.p
              key={logLine}
              initial={{ opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="text-[13px] font-normal font-mono text-muted-foreground mt-1.5 leading-relaxed"
            >
              {logLine}
            </motion.p>
          </AnimatePresence>
        )}
      </div>

      {!isIdle && <StateIndicator state={state} />}
    </div>
  );
}

export interface PipelineAnimationProps {
  currentNode?: string | null;
  status?: PipelineStatus | string;
  message?: string | null;
}

export function PipelineAnimation({ currentNode, status, message }: PipelineAnimationProps) {
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
          short={agent.short}
          state={states[i]}
          logLine={logLine}
          isIdle={isIdle}
        />
      ))}
    </div>
  );
}