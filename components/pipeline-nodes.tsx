"use client";

/**
 * PipelineNodes - N1→N8 progress visualisation
 *
 * Design decisions:
 *   - Node label is "N1", "N2" etc - not icons (per product direction)
 *   - Active node: solid border + Loader2 spinner (lucide)
 *   - Done node: check mark, reduced opacity
 *   - Waiting: low opacity, no decoration
 *   - Error: destructive ring
 *   - No blue - neutral palette only
 *   - Progress message: professional copy, not "Running TOPE_DEEP N1 → N8."
 */

import React from "react";
import { cn } from "@/lib/utils";
import { PIPELINE_NODES, type PipelineNode } from "@/types";
import { Progress } from "@/components/ui/progress";
import { Check, Loader2, Clock, AlertTriangle } from "lucide-react";

const NODE_ORDER: PipelineNode[] = ["N1", "N2", "N3", "N4", "N5", "N6", "N7", "N8"];

type NodeState = "waiting" | "running" | "done" | "error";

function resolveState(
  nodeId: PipelineNode,
  currentNode: PipelineNode | null,
  pipelineStatus: string
): NodeState {
  if (pipelineStatus === "failed" && nodeId === currentNode) return "error";
  if (pipelineStatus === "completed") return "done";
  const ci = currentNode ? NODE_ORDER.indexOf(currentNode) : -1;
  const ni = NODE_ORDER.indexOf(nodeId);
  if (ni < ci) return "done";
  if (ni === ci) return "running";
  return "waiting";
}

function progressMessage(
  currentNode: PipelineNode | null,
  status: string,
  message: string
): string {
  if (status === "paused") return "Analysis paused.";
  if (status === "cancelled") return "Analysis stopped.";
  if (status === "completed") return "Analysis complete.";
  if (status === "failed") return message || "Pipeline encountered an error.";
  if (!currentNode) return "Initializing…";
  // Professional per-node messages
  const msgs: Record<PipelineNode, string> = {
    N1: "Fetching protein sequences from UniProt…",
    N2: "Screening surface-exposed antigens (VaxiJen, Phobius)…",
    N3: "Predicting T-cell epitopes (NetMHCpan 4.1, NetMHCIIpan 4.3)…",
    N4: "Predicting B-cell epitopes (IEDB BepiPred 2.0)…",
    N5: "Retrieving 3D structures (AlphaFold DB)…",
    N6: "Safety screening (AllerTOP, AllergenFP, ToxinPred, BLAST)…",
    N7: "Calculating population coverage (IEDB, AFND 2020)…",
    N8: "Assembling multi-epitope construct (ProtParam)…",
  };
  return msgs[currentNode] || message || "Processing…";
}

// ── Single node pill ──────────────────────────────────────────────────────────

function NodePill({
  node,
  state,
}: {
  node: (typeof PIPELINE_NODES)[number];
  state: NodeState;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 min-w-0",
        state === "waiting" && "opacity-30",
        state === "done" && "opacity-50",
      )}
    >
      {/* Circle */}
      <div
        className={cn(
          "relative flex size-9 items-center justify-center rounded-full border-2 transition-all duration-300",
          state === "running"
            ? "border-foreground bg-foreground text-background shadow-sm"
            : state === "done"
              ? "border-foreground/40 bg-transparent text-foreground"
              : state === "error"
                ? "border-destructive bg-destructive/10 text-destructive"
                : "border-border bg-transparent text-muted-foreground",
        )}
      >
        {state === "running" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : state === "done" ? (
          <Check className="size-3.5" strokeWidth={2.5} />
        ) : state === "error" ? (
          <AlertTriangle className="size-3 " />
        ) : (
          <span className="font-mono text-[10px] font-semibold leading-none">
            {node.id}
          </span>
        )}

        {/* Active pulse ring */}
        {state === "running" && (
          <span className="absolute inset-0 rounded-full border-2 border-foreground/20 animate-ping" />
        )}
      </div>

      {/* Label */}
      <div className="text-center">
        <p
          className={cn(
            "font-mono text-[10px] font-semibold leading-tight",
            state === "running" ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {state !== "running" ? node.id : node.id}
        </p>
        <p className="text-[9px] text-muted-foreground leading-tight mt-0.5 max-w-[72px] truncate">
          {node.shortDesc}
        </p>
      </div>
    </div>
  );
}

// ── Connector line between nodes ──────────────────────────────────────────────

function Connector({ done }: { done: boolean }) {
  return (
    <div
      className={cn(
        "h-px flex-1 mt-4 transition-all duration-500",
        done ? "bg-foreground/30" : "bg-border",
      )}
    />
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
    <div className="space-y-6">
      {/* Node row with connectors */}
      <div className="flex items-start gap-0">
        {PIPELINE_NODES.map((node, i) => {
          const state = resolveState(node.id, currentNode, status);
          const prevDone = i > 0
            ? resolveState(PIPELINE_NODES[i - 1].id, currentNode, status) === "done"
            : false;
          return (
            <React.Fragment key={node.id}>
              {i > 0 && <Connector done={prevDone} />}
              <NodePill node={node} state={state} />
            </React.Fragment>
          );
        })}
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <Progress value={progress * 100} className="h-1" />
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {progressMessage(currentNode, status, message)}
          </p>
          <p className="font-mono text-xs tabular-nums text-muted-foreground">
            {Math.round(progress * 100)}%
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Idle grid - shown before any run starts ───────────────────────────────────

export function PipelineIdleGrid() {
  return (
    <div className="flex items-start justify-center gap-0 opacity-40">
      {PIPELINE_NODES.map((node, i) => (
        <React.Fragment key={node.id}>
          {i > 0 && <div className="h-px w-6 mt-4 bg-border" />}
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex size-8 items-center justify-center rounded-full border border-border">
              <span className="font-mono text-[10px] font-semibold text-muted-foreground">
                {node.id}
              </span>
            </div>
            <span className="font-mono text-[9px] text-muted-foreground">
              {node.shortDesc}
            </span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}