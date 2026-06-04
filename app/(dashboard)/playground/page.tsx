"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Play, Pause, Square, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { PipelineNodes, PipelineIdleGrid } from "@/components/pipeline-nodes";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { InputType, PipelineStatusResponse } from "@/types";

const INPUT_TYPES: { value: InputType; label: string; desc: string }[] = [
  { value: "pathogen",   label: "Pathogen",   desc: "Search by organism name" },
  { value: "uniprot_id", label: "UniProt ID", desc: "Single protein accession" },
  { value: "sequence",   label: "Sequence",   desc: "Paste amino acid sequence" },
];

const PLACEHOLDERS: Record<InputType, string> = {
  pathogen:   "e.g. Mycobacterium tuberculosis",
  uniprot_id: "e.g. P9WNK7",
  sequence:   "MTEQQWNFAGIEAAASAIQ…",
};

const NODE_STATUS_COPY: Record<string, string> = {
  N1: "Fetching protein sequences from UniProt…",
  N2: "Screening surface-exposed antigens via VaxiJen and Phobius…",
  N3: "Predicting T-cell epitopes via NetMHCpan 4.1 and NetMHCIIpan 4.3…",
  N4: "Predicting B-cell epitopes via BepiPred 2.0…",
  N5: "Retrieving 3D structures from AlphaFold DB…",
  N6: "Safety screening FAO/WHO allergenicity, HemoPI, human homology…",
  N7: "Calculating HLA population coverage across 7 populations…",
  N8: "Assembling multi-epitope construct via ProtParam…",
};

export default function PlaygroundPage() {
  const router = useRouter();
  const { user } = useAuth();
  const displayName =
    user?.user_metadata?.name?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "Researcher";

  const [inputType,   setInputType]   = useState<InputType>("pathogen");
  const [inputValue,  setInputValue]  = useState("");
  const [proteinName, setProteinName] = useState("");
  const [maxProteins, setMaxProteins] = useState(3);
  const [runSafety,   setRunSafety]   = useState(true);
  const [runCoverage, setRunCoverage] = useState(true);
  const [running,     setRunning]     = useState(false);
  const [paused,      setPaused]      = useState(false);
  const [ps,          setPs]          = useState<PipelineStatusResponse | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const [runId,       setRunId]       = useState<string | null>(null);

  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (poll.current) { clearInterval(poll.current); poll.current = null; }
  }, []);

  const startPolling = useCallback((id: string) => {
    stopPolling();
    poll.current = setInterval(async () => {
      try {
        const s = await api.getStatus(id);
        setPs(s);
        if (s.status === "completed") {
          stopPolling(); setRunning(false); setPaused(false);
          router.push(`/results/${id}`);
        } else if (s.status === "failed") {
          stopPolling(); setRunning(false); setPaused(false);
          setError(s.message || "Pipeline failed.");
        }
      } catch (e) { console.error(e); }
    }, 2000);
  }, [stopPolling, router]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const handleRun = async () => {
    if (!inputValue.trim()) return;
    setError(null); setRunning(true); setPaused(false); setPs(null);
    try {
      await supabase.auth.getSession();
      const body: Record<string, unknown> = {
        input_type: inputType, input_value: inputValue.trim(),
        run_safety: runSafety, run_coverage: runCoverage,
      };
      if (inputType === "pathogen") body.max_proteins = maxProteins;
      if (inputType === "sequence" && proteinName.trim()) body.protein_name = proteinName.trim();
      const r = await api.startRun(body);
      setRunId(r.run_id);
      setPs({
        run_id: r.run_id, status: "pending", current_node: null,
        progress: 0, message: "Queued…", started_at: null, completed_at: null,
      });
      startPolling(r.run_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start pipeline.");
      setRunning(false);
    }
  };

  const handlePause = () => {
    if (paused) {
      setPaused(false);
      if (runId) startPolling(runId);
      if (ps) setPs({ ...ps, status: "running" });
    } else {
      setPaused(true); stopPolling();
      if (ps) setPs({ ...ps, status: "paused" });
    }
  };

  const handleStop = () => {
    stopPolling(); setRunning(false); setPaused(false);
    if (ps) setPs({ ...ps, status: "cancelled", message: "Cancelled by user." });
  };

  const progressMessage = () => {
    if (!ps) return "";
    if (ps.status === "paused")    return "Analysis paused.";
    if (ps.status === "cancelled") return "Analysis stopped.";
    if (ps.status === "failed")    return ps.message || "Pipeline encountered an error.";
    if (ps.status === "completed") return "Analysis complete.";
    if (ps.current_node) return NODE_STATUS_COPY[ps.current_node] ?? ps.message;
    return ps.message || "Initializing…";
  };

  return (
    <div className="max-w-[1200px] space-y-8">

      {/* Page title */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Hello, {displayName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Analyze any pathogen, protein, or amino acid sequence through the N1 - N8 pipeline.
        </p>
      </div>

      {/* Main layout */}
      <div className="grid gap-8 lg:grid-cols-[380px_1fr]">

        {/* ── Left: Input configuration ──────────────────────────────── */}
        <div className="space-y-6">

          {/* Input type selector */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Input type
            </p>
            <div className="grid grid-cols-3 gap-2">
              {INPUT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  disabled={running}
                  onClick={() => { setInputType(t.value); setInputValue(""); setProteinName(""); }}
                  className={[
                    "flex flex-col items-start gap-0.5 rounded-xl border px-3.5 py-3",
                    "transition-all duration-150 text-left",
                    "disabled:opacity-40 disabled:cursor-not-allowed",
                    inputType === t.value
                      ? "border-foreground bg-foreground/[0.04] text-foreground"
                      : "border-border bg-transparent text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                  ].join(" ")}
                >
                  <span className="text-[13px] font-semibold">{t.label}</span>
                  <span className="text-[10px] leading-tight opacity-60">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Input field */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {inputType === "pathogen"   ? "Pathogen name" :
               inputType === "uniprot_id" ? "UniProt accession" : "Amino acid sequence"}
            </label>
            {inputType === "sequence" ? (
              <textarea
                className={[
                  "w-full rounded-xl border border-border bg-transparent px-4 py-3",
                  "font-mono text-xs leading-relaxed resize-none min-h-[120px]",
                  "placeholder:text-muted-foreground/50 text-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/40",
                  "disabled:opacity-40 transition-colors",
                ].join(" ")}
                placeholder={PLACEHOLDERS.sequence}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={running}
                spellCheck={false}
              />
            ) : (
              <input
                type="text"
                className={[
                  "w-full h-11 rounded-xl border border-border bg-transparent px-4",
                  "text-sm text-foreground placeholder:text-muted-foreground/50",
                  inputType === "uniprot_id" ? "font-mono" : "",
                  "focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/40",
                  "disabled:opacity-40 transition-colors",
                ].join(" ")}
                placeholder={PLACEHOLDERS[inputType]}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={running}
                spellCheck={false}
              />
            )}

            {/* Sequence: optional protein name */}
            {inputType === "sequence" && (
              <div className="space-y-2 pt-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Protein name <span className="normal-case font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  className={[
                    "w-full h-11 rounded-xl border border-border bg-transparent px-4",
                    "text-sm text-foreground placeholder:text-muted-foreground/50",
                    "focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/40",
                    "disabled:opacity-40 transition-colors",
                  ].join(" ")}
                  placeholder="e.g. Spike glycoprotein"
                  value={proteinName}
                  onChange={(e) => setProteinName(e.target.value)}
                  disabled={running}
                />
              </div>
            )}
          </div>

          {/* Pathogen: protein count slider */}
          {inputType === "pathogen" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Proteins to analyze
                </p>
                <span className="rounded-lg bg-foreground text-background px-2.5 py-1 font-mono text-xs font-semibold tabular-nums">
                  {maxProteins}
                </span>
              </div>
              <input
                type="range" min={1} max={10} step={1}
                value={maxProteins}
                onChange={(e) => setMaxProteins(Number(e.target.value))}
                disabled={running}
                className="w-full h-1.5 rounded-full cursor-pointer disabled:opacity-40 accent-foreground"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>1</span><span>5</span><span>10</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Top surface-exposed candidates, ranked by antigenicity score.
              </p>
            </div>
          )}

          {/* Options */}
          <div className="rounded-xl border border-border divide-y divide-border">
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Safety screening</p>
                <p className="text-[11px] text-muted-foreground">
                  FAO/WHO allergenicity · HemoPI · FDA/EMA homology
                </p>
              </div>
              <Switch checked={runSafety} onCheckedChange={setRunSafety} disabled={running} />
            </div>
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Population coverage</p>
                <p className="text-[11px] text-muted-foreground">
                  HLA coverage across 7 populations
                </p>
              </div>
              <Switch checked={runCoverage} onCheckedChange={setRunCoverage} disabled={running} />
            </div>
          </div>

          {/* Primary action */}
          <div className="space-y-2">
            {!running ? (
              <button
                type="button"
                onClick={handleRun}
                disabled={!inputValue.trim()}
                className={[
                  "w-full h-11 rounded-xl font-medium text-sm",
                  "flex items-center justify-center gap-2",
                  "transition-all duration-150",
                  inputValue.trim()
                    ? "bg-foreground text-background hover:bg-foreground/90"
                    : "bg-foreground/20 text-foreground/30 cursor-not-allowed",
                ].join(" ")}
              >
                <Play className="size-4" />
                Run Analysis
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handlePause}
                  className="h-11 rounded-xl border border-border bg-transparent text-sm font-medium flex items-center justify-center gap-2 hover:bg-accent transition-colors"
                >
                  {paused
                    ? <><Play className="size-4" />Resume</>
                    : <><Pause className="size-4" />Pause</>}
                </button>
                <button
                  type="button"
                  onClick={handleStop}
                  className="h-11 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm font-medium flex items-center justify-center gap-2 hover:bg-destructive/15 transition-colors"
                >
                  <Square className="size-4" />
                  Stop
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Pipeline status ──────────────────────────────────── */}
        <div>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5 flex items-start gap-3 mb-6">
              <div className="rounded-lg bg-destructive/10 p-1.5 shrink-0 mt-0.5">
                <AlertTriangle className="size-4 text-destructive" />
              </div>
              <div className="space-y-1 min-w-0">
                <p className="text-sm font-semibold text-destructive">Pipeline error</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {/* Idle */}
          {!running && !ps && !error && (
            <div className="h-full min-h-[320px] flex flex-col items-center justify-center gap-10 rounded-2xl border border-dashed border-border px-8 py-16 text-center">
              <div className="space-y-2">
                <h2 className="text-[15px] font-semibold">Ready to analyze</h2>
                <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                  Configure your input and run the 8-node pipeline from proteome curation to
                  multi-epitope construct design.
                </p>
              </div>
              <PipelineIdleGrid />
            </div>
          )}

          {/* Active run */}
          {ps && (
            <div className="rounded-2xl border border-border overflow-hidden">

              {/* Run header */}
              <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-border">
                <div className="space-y-1">
                  <h2 className="text-[15px] font-semibold">Pipeline progress</h2>
                  <p className="text-xs text-muted-foreground">
                    {ps.status === "paused"
                      ? "Analysis paused, results will be preserved."
                      : ps.status === "cancelled"
                      ? "Analysis stopped by user."
                      : ps.status === "failed"
                      ? "Pipeline encountered an error."
                      : "N1 through N8, epitope prediction and construct assembly."}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Status indicator */}
                  <span
                    className={[
                      "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium",
                      ps.status === "running" || ps.status === "pending"
                        ? "bg-foreground/8 text-foreground"
                        : ps.status === "failed"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted text-muted-foreground",
                    ].join(" ")}
                  >
                    {(ps.status === "running" || ps.status === "pending") && (
                      <span className="size-1.5 rounded-full bg-foreground animate-pulse" />
                    )}
                    {ps.status === "running" || ps.status === "pending" ? "Running" :
                     ps.status === "paused"    ? "Paused"   :
                     ps.status === "cancelled" ? "Stopped"  :
                     ps.status === "failed"    ? "Failed"   : ps.status}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground bg-muted rounded-md px-2 py-1">
                    {ps.run_id.slice(0, 8)}
                  </span>
                </div>
              </div>

              {/* Pipeline nodes */}
              <div className="px-6 py-6">
                <PipelineNodes
                  currentNode={ps.current_node}
                  status={ps.status}
                  progress={ps.progress}
                  message={progressMessage()}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}