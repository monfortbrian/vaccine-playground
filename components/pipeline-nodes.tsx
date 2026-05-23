"use client";

/**
 * PipelineNodes — real-time N1→N8 pipeline progress visualisation
 *
 * Node states:
 *   waiting  — not yet reached
 *   running  — currently active (spinning loader)
 *   done     — completed
 *   error    — failed at this node
 *
 * Uses lucide-react Loader2 for the active spinner per design direction.
 */

import React from "react";
import { cn } from "@/lib/utils";
import { PIPELINE_NODES, type PipelineNode } from "@/types";
import { Progress } from "@/components/ui/progress";
import {
  Database,
  Filter,
  Dna,
  Microscope,
  Boxes,
  ShieldCheck,
  Globe2,
  FlaskConical,
  Check,
  Loader2,
  Clock,
  AlertTriangle,
} from "lucide-react";

// ── Icon map ──────────────────────────────────────────────────────────────────

const NODE_ICONS: Record<PipelineNode, React.ElementType> = {
  N1: Database,
  N2: Filter,
  N3: Dna,
  N4: Microscope,
  N5: Boxes,       // 3D structure — Boxes evokes spatial/volume
  N6: ShieldCheck,
  N7: Globe2,
  N8: FlaskConical,
};

// ── State resolution ──────────────────────────────────────────────────────────

type NodeState = "waiting" | "running" | "done" | "error";

const NODE_ORDER: PipelineNode[] = ["N1", "N2", "N3", "N4", "N5", "N6", "N7", "N8"];

function resolveState(
  nodeId: PipelineNode,
  currentNode: PipelineNode | null,
  pipelineStatus: string
): NodeState {
  if (pipelineStatus === "failed" && nodeId === currentNode) return "error";
  if (pipelineStatus === "completed") return "done";

  const currentIdx = currentNode ? NODE_ORDER.indexOf(currentNode) : -1;
  const nodeIdx = NODE_ORDER.indexOf(nodeId);

  if (nodeIdx < currentIdx) return "done";
  if (nodeIdx === currentIdx) return "running";
  return "waiting";
}

// ── Status icon ───────────────────────────────────────────────────────────────

function StatusIcon({ state }: { state: NodeState }) {
  switch (state) {
    case "done":
      return <Check className="size-3 text-primary" strokeWidth={2.5} />;
    case "running":
      return <Loader2 className="size-3 text-primary animate-spin" />;
    case "error":
      return <AlertTriangle className="size-3 text-destructive" />;
    default:
      return <Clock className="size-3 text-muted-foreground/30" />;
  }
}

// ── Single node card ──────────────────────────────────────────────────────────

interface NodeCardProps {
  node: (typeof PIPELINE_NODES)[number];
  state: NodeState;
}

function NodeCard({ node, state }: NodeCardProps) {
  const Icon = NODE_ICONS[node.id];

  return (
    <div
      className={cn(
        "relative rounded-xl border p-3 transition-all duration-300",
        // Base
        "bg-card",
        // State variants
        state === "running" && [
          "border-primary/40",
          "shadow-[0_0_0_3px_rgba(0,113,227,0.12)]",
          "dark:shadow-[0_0_0_3px_rgba(10,132,255,0.15)]",
        ],
        state === "done" && "border-border opacity-60",
        state === "waiting" && "border-border opacity-35",
        state === "error" && [
          "border-destructive/40",
          "shadow-[0_0_0_3px_rgba(255,59,48,0.1)]",
        ]
      )}
    >
      {/* Icon + status indicator */}
      <div className="flex items-center justify-between mb-2.5">
        <div
          className={cn(
            "rounded-md p-1.5 transition-colors duration-200",
            state === "running" || state === "done"
              ? "bg-primary/10 dark:bg-primary/15"
              : state === "error"
              ? "bg-destructive/10"
              : "bg-muted"
          )}
        >
          <Icon
            className={cn(
              "size-3.5",
              state === "running" || state === "done"
                ? "text-primary"
                : state === "error"
                ? "text-destructive"
                : "text-muted-foreground"
            )}
          />
        </div>
        <StatusIcon state={state} />
      </div>

      {/* Node ID badge */}
      <p
        className={cn(
          "font-mono text-[10px] font-semibold mb-0.5 tracking-wide",
          state === "running" ? "text-primary" : "text-muted-foreground"
        )}
      >
        {node.id}
      </p>

      {/* Label */}
      <p
        className={cn(
          "text-xs font-semibold leading-tight",
          state === "waiting" && "text-muted-foreground"
        )}
      >
        {node.label}
      </p>

      {/* Short description */}
      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
        {node.shortDesc}
      </p>

      {/* Tool source — only shown when running or done */}
      {(state === "running" || state === "done") && (
        <p
          className={cn(
            "text-[9px] mt-1.5 leading-tight font-mono",
            state === "running"
              ? "text-primary/60"
              : "text-muted-foreground/50"
          )}
        >
          {node.tool}
        </p>
      )}

      {/* Active pulse bar */}
      {state === "running" && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl overflow-hidden">
          <div className="h-full bg-primary/40 animate-pulse" />
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface PipelineNodesProps {
  currentNode: PipelineNode | null;
  status: string;
  progress: number;
  message: string;
}

export function PipelineNodes({
  currentNode,
  status,
  progress,
  message,
}: PipelineNodesProps) {
  return (
    <div className="space-y-5">
      {/* Node grid — 4 cols on desktop, 2 on mobile */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8">
        {PIPELINE_NODES.map((node) => {
          const state = resolveState(node.id, currentNode, status);
          return <NodeCard key={node.id} node={node} state={state} />;
        })}
      </div>

      {/* Progress bar + message */}
      <div className="space-y-2 pt-1">
        <Progress
          value={progress * 100}
          className="h-1.5"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {message || "Initializing…"}
          </p>
          <p className="font-mono text-xs tabular-nums text-muted-foreground">
            {Math.round(progress * 100)}%
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Empty state node icons (for playground idle state) ───────────────────────

export function PipelineIdleGrid() {
  return (
    <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
      {PIPELINE_NODES.map((node) => {
        const Icon = NODE_ICONS[node.id];
        return (
          <div
            key={node.id}
            className="flex flex-col items-center gap-1.5"
          >
            <div className="rounded-lg bg-muted p-2">
              <Icon className="size-4 text-muted-foreground/50" />
            </div>
            <span className="font-mono text-[9px] text-muted-foreground/50">
              {node.id}
            </span>
          </div>
        );
      })}
    </div>
  );
}