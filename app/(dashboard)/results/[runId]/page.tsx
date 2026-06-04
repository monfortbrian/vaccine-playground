"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Download } from "lucide-react";
import { IconPlus } from "@tabler/icons-react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { CoverageChart } from "@/components/coverage-chart";
import { EpitopeTable } from "@/components/epitope-table";
import { StructureCard } from "@/components/structure-card";
import { ConstructCard } from "@/components/construct-card";
import { api } from "@/lib/api";
import { downloadCSV, downloadJSON } from "@/lib/export";
import type { PipelineResults, Candidate, Decision } from "@/types";

function fmt(s: number) {
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

function buildStructureProps(c: Candidate) {
  const d = (c.decisions ?? []).find((x: Decision) => x.stage === "structure_retrieval");
  return {
    protein_name:      c.protein_name,
    protein_id:        c.protein_id,
    structure_source:  c.structure_source ?? d?.structure_source ?? "unavailable",
    structure_pdb_url: c.structure_pdb_url ?? d?.cif_url ?? undefined,
    mean_plddt:        d?.mean_plddt,
    model_version:     d?.model_version,
    residue_range:     d?.fragment_coverage,
    entry_id:          d?.alphafold_entry_id,
  };
}

export default function ResultsPage() {
  const { runId } = useParams<{ runId: string }>();
  const router = useRouter();
  const [res, setRes] = useState<PipelineResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(0);

  useEffect(() => {
    if (runId)
      api.getResults(runId)
        .then(setRes)
        .catch(console.error)
        .finally(() => setLoading(false));
  }, [runId]);

  if (loading)
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    );

  if (!res)
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-5">
        <p className="text-sm text-muted-foreground text-center max-w-sm leading-relaxed">
          Results not found. The run may have expired or belongs to another account.
        </p>
        <button
          type="button"
          onClick={() => router.push("/history")}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium hover:bg-accent transition-colors"
        >
          <ChevronLeft className="size-4" />
          Back to History
        </button>
      </div>
    );

  const c: Candidate = res.candidates[sel];
  if (!c) return null;

  return (
    <div className="max-w-[1200px] space-y-8">

      {/* ── Top navigation bar ─────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => router.push("/history")}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors -ml-1"
        >
          <ChevronLeft className="size-4" />
          History
        </button>

        {/* Actions right side */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-border overflow-hidden divide-x divide-border">
            <button
              type="button"
              onClick={() => downloadCSV(res.candidates, runId)}
              className="inline-flex h-9 items-center gap-2 px-4 text-sm font-medium hover:bg-accent transition-colors"
            >
              <Download className="size-3.5" />
              CSV
            </button>
            <button
              type="button"
              onClick={() => downloadJSON(res, runId, res.candidates)}
              className="inline-flex h-9 items-center gap-2 px-4 text-sm font-medium hover:bg-accent transition-colors"
            >
              <Download className="size-3.5" />
              JSON
            </button>
          </div>
          <button
            type="button"
            onClick={() => router.push("/playground")}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-foreground text-background px-4 text-sm font-medium hover:bg-foreground/90 transition-colors"
          >
            <IconPlus className="size-3.5" />
            New run
          </button>
        </div>
      </div>

      {/* ── Protein header ─────────────────────────────────────────── */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{c.protein_name}</h1>
          <span className="font-mono text-sm text-muted-foreground bg-muted rounded-md px-2 py-0.5">
            {c.protein_id}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {c.sequence_length} residues
          {res.timing.total_seconds > 0 && (
            <> · completed in {fmt(res.timing.total_seconds)}</>
          )}
        </p>
      </div>

      {/* ── Protein selector (multi-protein runs) ──────────────────── */}
      {res.candidates.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {res.candidates.map((x, i) => (
            <button
              key={x.protein_id}
              type="button"
              onClick={() => setSel(i)}
              className={[
                "h-9 rounded-xl px-4 text-sm font-medium transition-colors",
                sel === i
                  ? "bg-foreground text-background"
                  : "border border-border hover:bg-accent",
              ].join(" ")}
            >
              {x.protein_name}
            </button>
          ))}
        </div>
      )}

      {/* ── Summary metrics ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: "CTL Epitopes",     value: c.ctl_count,  sub: `${c.ctl_strong} strong binders` },
          { label: "HTL Epitopes",     value: c.htl_count,  sub: undefined },
          { label: "B-Cell Epitopes",  value: c.bcell_count,sub: undefined },
          { label: "Global Coverage",  value: `${c.global_coverage_pct.toFixed(1)}%`, sub: "HLA population" },
          { label: "African Coverage", value: `${c.african_coverage_pct.toFixed(1)}%`, sub: "HLA population" },
        ].map((m) => (
          <div key={m.label} className="rounded-2xl border border-border bg-card p-4 space-y-1">
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
              {m.label}
            </p>
            <p className="text-3xl font-bold tabular-nums tracking-tight">{m.value}</p>
            {m.sub && (
              <p className="text-[11px] text-muted-foreground">{m.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* ── N5 Structure ───────────────────────────────────────────── */}
      <StructureCard structures={res.candidates.map(buildStructureProps)} />

      {/* ── Coverage chart ─────────────────────────────────────────── */}
      <CoverageChart coverageDetail={c.coverage_detail} />

      {/* ── High-confidence epitopes ───────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-baseline gap-3">
          <h2 className="text-[15px] font-semibold">High-Confidence Epitopes</h2>
          <p className="text-xs text-muted-foreground">top 6, IC50-ranked</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {c.epitopes
            .filter((e) => e.confidence === "high")
            .slice(0, 6)
            .map((ep, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-4 space-y-3">
                {/* Sequence + type */}
                <div className="flex items-start justify-between gap-2">
                  <code className="font-mono text-sm font-semibold tracking-widest leading-tight break-all">
                    {ep.sequence}
                  </code>
                  <span className="shrink-0 rounded-md bg-foreground/8 px-2 py-0.5 text-[10px] font-semibold text-foreground uppercase tracking-wide">
                    {ep.epitope_type}
                  </span>
                </div>
                {/* Data rows */}
                <div className="space-y-1.5 text-xs">
                  {ep.hla_allele && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">HLA</span>
                      <span className="font-mono font-medium">{ep.hla_allele}</span>
                    </div>
                  )}
                  {ep.ic50_nm != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">IC50</span>
                      <span className="font-mono font-medium tabular-nums">
                        {ep.ic50_nm.toFixed(1)} nM
                      </span>
                    </div>
                  )}
                  {/* Safety */}
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-muted-foreground">Safety</span>
                    <div className="flex gap-1">
                      {ep.allergenicity_safe === null && ep.toxicity_safe === null ? (
                        <span className="text-[10px] text-muted-foreground">Unscored</span>
                      ) : (
                        <>
                          {ep.allergenicity_safe != null && (
                            <span className={[
                              "rounded px-1.5 py-0.5 text-[10px] font-medium",
                              ep.allergenicity_safe
                                ? "bg-foreground/8 text-foreground"
                                : "bg-destructive/10 text-destructive",
                            ].join(" ")}>
                              {ep.allergenicity_safe ? "Safe" : "Allergenic"}
                            </span>
                          )}
                          {ep.toxicity_safe != null && (
                            <span className={[
                              "rounded px-1.5 py-0.5 text-[10px] font-medium",
                              ep.toxicity_safe
                                ? "bg-foreground/8 text-foreground"
                                : "bg-destructive/10 text-destructive",
                            ].join(" ")}>
                              {ep.toxicity_safe ? "Safe" : "Toxic"}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* ── Full epitope table ─────────────────────────────────────── */}
      <EpitopeTable epitopes={c.epitopes} />

      {/* ── N8 Construct ───────────────────────────────────────────── */}
      <ConstructCard report={res.construct_report ?? null} />

      {/* ── Decision audit trail ───────────────────────────────────── */}
      <section className="rounded-2xl border border-border overflow-hidden">
        <div className="px-6 py-5 border-b border-border">
          <h2 className="text-[15px] font-semibold">Decision Audit Trail</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Every pipeline decision, threshold, and tool version recorded.
          </p>
        </div>
        <div className="px-6 py-2">
          <Accordion defaultValue={[]}>
            {(c.decisions ?? []).map((d, i) => (
              <AccordionItem key={i} value={`d-${i}`} className="border-b last:border-0">
                <AccordionTrigger className="py-4 hover:no-underline">
                  <div className="flex items-center gap-3 text-left">
                    <span className="font-mono text-[10px] bg-muted text-muted-foreground rounded px-2 py-1 shrink-0">
                      {d.stage}
                    </span>
                    <span className="text-sm font-medium">{d.decision}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed pb-4">
                    {d.reasoning}
                  </p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ── Pipeline timing ────────────────────────────────────────── */}
      {res.timing.total_seconds > 0 && (
        <section className="rounded-2xl border border-border overflow-hidden">
          <div className="px-6 py-5 border-b border-border">
            <h2 className="text-[15px] font-semibold">Pipeline Timing</h2>
          </div>
          <div className="px-6 py-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Object.entries(res.timing)
                .filter(([k]) => k !== "total_seconds")
                .map(([k, v]) => (
                  <div key={k} className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {k.replace(/_/g, " ")}
                    </p>
                    <p className="text-sm font-mono font-semibold tabular-nums">
                      {fmt(v as number)}
                    </p>
                  </div>
                ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border flex items-baseline gap-2">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="font-mono text-sm font-semibold tabular-nums">
                {fmt(res.timing.total_seconds)}
              </p>
            </div>
          </div>
        </section>
      )}

    </div>
  );
}