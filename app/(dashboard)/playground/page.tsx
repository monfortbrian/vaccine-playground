"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { IconPlayerPlay, IconPlayerPause, IconPlayerStop } from "@tabler/icons-react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { PipelineNodes, PipelineIdleGrid } from "@/components/pipeline-nodes";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { InputType, PipelineStatusResponse } from "@/types";

const INPUT_TYPES: { value: InputType; label: string; desc: string }[] = [
  { value: "pathogen", label: "Pathogen", desc: "Search by organism name" },
  { value: "uniprot_id", label: "UniProt ID", desc: "Single protein accession" },
  { value: "sequence", label: "Sequence", desc: "Paste amino acid sequence" },
];

const PLACEHOLDERS: Record<InputType, string> = {
  pathogen: "e.g. Mycobacterium tuberculosis",
  uniprot_id: "e.g. P9WNK7",
  sequence: "MTEQQWNFAGIEAAASAIQ…",
};

function statusLabel(s: string) {
  if (s === "running" || s === "pending") return "Running";
  if (s === "paused") return "Paused";
  if (s === "cancelled") return "Stopped";
  if (s === "failed") return "Failed";
  return s;
}

export default function PlaygroundPage() {
  const router = useRouter();
  const { user } = useAuth();
  const displayName =
    user?.user_metadata?.name?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "Researcher";

  const [inputType, setInputType] = useState<InputType>("pathogen");
  const [inputValue, setInputValue] = useState("");
  const [proteinName, setProteinName] = useState("");
  const [maxProteins, setMaxProteins] = useState(3);
  const [runSafety, setRunSafety] = useState(true);
  const [runCoverage, setRunCoverage] = useState(true);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [ps, setPs] = useState<PipelineStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);

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
          setError(s.message || "Pipeline failed. Check API logs.");
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

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Hello, {displayName}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Analyze any pathogen, protein, or amino acid sequence.
          </p>
        </div>
        <Badge variant="outline" className="font-mono text-xs">TOPE_DEEP v2</Badge>
      </div>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">

        {/* Left: Input */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Input</CardTitle>
              <CardDescription>Select input type and configure parameters.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Type selector */}
              <div className="grid grid-cols-3 gap-2">
                {INPUT_TYPES.map((t) => (
                  <button
                    key={t.value} type="button" disabled={running}
                    onClick={() => { setInputType(t.value); setInputValue(""); setProteinName(""); }}
                    className={[
                      "flex flex-col items-center gap-1 rounded-lg border px-3 py-3 text-center",
                      "transition-all duration-150 cursor-pointer",
                      "disabled:opacity-40 disabled:cursor-not-allowed",
                      inputType === t.value
                        ? "border-foreground bg-foreground/5 text-foreground"
                        : "border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
                    ].join(" ")}
                  >
                    <span className="text-xs font-semibold">{t.label}</span>
                    <span className="text-[10px] leading-tight opacity-70">{t.desc}</span>
                  </button>
                ))}
              </div>

              <Separator />

              {/* Input field */}
              {inputType === "sequence" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Amino acid sequence</Label>
                    <Textarea
                      className="font-mono text-xs min-h-[120px] resize-none"
                      placeholder={PLACEHOLDERS.sequence}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      disabled={running} spellCheck={false}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Protein name{" "}
                      <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      placeholder="e.g. Spike glycoprotein"
                      value={proteinName}
                      onChange={(e) => setProteinName(e.target.value)}
                      disabled={running}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {inputType === "pathogen" ? "Pathogen name" : "UniProt accession"}
                  </Label>
                  <Input
                    placeholder={PLACEHOLDERS[inputType]}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    disabled={running}
                    className={inputType === "uniprot_id" ? "font-mono" : ""}
                    spellCheck={false}
                  />
                </div>
              )}

              {/* Max proteins */}
              {inputType === "pathogen" && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Proteins to analyze</Label>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Top surface-exposed candidates</p>
                      </div>
                      <span className="rounded-md bg-foreground text-background px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums">
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
                  </div>
                </>
              )}

              <Separator />

              {/* Toggles */}
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label className="text-sm font-medium">Safety screening</Label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Allergenicity &amp; toxicity</p>
                  </div>
                  <Switch checked={runSafety} onCheckedChange={setRunSafety} disabled={running} />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label className="text-sm font-medium">Population coverage</Label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">HLA coverage across 7 populations</p>
                  </div>
                  <Switch checked={runCoverage} onCheckedChange={setRunCoverage} disabled={running} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Run / Pause / Stop */}
          {!running ? (
            <Button className="w-full h-11 font-medium" onClick={handleRun} disabled={!inputValue.trim()}>
              <IconPlayerPlay className="size-4 mr-2" />
              Run Analysis
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-11" onClick={handlePause}>
                {paused
                  ? <><IconPlayerPlay className="size-4 mr-2" />Resume</>
                  : <><IconPlayerPause className="size-4 mr-2" />Pause</>}
              </Button>
              <Button variant="destructive" className="h-11" onClick={handleStop}>
                <IconPlayerStop className="size-4 mr-2" />Stop
              </Button>
            </div>
          )}
        </div>

        {/* Right: Pipeline */}
        <div className="flex flex-col gap-4">

          {/* Error */}
          {error && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="flex items-start gap-3 pt-5 pb-5">
                <div className="rounded-lg bg-destructive/10 p-2 shrink-0 mt-0.5">
                  <AlertTriangle className="size-4 text-destructive" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-destructive">Pipeline error</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{error}</p>
                  <code className="block rounded-md bg-muted px-3 py-2 text-xs font-mono mt-2">
                    uvicorn api.main:app --port 8000 --reload
                  </code>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Idle state */}
          {!running && !ps && !error && (
            <div className="rounded-xl border border-dashed flex flex-col items-center justify-center py-16 px-8 text-center gap-8">
              <div className="space-y-2">
                <h3 className="text-base font-semibold">Ready to analyze</h3>
                <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                  The 8-node pipeline runs from proteome curation through multi-epitope construct design.
                </p>
              </div>
              <PipelineIdleGrid />
            </div>
          )}

          {/* Active pipeline */}
          {ps && (
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">Pipeline Progress</CardTitle>
                    <CardDescription className="mt-1">
                      {ps.status === "paused" ? "Analysis paused." :
                        ps.status === "cancelled" ? "Analysis stopped by user." :
                          ps.status === "failed" ? "Analysis encountered an error." :
                            "Epitope prediction pipeline running - N1 through N8."}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant={
                        ps.status === "running" || ps.status === "pending" ? "default" :
                          ps.status === "paused" ? "secondary" :
                            ps.status === "cancelled" ? "outline" :
                              ps.status === "failed" ? "destructive" : "default"
                      }
                      className="text-xs"
                    >
                      {statusLabel(ps.status)}
                    </Badge>
                    <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                      {ps.run_id.slice(0, 8)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <PipelineNodes
                  currentNode={ps.current_node}
                  status={ps.status}
                  progress={ps.progress}
                  message={ps.message}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}