"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CoverageChart } from "@/components/coverage-chart";
import { EpitopeTable } from "@/components/epitope-table";
import { api } from "@/lib/api";
import { downloadCSV, downloadJSON } from "@/lib/export";
import type { PipelineResults, Candidate } from "@/types";

function fmt(s: number) { return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`; }

export default function ResultsPage() {
  const { runId } = useParams<{ runId: string }>();
  const router = useRouter();
  const [res, setRes] = useState<PipelineResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(0);

  useEffect(() => { if (runId) api.getResults(runId).then(setRes).catch(console.error).finally(() => setLoading(false)); }, [runId]);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!res) return <div className="text-center py-20"><p className="text-muted-foreground">Not found.</p><Button variant="outline" className="mt-4" onClick={() => router.push("/playground")}>Back</Button></div>;
  const c: Candidate = res.candidates[sel]; if (!c) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="flex items-center gap-3"><h2 className="text-2xl font-bold tracking-tight">{c.protein_name}</h2><Badge variant="outline" className="font-mono">{c.protein_id}</Badge></div><p className="text-sm text-muted-foreground mt-1">{c.sequence_length} residues · {fmt(res.timing.total_seconds)}</p></div>
        <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => downloadCSV(res.candidates, `kozi-${runId.slice(0, 8)}.csv`)}>CSV</Button><Button variant="outline" size="sm" onClick={() => downloadJSON(res, `kozi-${runId.slice(0, 8)}.json`)}>JSON</Button><Button size="sm" onClick={() => router.push("/playground")}>New Run</Button></div>
      </div>
      {res.candidates.length > 1 && <div className="flex gap-2">{res.candidates.map((x, i) => <Button key={x.protein_id} variant={sel === i ? "default" : "outline"} size="sm" onClick={() => setSel(i)}>{x.protein_name}</Button>)}</div>}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {[{ l: "CTL Epitopes", v: c.ctl_count, s: `${c.ctl_strong} strong` }, { l: "HTL Epitopes", v: c.htl_count }, { l: "B-Cell", v: c.bcell_count }, { l: "Global Coverage", v: `${c.global_coverage_pct.toFixed(1)}%` }, { l: "African Coverage", v: `${c.african_coverage_pct.toFixed(1)}%` }].map(m =>
          <Card key={m.l}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{m.l}</p><p className="text-2xl font-bold mt-1 tabular-nums">{m.v}</p>{m.s && <p className="text-xs text-muted-foreground">{m.s}</p>}</CardContent></Card>
        )}
      </div>
      <CoverageChart coverageDetail={c.coverage_detail} />
      <div><h3 className="text-lg font-semibold mb-3">Top Epitopes</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{c.epitopes.filter(e => e.confidence === "high").slice(0, 6).map((ep, i) =>
        <Card key={i}><CardContent className="p-4"><div className="flex items-start justify-between mb-2"><code className="font-mono text-sm font-medium tracking-widest">{ep.sequence}</code><Badge>{ep.epitope_type}</Badge></div><div className="text-xs text-muted-foreground space-y-1"><div className="flex justify-between"><span>HLA</span><span className="font-mono">{ep.hla_allele}</span></div>{ep.ic50_nm != null && <div className="flex justify-between"><span>IC50</span><span className="font-mono">{ep.ic50_nm.toFixed(1)} nM</span></div>}</div></CardContent></Card>
      )}</div></div>
      <EpitopeTable epitopes={c.epitopes} />
      <Card><CardHeader><CardTitle>Decision Audit Trail</CardTitle></CardHeader><CardContent><Accordion>{c.decisions.map((d, i) =>
        <AccordionItem key={i} value={`d-${i}`}><AccordionTrigger><div className="flex items-center gap-2"><Badge variant="outline" className="font-mono text-xs">{d.stage}</Badge>{d.decision}</div></AccordionTrigger><AccordionContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{d.reasoning}</p></AccordionContent></AccordionItem>
      )}</Accordion></CardContent></Card>
    </div>
  );
}
