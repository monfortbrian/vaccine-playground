"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft, ArrowUpRight, Check, ChevronRight,
  TableIcon, AreaChart, Copy, Search, Mail,
  ChevronDown, Clock, FileDown, Printer,
  AlertTriangle, Info, MoreHorizontal,
  ClipboardCopy, ScrollText,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectGroup, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { downloadCSV, downloadReportPDF } from "@/lib/export";
import type { PipelineResults, Candidate, Decision, Epitope, PipelineTiming } from "@/types";
import { cn } from "@/lib/utils";
import {
  AreaChart as RechartsArea, Area, XAxis, YAxis,
  CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
  ReferenceLine, Legend,
} from "recharts";

/* ══════════════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════════════ */

const POP_ORDER = ["global","african","east_african","european","east_asian","south_asian","americas"];
const PAGE_SIZE = 20;

const fmt = (s: number | null | undefined): string => {
  if (!s || s === 0) return "-";
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
};

function cleanProteinName(name: string): string {
  return name.replace(/\s*\([A-Z0-9]+\)\s*$/, "").trim();
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function inferStructureSource(d?: Decision): string {
  const src    = (d?.structure_source ?? "").toLowerCase();
  const reason = (d?.reasoning ?? "").toLowerCase();
  if (src.includes("chai")        || reason.includes("chai"))        return "Chai-1";
  if (src.includes("boltz")       || reason.includes("boltz"))       return "Boltz-2";
  if (src.includes("esmfold")     || reason.includes("esmfold"))     return "ESMFold";
  if (src.includes("rosettafold") || reason.includes("rosettafold")) return "RoseTTAFold";
  return "AlphaFold DB";
}

const AGENT_META: Record<string, { title: string; node: string; tool: string }> = {
  data_curation:      { title: "SEQUENCE INGESTOR",     node: "N1",  tool: "UniProt · NCBI"          },
  antigen_screening:  { title: "ANTIGENICITY SCREENER", node: "N2",  tool: "VaxiJen · Phobius"       },
  tcell_prediction:   { title: "MHC BINDING PREDICTOR", node: "N3",  tool: "NetMHCpan · IEDB"        },
  bcell_prediction:   { title: "LINEAR EPITOPE MAPPER", node: "N4",  tool: "BepiPred · ESM-2"        },
  structure_retrieval:{ title: "STRUCTURAL RESOLVER",   node: "N5",  tool: "AlphaFold DB"            },
  safety_filter:      { title: "IMMUNOSAFETY FILTER",   node: "N6",  tool: "AllerTOP · HemoPI"       },
  coverage_analysis:  { title: "POPULATION COVERAGE",   node: "N7",  tool: "IEDB · AFND 2020"        },
  construct_design:   { title: "CONSTRUCT ASSEMBLER",   node: "N8",  tool: "ProtParam · RS09"        },
  literature_search:  { title: "EVIDENCE RETRIEVER",    node: "N9",  tool: "PubMed · Qdrant · Claude"},
  experiment_planning:{ title: "VALIDATION ROADMAP",    node: "N10", tool: "Claude API"              },
};

const TIMING_STAGE_MAP: Record<string, string> = {
  n1_curation:   "data_curation",
  n2_screening:  "antigen_screening",
  n3_tcell:      "tcell_prediction",
  n4_bcell:      "bcell_prediction",
  n5_structure:  "structure_retrieval",
  n6_safety:     "safety_filter",
  n7_coverage:   "coverage_analysis",
  n8_construct:  "construct_design",
  n9_literature: "literature_search",
  n10_experiment:"experiment_planning",
};

function openGmailCompose(name: string, id: string, runId: string) {
  const sub  = encodeURIComponent(`TOPE_DEEP Results ${name} (${id})`);
  const body = encodeURIComponent(
    `Hi,\n\nTOPE_DEEP results for ${name} (UniProt: ${id}).\n\nRun ID: ${runId}\nLink: ${window.location.href}\n\nAll the way from TOPE_DEEP`
  );
  window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${sub}&body=${body}`, "_blank", "noopener,noreferrer");
}

/* ══════════════════════════════════════════════════════════════════════
   MOTION
══════════════════════════════════════════════════════════════════════ */

const fadeUp = {
  hidden:  { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.28, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] },
  }),
};

/* ══════════════════════════════════════════════════════════════════════
   PRIMITIVES
══════════════════════════════════════════════════════════════════════ */

function Pill({ sig, children }: { sig?: "green"|"amber"|"red"|"blue"|"neutral"; children: React.ReactNode }) {
  return (
    <span className={cn(
      "inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium tracking-wide",
      sig === "green"   && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      sig === "amber"   && "bg-amber-500/10   text-amber-700   dark:text-amber-400",
      sig === "red"     && "bg-red-500/10     text-red-700     dark:text-red-400",
      sig === "blue"    && "bg-blue-500/10    text-blue-700    dark:text-blue-400",
      (!sig || sig === "neutral") && "bg-muted text-muted-foreground",
    )}>
      {children}
    </span>
  );
}

function Card({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <div id={id} className={cn(
      "rounded-lg bg-card border border-border/20",
      "shadow-[0_1px_4px_0_rgb(0_0_0/0.06)]",
      "dark:shadow-[0_1px_4px_0_rgb(0_0_0/0.25),0_0_0_1px_rgba(255,255,255,0.03)]",
      className,
    )}>
      {children}
    </div>
  );
}

function Section({ id, title, subtitle, action, children, className, motionIndex = 0 }: {
  id?: string; title: string; subtitle?: string; action?: React.ReactNode;
  children: React.ReactNode; className?: string; motionIndex?: number;
}) {
  return (
    <motion.div custom={motionIndex} initial="hidden" animate="visible" variants={fadeUp}>
      <Card id={id} className={cn("overflow-hidden", className)}>
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border/20">
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold tracking-wide uppercase text-foreground leading-tight">
              {title}
            </h2>
            {subtitle && <p className="text-[13px] text-muted-foreground mt-0.5 leading-snug">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
        {children}
      </Card>
    </motion.div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2">
      <Info className="size-4 text-muted-foreground/30" />
      <p className="text-[13px] text-muted-foreground">{message}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   KPI STRIP
══════════════════════════════════════════════════════════════════════ */

function Stat({ label, value, sub, badge, sig }: {
  label: string; value: string; sub?: string; badge?: string;
  sig?: "green"|"amber"|"red"|"neutral";
}) {
  const pillCls =
    sig === "green" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" :
    sig === "amber" ? "bg-amber-500/10   text-amber-700   dark:text-amber-400"   :
    sig === "red"   ? "bg-red-500/10     text-red-700     dark:text-red-400"     :
                      "bg-muted text-muted-foreground";
  return (
    <div className="flex flex-col gap-3 px-6 py-6">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest leading-none">
        {label}
      </p>
      <p className="text-[32px] font-bold tabular-nums tracking-tight leading-none text-foreground">
        {value}
      </p>
      <div className="flex items-center gap-2">
        {sub   && <p className="text-[13px] text-muted-foreground leading-none">{sub}</p>}
        {badge && sig && (
          <span className={cn("inline-flex items-center h-5 px-1.5 rounded text-[11px] font-medium leading-none", pillCls)}>
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

function KPIStrip({ c }: { c: Candidate }) {
  const highCTL  = c.ctl_strong ?? 0;
  const totalCTL = c.ctl_count ?? 0;
  const african  = c.african_coverage_pct ?? 0;
  const eps      = c.epitopes ?? [];
  const safe     = eps.filter(e => e.allergenicity_safe && e.toxicity_safe).length;
  const failed   = eps.filter(e => e.allergenicity_safe === false || e.toxicity_safe === false).length;

  return (
    <motion.div custom={0} initial="hidden" animate="visible" variants={fadeUp}>
      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-3">
          {[
            {
              label: "CTL CLEARED", value: String(highCTL),
              sub: `of ${totalCTL} epitopes`,
              badge: highCTL >= 6 ? "Synthesis ready" : highCTL >= 3 ? "Review" : "Insufficient",
              sig:   highCTL >= 6 ? "green" : highCTL >= 3 ? "amber" : "red",
            },
            {
              label: "AFRICAN COVERAGE", value: `${african.toFixed(1)}%`,
              sub: "Sub-Saharan Africa",
              badge: african >= 75 ? "Target met" : african >= 60 ? "Near target" : "Below target",
              sig:   african >= 75 ? "green" : african >= 60 ? "amber" : "red",
            },
            {
              label: "SAFETY", value: `${safe}/${eps.length}`,
              sub: "safe epitopes",
              badge: failed > 0 ? `${failed} failed` : "All cleared",
              sig:   failed > 0 ? "red" : "green",
            },
          ].map((s, i) => (
            <div key={s.label} className="relative">
              {i > 0 && <span aria-hidden className="absolute left-0 top-[15%] h-[70%] w-px bg-border/25 hidden sm:block" />}
              {i > 0 && <span aria-hidden className="block sm:hidden h-px w-[70%] mx-auto bg-border/25" />}
              <Stat {...s as any} />
            </div>
          ))}
        </div>
      </Card>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   STRUCTURE SUMMARY CARD (top-right panel)
══════════════════════════════════════════════════════════════════════ */

function StructureSummaryCard({ c }: { c: Candidate }) {
  const d         = (c.decisions ?? []).find(x => x.stage === "structure_retrieval");
  const uid       = c.protein_id;
  const plddt     = d?.mean_plddt as number | undefined;
  const molstarUrl= `https://molstar.org/viewer/?afdb=${uid}&hide-controls=1&bg-color=10,10,10`;
  const pSig      = (plddt ?? 0) >= 90 ? "green" : (plddt ?? 0) >= 70 ? "amber" : "red";

  const handleExplore = useCallback(() => {
    document.getElementById("structure-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <motion.div custom={1} initial="hidden" animate="visible" variants={fadeUp} className="h-full">
      <Card className="flex flex-col overflow-hidden h-full">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/20 shrink-0">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">3D STRUCTURE</p>
          <div className="flex items-center gap-3">
            {plddt !== undefined && <Pill sig={pSig}>pLDDT {plddt.toFixed(1)}</Pill>}
            <button type="button" onClick={handleExplore}
              className="flex items-center gap-1 text-[13px] text-blue-500 hover:text-blue-400 transition-colors font-medium">
              Explore <ArrowUpRight className="size-3" strokeWidth={1.75} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden bg-[#0a0a0a] min-h-[300px]">
          <iframe title={`3D structure - ${uid}`} src={molstarUrl}
            className="w-full h-full border-0" allow="fullscreen" loading="lazy" />
        </div>
      </Card>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   POPULATION COVERAGE
══════════════════════════════════════════════════════════════════════ */

function CoverageSection({ detail }: { detail: Record<string, any> | undefined }) {
  const [view, setView] = useState<"table"|"area">("table");

  if (!detail) return (
    <Section title="POPULATION COVERAGE" subtitle="HLA coverage across 7 populations" motionIndex={2}>
      <Empty message="No coverage data for this run." />
    </Section>
  );

  const rows = POP_ORDER.filter(k => detail[k]).map(k => {
    const d = detail[k];
    return {
      key: k, label: d.population_label ?? k,
      mhci: +(d.mhc_i_pct ?? 0).toFixed(1),
      mhcii: +(d.mhc_ii_pct ?? 0).toFixed(1),
      combined: +(d.combined_pct ?? 0).toFixed(1),
      primary: k === "african" || k === "east_african",
    };
  });

  const toggle = (
    <div className="flex items-center rounded border border-border/20 bg-muted/30 p-0.5 gap-0.5">
      {(["table","area"] as const).map(v => (
        <button key={v} type="button" onClick={() => setView(v)}
          className={cn(
            "flex items-center gap-1.5 h-7 rounded px-3 text-[13px] font-medium transition-all",
            view === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}>
          {v === "table" ? <TableIcon className="size-3" strokeWidth={1.5} /> : <AreaChart className="size-3" strokeWidth={1.5} />}
          {v === "table" ? "Table" : "Chart"}
        </button>
      ))}
    </div>
  );

  return (
    <Section title="POPULATION COVERAGE" subtitle="HLA coverage · IEDB · 80% global target" action={toggle} motionIndex={2}>
      {view === "table" && (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border/20 bg-muted/20">
                {["Region","MHC-I","MHC-II","Combined"].map(h => (
                  <th key={h} className={cn(
                    "px-5 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-widest",
                    h === "Region" ? "text-left" : "text-right",
                  )}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.key} className="border-b border-border/20 last:border-0 hover:bg-muted/10 transition-colors">
                  <td className="px-5 py-3 font-medium text-[13px]">
                    <span className="flex items-center gap-2">
                      {r.label}
                      {r.primary && <Pill sig="green">Primary</Pill>}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-[13px] tabular-nums text-muted-foreground">{r.mhci}%</td>
                  <td className="px-5 py-3 text-right font-mono text-[13px] tabular-nums text-muted-foreground">{r.mhcii}%</td>
                  <td className={cn(
                    "px-5 py-3 text-right font-mono text-[13px] tabular-nums font-semibold",
                    r.combined >= 75 ? "text-emerald-600 dark:text-emerald-400" :
                    r.combined >= 60 ? "text-amber-600 dark:text-amber-400"    : "text-red-600 dark:text-red-400",
                  )}>{r.combined}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {view === "area" && (
        <div className="px-5 py-5">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsArea data={rows} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  tickLine={false} axisLine={false} height={36} interval={0} />
                <YAxis domain={[0, 105]} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  tickFormatter={v => v > 100 ? "" : `${v}%`}
                  tickLine={false} axisLine={false} width={40} ticks={[0,25,50,75,100]} />
                <RTooltip formatter={(v: number, n: string) => [`${v}%`, n]}
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "13px" }} />
                <Legend wrapperStyle={{ fontSize: "13px", paddingTop: "12px" }} />
                <ReferenceLine y={80} stroke="var(--muted-foreground)" strokeDasharray="5 3" strokeWidth={1} />
                <Area type="monotone" dataKey="mhci"     name="MHC-I"    stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.08} strokeWidth={1.5} dot={{ r: 3, fill: "var(--chart-1)" }} />
                <Area type="monotone" dataKey="mhcii"    name="MHC-II"   stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.08} strokeWidth={1.5} dot={{ r: 3, fill: "var(--chart-2)" }} />
                <Area type="monotone" dataKey="combined" name="Combined" stroke="var(--chart-3)" fill="var(--chart-3)" fillOpacity={0.10} strokeWidth={2}   dot={{ r: 3, fill: "var(--chart-3)" }} />
              </RechartsArea>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Section>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   EPITOPES TABLE
══════════════════════════════════════════════════════════════════════ */

function EpitopeTable({ epitopes }: { epitopes: Epitope[] }) {
  const [search,     setSearch]     = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [confFilter, setConfFilter] = useState("all");
  const [hlaFilter,  setHlaFilter]  = useState("all");
  const [page,       setPage]       = useState(1);
  const [sortKey,    setSortKey]    = useState<"ic50_nm"|"confidence"|"">("");
  const [sortAsc,    setSortAsc]    = useState(true);

  const types = ["all", ...Array.from(new Set(epitopes.map(e => e.epitope_type).filter(Boolean)))];
  const hlas  = ["all", ...Array.from(new Set(epitopes.map(e => e.hla_allele).filter(Boolean))).slice(0, 20)];
  const confs = ["all","high","medium","low"];

  let filtered = epitopes.filter(e => {
    if (search && !e.sequence.toLowerCase().includes(search.toLowerCase()) && !(e.hla_allele ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== "all" && e.epitope_type !== typeFilter) return false;
    if (confFilter !== "all" && e.confidence   !== confFilter) return false;
    if (hlaFilter  !== "all" && e.hla_allele   !== hlaFilter)  return false;
    return true;
  });

  if (sortKey === "ic50_nm")    filtered = [...filtered].sort((a, b) => sortAsc ? (a.ic50_nm ?? 999) - (b.ic50_nm ?? 999) : (b.ic50_nm ?? 0) - (a.ic50_nm ?? 0));
  if (sortKey === "confidence") {
    const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
    filtered = [...filtered].sort((a, b) => sortAsc ? (rank[a.confidence] ?? 3) - (rank[b.confidence] ?? 3) : (rank[b.confidence] ?? 3) - (rank[a.confidence] ?? 3));
  }

  const pages   = Math.ceil(filtered.length / PAGE_SIZE);
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (k: typeof sortKey) => {
    if (sortKey === k) setSortAsc(!sortAsc); else { setSortKey(k); setSortAsc(true); }
    setPage(1);
  };

  const SortBtn = ({ k, label }: { k: typeof sortKey; label: string }) => (
    <button type="button" onClick={() => toggleSort(k)} className="flex items-center gap-0.5 hover:text-foreground transition-colors">
      {label}<span className="text-[9px] ml-0.5 opacity-50">{sortKey === k ? (sortAsc ? "↑" : "↓") : "↕"}</span>
    </button>
  );

  return (
    <Section
      title="EPITOPES"
      subtitle={`${filtered.length} of ${epitopes.length} epitopes`}
      motionIndex={3}
      action={
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" strokeWidth={1.5} />
            <input type="text" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Sequence or HLA…"
              className="h-8 rounded border border-border/30 bg-muted/30 pl-8 pr-3 text-[13px] placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring/30 w-[148px] transition-all"
            />
          </div>
          <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(1); }}>
            <SelectTrigger size="sm" className="h-8 w-[110px] border-border/30 bg-muted/30 text-[13px]">
              <SelectValue placeholder="All Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>{types.map(o => <SelectItem key={o} value={o}>{o === "all" ? "All Type" : o}</SelectItem>)}</SelectGroup>
            </SelectContent>
          </Select>
          <Select value={confFilter} onValueChange={v => { setConfFilter(v); setPage(1); }}>
            <SelectTrigger size="sm" className="h-8 w-[130px] border-border/30 bg-muted/30 text-[13px]">
              <SelectValue placeholder="All Confidence" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>{confs.map(o => <SelectItem key={o} value={o}>{o === "all" ? "All Confidence" : o.charAt(0).toUpperCase() + o.slice(1)}</SelectItem>)}</SelectGroup>
            </SelectContent>
          </Select>
          <Select value={hlaFilter} onValueChange={v => { setHlaFilter(v); setPage(1); }}>
            <SelectTrigger size="sm" className="h-8 w-[120px] border-border/30 bg-muted/30 text-[13px]">
              <SelectValue placeholder="All HLA" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>{hlas.map(o => <SelectItem key={o} value={o}>{o === "all" ? "All HLA" : o}</SelectItem>)}</SelectGroup>
            </SelectContent>
          </Select>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border/20 bg-muted/20">
              {[
                { label: "Sequence",     cls: "text-left"  },
                { label: "Type",         cls: "text-left"  },
                { label: "HLA Allele",   cls: "text-left"  },
                { label: "IC50 (nM)",    cls: "text-right", sort: "ic50_nm"    as const },
                { label: "Confidence",   cls: "text-left",  sort: "confidence" as const },
                { label: "Allergenicity",cls: "text-left"  },
                { label: "Toxicity",     cls: "text-left"  },
              ].map(h => (
                <th key={h.label} className={cn("px-4 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-widest", h.cls)}>
                  {h.sort ? <SortBtn k={h.sort} label={h.label} /> : h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan={7} className="py-10"><Empty message="No epitopes match the current filters." /></td></tr>
            ) : visible.map((ep, i) => (
              <tr key={i} className="border-b border-border/20 last:border-0 hover:bg-muted/10 transition-colors">
                <td className="px-4 py-2.5 font-mono text-[13px] tracking-wider">{ep.sequence}</td>
                <td className="px-4 py-2.5"><Pill sig="neutral">{ep.epitope_type}</Pill></td>
                <td className="px-4 py-2.5 font-mono text-[13px] text-muted-foreground">{ep.hla_allele ?? "-"}</td>
                <td className="px-4 py-2.5 text-right font-mono text-[13px] tabular-nums">{ep.ic50_nm != null ? ep.ic50_nm.toFixed(1) : "-"}</td>
                <td className="px-4 py-2.5">
                  <span className={cn("text-[13px] font-medium capitalize",
                    ep.confidence === "high"   ? "text-emerald-600 dark:text-emerald-400" :
                    ep.confidence === "medium" ? "text-amber-600   dark:text-amber-400"   : "text-muted-foreground",
                  )}>{ep.confidence}</span>
                </td>
                <td className="px-4 py-2.5">
                  {ep.allergenicity_safe === null ? <span className="text-[13px] text-muted-foreground">-</span>
                    : ep.allergenicity_safe ? <Check className="size-3.5 text-emerald-500" strokeWidth={2} />
                      : <Pill sig="red">Allergenic</Pill>}
                </td>
                <td className="px-4 py-2.5">
                  {ep.toxicity_safe === null ? <span className="text-[13px] text-muted-foreground">-</span>
                    : ep.toxicity_safe ? <Check className="size-3.5 text-emerald-500" strokeWidth={2} />
                      : <Pill sig="red">Toxic</Pill>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-border/20 bg-muted/10">
          <p className="text-[13px] text-muted-foreground">{(page-1)*PAGE_SIZE+1} - {Math.min(page*PAGE_SIZE, filtered.length)} of {filtered.length}</p>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
              className="flex size-7 items-center justify-center rounded border border-border/20 disabled:opacity-30 hover:bg-accent transition-colors">
              <ChevronLeft className="size-3.5" strokeWidth={1.5} />
            </button>
            {Array.from({ length: Math.min(5, pages) }, (_, i) => {
              const n = page <= 3 ? i+1 : page >= pages-2 ? pages-4+i : page-2+i;
              if (n < 1 || n > pages) return null;
              return (
                <button key={n} type="button" onClick={() => setPage(n)}
                  className={cn("flex size-7 items-center justify-center rounded text-[13px] transition-colors",
                    page === n ? "bg-foreground text-background font-medium" : "border border-border/20 hover:bg-accent")}>
                  {n}
                </button>
              );
            })}
            <button type="button" onClick={() => setPage(p => Math.min(pages, p+1))} disabled={page===pages}
              className="flex size-7 items-center justify-center rounded border border-border/20 disabled:opacity-30 hover:bg-accent transition-colors">
              <ChevronRight className="size-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   STRUCTURE SECTION
══════════════════════════════════════════════════════════════════════ */

function StructureSection({ c }: { c: Candidate }) {
  const d      = (c.decisions ?? []).find(x => x.stage === "structure_retrieval");
  const uid    = c.protein_id;
  const plddt  = d?.mean_plddt as number | undefined;
  const ver    = d?.model_version ?? "v4";
  const range  = d?.fragment_coverage ?? `1 - ${c.sequence_length}`;
  const entry  = d?.alphafold_entry_id ?? `AF-${uid}-F1`;
  const seq    = c.sequence ?? "";
  const source = inferStructureSource(d);
  const molUrl = `https://molstar.org/viewer/?afdb=${uid}&bg-color=10,10,10`;
  const pSig   = (plddt ?? 0) >= 90 ? "green" : (plddt ?? 0) >= 70 ? "amber" : "red";
  const [copied, setCopied] = useState(false);

  return (
    <Section id="structure-section" title="STRUCTURAL RESOLVER" subtitle={`${source} · EBI database`} motionIndex={4}>
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border/20 border-b border-border/20 bg-muted/10">
        {[
          { label: "Source",        value: source },
          { label: "Residue range", value: range },
          { label: "Entry ID",      value: entry },
          { label: "Mean pLDDT",    value: plddt != null ? `${plddt.toFixed(1)} / 100` : "-", sig: pSig },
        ].map(m => (
          <div key={m.label} className="px-5 py-3.5">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-1">{m.label}</p>
            <p className={cn("text-[13px] font-medium font-mono",
              m.sig === "green" ? "text-emerald-600 dark:text-emerald-400" :
              m.sig === "amber" ? "text-amber-600   dark:text-amber-400"   :
              m.sig === "red"   ? "text-red-600     dark:text-red-400"     : "text-foreground",
            )}>{m.value}</p>
          </div>
        ))}
      </div>
      {seq && (
        <div className="border-b border-border/20">
          <Accordion type="single" collapsible>
            <AccordionItem value="seq" className="border-0">
              <AccordionTrigger className="px-5 py-3.5 text-[13px] font-medium hover:no-underline hover:bg-muted/10 transition-colors">
                Amino acid sequence ({c.sequence_length} residues)
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-4">
                <div className="relative">
                  <pre className="font-mono text-[13px] leading-relaxed text-muted-foreground bg-muted/20 rounded p-4 overflow-x-auto whitespace-pre-wrap break-all">
                    {seq.match(/.{1,60}/g)?.join("\n") ?? seq}
                  </pre>
                  <button type="button"
                    onClick={() => { copyToClipboard(seq); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                    className="absolute top-2 right-2 flex items-center gap-1.5 h-7 rounded border border-border/20 bg-background px-2.5 text-[13px] font-medium hover:bg-accent transition-colors">
                    <Copy className="size-3" strokeWidth={1.5} />{copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}
      <div className="bg-[#0a0a0a] h-[560px] w-full">
        <iframe title={`Structure viewer - ${uid}`} src={molUrl}
          className="w-full h-full border-0" allow="fullscreen" loading="lazy" />
      </div>
    </Section>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   T-CELL
══════════════════════════════════════════════════════════════════════ */

function TCellSection({ c }: { c: Candidate }) {
  const ctl = (c.epitopes ?? []).filter(e => e.epitope_type === "CTL");
  return (
    <Section title="MHC BINDING PREDICTOR" subtitle="NetMHCpan 4.1 · NetMHCIIpan 4.3 · MHCflurry fallback" motionIndex={5}>
      <div className="grid grid-cols-3 divide-x divide-border/20 border-b border-border/20 bg-muted/10">
        {[
          { label: "CTL EPITOPES",    value: c.ctl_count ?? 0,  sub: `${c.ctl_strong ?? 0} strong binders` },
          { label: "HTL EPITOPES",    value: c.htl_count ?? 0,  sub: "MHC-II" },
          { label: "HIGH CONFIDENCE", value: (c.epitopes ?? []).filter(e => e.confidence === "high").length, sub: "IC50 < 50 nM" },
        ].map(m => (
          <div key={m.label} className="px-5 py-4">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">{m.label}</p>
            <p className="text-2xl font-bold tabular-nums mt-1.5">{m.value}</p>
            <p className="text-[13px] text-muted-foreground mt-0.5">{m.sub}</p>
          </div>
        ))}
      </div>
      {ctl.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-border/20 bg-muted/20">
              {["Sequence","HLA Allele","IC50 (nM)","Confidence","Allergenicity","Toxicity"].map(h => (
                <th key={h} className="px-4 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-widest text-left">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {ctl.slice(0, 10).map((ep, i) => (
                <tr key={i} className="border-b border-border/20 last:border-0 hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-[13px]">{ep.sequence}</td>
                  <td className="px-4 py-2.5 font-mono text-[13px] text-muted-foreground">{ep.hla_allele ?? "-"}</td>
                  <td className="px-4 py-2.5 font-mono text-[13px] tabular-nums">{ep.ic50_nm != null ? ep.ic50_nm.toFixed(1) : "-"}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn("text-[13px] font-medium capitalize",
                      ep.confidence === "high" ? "text-emerald-600 dark:text-emerald-400" :
                      ep.confidence === "medium" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
                    )}>{ep.confidence}</span>
                  </td>
                  <td className="px-4 py-2.5">{ep.allergenicity_safe == null ? "-" : ep.allergenicity_safe ? <Check className="size-3.5 text-emerald-500" strokeWidth={2} /> : <Pill sig="red">Flagged</Pill>}</td>
                  <td className="px-4 py-2.5">{ep.toxicity_safe == null ? "-" : ep.toxicity_safe ? <Check className="size-3.5 text-emerald-500" strokeWidth={2} /> : <Pill sig="red">Flagged</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty message="No CTL epitopes predicted for this protein." />}
    </Section>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   B-CELL
══════════════════════════════════════════════════════════════════════ */

function BCellSection({ c }: { c: Candidate }) {
  const bcell = (c.epitopes ?? []).filter(e => e.epitope_type === "B-cell");
  return (
    <Section title="LINEAR EPITOPE MAPPER" subtitle="BepiPred 2.0 · linear B-cell epitope prediction" motionIndex={6}>
      <div className="grid grid-cols-2 divide-x divide-border/20 border-b border-border/20 bg-muted/10">
        <div className="px-5 py-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">B-CELL EPITOPES</p>
          <p className="text-2xl font-bold tabular-nums mt-1.5">{c.bcell_count ?? bcell.length}</p>
          <p className="text-[13px] text-muted-foreground mt-0.5">BepiPred score ≥ 0.5</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">RABBIT VALIDATION</p>
          <p className="text-[13px] font-medium mt-1.5">{bcell.some((e: any) => e.rabbit_validation) ? "Flagged for validation" : "Not flagged"}</p>
          <p className="text-[13px] text-muted-foreground mt-0.5">Experimental model flag</p>
        </div>
      </div>
      {bcell.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-border/20 bg-muted/20">
              {["Sequence","Score","Rabbit model","Safety"].map(h => (
                <th key={h} className="px-4 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-widest text-left">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {bcell.slice(0, 10).map((ep: any, i) => (
                <tr key={i} className="border-b border-border/20 last:border-0 hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-[13px]">{ep.sequence}</td>
                  <td className="px-4 py-2.5 font-mono text-[13px] tabular-nums">{ep.bepipred_score != null ? ep.bepipred_score.toFixed(3) : "-"}</td>
                  <td className="px-4 py-2.5">{ep.rabbit_validation ? <Pill sig="blue">Recommended</Pill> : <span className="text-muted-foreground">-</span>}</td>
                  <td className="px-4 py-2.5">{ep.allergenicity_safe && ep.toxicity_safe ? <Check className="size-3.5 text-emerald-500" strokeWidth={2} /> : <Pill sig="amber">Review</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty message="No B-cell epitopes predicted for this protein." />}
    </Section>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   SAFETY FILTER
══════════════════════════════════════════════════════════════════════ */

function SafetySection({ c }: { c: Candidate }) {
  const eps = c.epitopes ?? [];
  const [verdictFilter, setVerdictFilter] = useState<"all"|"safe"|"failed"|"unscored">("all");
  const [typeFilter,    setTypeFilter]    = useState("all");
  const [safetySearch,  setSafetySearch]  = useState("");

  const types    = ["all", ...Array.from(new Set(eps.map(e => e.epitope_type).filter(Boolean)))];
  const safe     = eps.filter(e => e.allergenicity_safe && e.toxicity_safe).length;
  const unscored = eps.filter(e => e.allergenicity_safe === null && e.toxicity_safe === null).length;
  const failed   = eps.length - safe - unscored;

  const filtered = eps.filter(ep => {
    const isSafe     = ep.allergenicity_safe && ep.toxicity_safe;
    const isUnscored = ep.allergenicity_safe === null && ep.toxicity_safe === null;
    const isFailed   = !isSafe && !isUnscored;
    if (verdictFilter === "safe"     && !isSafe)     return false;
    if (verdictFilter === "failed"   && !isFailed)   return false;
    if (verdictFilter === "unscored" && !isUnscored) return false;
    if (typeFilter !== "all" && ep.epitope_type !== typeFilter) return false;
    if (safetySearch && !ep.sequence.toLowerCase().includes(safetySearch.toLowerCase())) return false;
    return true;
  });

  return (
    <Section title="IMMUNOSAFETY FILTER" subtitle="WHO allergenicity · AllerTOP · HemoPI · human homology" motionIndex={7}>
      <div className="grid grid-cols-3 divide-x divide-border/20 border-b border-border/20 bg-muted/10">
        {[
          { label: "SAFE",     value: safe,     sig: "green"  as const },
          { label: "UNSCORED", value: unscored, sig: "neutral" as const },
          { label: "FAILED",   value: failed,   sig: failed > 0 ? "red" as const : "neutral" as const },
        ].map(m => (
          <button key={m.label} type="button"
            onClick={() => setVerdictFilter(verdictFilter === m.label.toLowerCase() ? "all" : m.label.toLowerCase() as any)}
            className={cn("px-5 py-4 text-left transition-colors hover:bg-muted/10", verdictFilter === m.label.toLowerCase() && "bg-muted/20")}>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">{m.label}</p>
            <p className={cn("text-2xl font-bold tabular-nums mt-1.5",
              m.sig === "green" ? "text-emerald-600 dark:text-emerald-400" :
              m.sig === "red"   ? "text-red-600     dark:text-red-400"     : "text-foreground",
            )}>{m.value}</p>
            {verdictFilter === m.label.toLowerCase() && <p className="text-[13px] text-muted-foreground mt-1">Click to clear</p>}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border/20 bg-muted/5">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" strokeWidth={1.5} />
          <input type="text" value={safetySearch} onChange={e => setSafetySearch(e.target.value)}
            placeholder="Search sequence…"
            className="h-8 rounded border border-border/30 bg-muted/30 pl-8 pr-3 text-[13px] placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring/30 w-[148px]"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger size="sm" className="h-8 w-[110px] border-border/30 bg-muted/30 text-[13px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>{types.map(o => <SelectItem key={o} value={o}>{o === "all" ? "All types" : o}</SelectItem>)}</SelectGroup>
          </SelectContent>
        </Select>
        <p className="text-[13px] text-muted-foreground ml-auto">{filtered.length} of {eps.length}</p>
      </div>
      {eps.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-border/20 bg-muted/20">
              {["Sequence","Type","Allergenicity","Toxicity","Homology","Verdict"].map(h => (
                <th key={h} className="px-4 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-widest text-left">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="py-10"><Empty message="No epitopes match filters." /></td></tr>
              ) : filtered.slice(0, 20).map((ep, i) => {
                const allSafe = ep.allergenicity_safe !== false && ep.toxicity_safe !== false;
                return (
                  <tr key={i} className="border-b border-border/20 last:border-0 hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-[13px]">{ep.sequence}</td>
                    <td className="px-4 py-2.5"><Pill sig="neutral">{ep.epitope_type}</Pill></td>
                    <td className="px-4 py-2.5">{ep.allergenicity_safe == null ? <span className="text-muted-foreground">-</span> : ep.allergenicity_safe ? <Check className="size-3.5 text-emerald-500" strokeWidth={2} /> : <Pill sig="red">Flagged</Pill>}</td>
                    <td className="px-4 py-2.5">{ep.toxicity_safe == null ? <span className="text-muted-foreground">-</span> : ep.toxicity_safe ? <Check className="size-3.5 text-emerald-500" strokeWidth={2} /> : <Pill sig="red">Flagged</Pill>}</td>
                    <td className="px-4 py-2.5 text-[13px]">{(ep as any).homology_safe != null ? ((ep as any).homology_safe ? "Clear" : <Pill sig="red">Homolog</Pill>) : <span className="text-muted-foreground">-</span>}</td>
                    <td className="px-4 py-2.5">{allSafe ? <Pill sig="green">Safe</Pill> : <Pill sig="red">Review</Pill>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   CONSTRUCT ASSEMBLER
══════════════════════════════════════════════════════════════════════ */

const ADJUVANT_INFO: Record<string, { full: string; mechanism: string; note: string }> = {
  RS09:  { full: "RS09 (TLR4 agonist peptide)",      mechanism: "Synthetic TLR4 agonist derived from flagellin. Activates NF-κB and MAPK pathways, driving pro-inflammatory cytokine release and dendritic cell maturation.", note: "Fused at N-terminus. Enhances CTL priming." },
  PADRE: { full: "PADRE (Pan HLA-DR epitope)",        mechanism: "Promiscuous MHC-II epitope binding a wide array of HLA-DR alleles. Provides CD4⁺ T-cell help across diverse populations without allele-specific restriction.", note: "Embedded after adjuvant. Critical for African population coverage." },
  TpD:   { full: "TpD (T-cell epitope-based adjuvant)",mechanism: "Tetanus toxoid-derived Th epitope. Leverages existing memory CD4⁺ responses in vaccinated individuals for rapid immune amplification.", note: "Suitable for populations with prior tetanus immunisation." },
};
const LINKER_INFO: Record<string, { purpose: string; flexibility: string }> = {
  AAY:   { purpose: "CTL linker, proteasomal cleavage signal. Promotes efficient MHC-I presentation.", flexibility: "Rigid" },
  GPGPG: { purpose: "HTL linker, helix breaker. Prevents secondary structure between adjacent T-cell epitopes.", flexibility: "Flexible" },
  KK:    { purpose: "B-cell linker, surface accessibility. Lysine spacers allow antibody recognition.", flexibility: "Flexible" },
  EAAAK: { purpose: "Rigid α-helical linker. Spatial separation of functional domains.", flexibility: "Rigid (α-helix)" },
};

function ConstructSection({ report }: { report: any }) {
  const [copied, setCopied] = useState(false);
  if (!report) return (
    <Section title="CONSTRUCT ASSEMBLER" subtitle="Multi-epitope construct · ProtParam analysis" motionIndex={8}>
      <Empty message="Construct data not available for this run." />
    </Section>
  );
  const seq     = report.construct_sequence ?? report.sequence ?? "";
  const props   = report.physicochemical ?? report.protparam ?? {};
  const linkerSc= report.linker_scheme ?? {};
  const adjuvant= report.adjuvant ?? null;
  const linkers = Object.entries(linkerSc).map(([name, s]) => ({ name, sequence: String(s) }));
  const adjKey  = adjuvant?.key ?? "";

  return (
    <Section title="CONSTRUCT ASSEMBLER" subtitle="Multi-epitope construct · ProtParam analysis" motionIndex={8}>
      <Accordion type="multiple" defaultValue={["sequence","protparam"]}>
        {seq && (
          <AccordionItem value="sequence" className="border-b border-border/20 border-x-0">
            <AccordionTrigger className="px-5 py-3.5 text-[13px] font-medium hover:no-underline hover:bg-muted/10 text-left">
              Full construct sequence
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5">
              <div className="relative">
                <pre className="font-mono text-[13px] leading-relaxed text-muted-foreground bg-muted/20 rounded p-4 overflow-x-auto whitespace-pre-wrap break-all">
                  {seq.match(/.{1,60}/g)?.join("\n") ?? seq}
                </pre>
                <button type="button"
                  onClick={() => { copyToClipboard(seq); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                  className="absolute top-2 right-2 flex items-center gap-1.5 h-7 rounded border border-border/20 bg-background px-2.5 text-[13px] font-medium hover:bg-accent transition-colors">
                  <Copy className="size-3" strokeWidth={1.5} />{copied ? "Copied" : "Copy"}
                </button>
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
        {Object.keys(props).length > 0 && (
          <AccordionItem value="protparam" className="border-b border-border/20 border-x-0">
            <AccordionTrigger className="px-5 py-3.5 text-[13px] font-medium hover:no-underline hover:bg-muted/10 text-left">
              Physicochemical properties
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { k: "molecular_weight_da", l: "Mol. weight", u: "Da" },
                  { k: "isoelectric_point",   l: "pI",          u: ""   },
                  { k: "instability_index",   l: "Instability", u: ""   },
                  { k: "gravy",               l: "GRAVY",       u: ""   },
                  { k: "aromaticity",         l: "Aromaticity", u: ""   },
                ].map(({ k, l, u }) => props[k] != null && (
                  <div key={k} className="bg-muted/20 rounded px-4 py-3 border border-border/20">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-widest">{l}</p>
                    <p className="text-[13px] font-mono font-semibold mt-1.5 tabular-nums">
                      {typeof props[k] === "number" ? props[k].toFixed(2) : props[k]}
                      {u && <span className="text-[11px] text-muted-foreground ml-1">{u}</span>}
                    </p>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
        {adjuvant && (
          <AccordionItem value="adjuvants" className="border-b border-border/20 border-x-0">
            <AccordionTrigger className="px-5 py-3.5 text-[13px] font-medium hover:no-underline hover:bg-muted/10 text-left">
              Adjuvant
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5">
              <div className="rounded border border-border/20 bg-muted/10 px-4 py-3.5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-[13px] font-semibold">{ADJUVANT_INFO[adjKey]?.full ?? adjuvant.key ?? adjuvant.sequence}</p>
                  {adjKey && <Pill sig="blue">{adjKey}</Pill>}
                </div>
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  {ADJUVANT_INFO[adjKey]?.mechanism ?? adjuvant.mechanism ?? ""}
                </p>
                {adjuvant.note && <p className="text-[13px] text-muted-foreground/70 mt-1.5 italic">{adjuvant.note}</p>}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
        {linkers.length > 0 && (
          <AccordionItem value="linkers" className="border-0">
            <AccordionTrigger className="px-5 py-3.5 text-[13px] font-medium hover:no-underline hover:bg-muted/10 text-left">
              Linkers ({linkers.length})
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5">
              <table className="w-full text-[13px]">
                <thead><tr className="border-b border-border/20">
                  {["Name","Sequence","Flexibility","Purpose"].map(h => (
                    <th key={h} className="pb-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-widest text-left pr-6">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {linkers.map((l, i) => {
                    const info = LINKER_INFO[l.name] ?? LINKER_INFO[l.sequence];
                    return (
                      <tr key={i} className="border-b border-border/20 last:border-0">
                        <td className="py-3 pr-6 font-semibold text-[13px]">{l.name}</td>
                        <td className="py-3 pr-6 font-mono text-[13px]">{l.sequence}</td>
                        <td className="py-3 pr-6"><Pill sig={info?.flexibility?.includes("Rigid") ? "blue" : "neutral"}>{info?.flexibility ?? l.name ?? "-"}</Pill></td>
                        <td className="py-3 text-[13px] text-muted-foreground leading-relaxed">{info?.purpose ?? "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </Section>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   LITERATURE + EXPERIMENT
══════════════════════════════════════════════════════════════════════ */

function LiteratureSection({ decision }: { decision: Decision | undefined }) {
  const reasoning = decision?.reasoning ?? "";
  const pmids: string[] = (decision as any)?.evidence_pmids ?? (decision as any)?.pmids ?? [];
  const query: string   = (decision as any)?.query ?? "";
  const count: number   = (decision as any)?.result_count ?? (decision as any)?.pubmed_hits ?? 0;
  const searchMs        = (decision as any)?.search_time_s ?? 0;

  return (
    <Card className="overflow-hidden flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border/20">
        <div>
          <h2 className="text-[14px] font-semibold tracking-wide uppercase">EVIDENCE RETRIEVER</h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">PubMed · semantic retrieval · Claude synthesis</p>
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-border/20 border-b border-border/20 bg-muted/10">
        {[
          { label: "QUERY",       value: query ? query.slice(0, 48) + (query.length > 48 ? "…" : "") : "-" },
          { label: "RESULTS",     value: String(count) },
          { label: "SEARCH TIME", value: searchMs > 0 ? `${searchMs.toFixed(1)}s` : "-" },
        ].map(m => (
          <div key={m.label} className="px-4 py-3">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">{m.label}</p>
            <p className="text-[13px] font-medium mt-1 truncate">{m.value}</p>
          </div>
        ))}
      </div>
      <div className="px-5 py-4 border-b border-border/20 flex-1">
        {reasoning ? (
          <p className="text-[13px] text-muted-foreground leading-relaxed whitespace-pre-wrap">{reasoning}</p>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Info className="size-4 text-muted-foreground/30" />
            <p className="text-[13px] text-muted-foreground text-center">PubMed returned 0 results for this protein.</p>
          </div>
        )}
      </div>
      {pmids.length > 0 && (
        <div className="px-5 py-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-3">
            Source publications ({pmids.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {pmids.map((pmid, i) => (
              <a key={i} href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 h-7 rounded bg-muted px-2.5 text-[13px] font-mono font-medium hover:bg-muted/80 transition-colors border border-border/20">
                PMID:{pmid}<ArrowUpRight className="size-3" strokeWidth={1.75} />
              </a>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function ExperimentSection({ decision }: { decision: Decision | undefined }) {
  const reasoning = decision?.reasoning ?? "";
  const plan: any = (decision as any)?.plan ?? null;

  return (
    <Card className="overflow-hidden flex flex-col h-full">
      <div className="px-5 py-4 border-b border-border/20">
        <h2 className="text-[14px] font-semibold tracking-wide uppercase">VALIDATION ROADMAP</h2>
        <p className="text-[13px] text-muted-foreground mt-0.5">ELISpot · immunisation schedule · NHP plan</p>
      </div>
      {!reasoning && !plan ? (
        <div className="flex flex-col items-center justify-center flex-1 py-12 gap-2 px-5 text-center">
          <Info className="size-4 text-muted-foreground/30" />
          <p className="text-[13px] text-muted-foreground">No experiment plan generated for this run.</p>
          <p className="text-[13px] text-muted-foreground/60 mt-0.5">Enable "Wet-lab roadmap" in pipeline configuration.</p>
        </div>
      ) : (
        <div className="divide-y divide-border/20 flex-1">
          {plan?.elispot_protocol      && <div className="px-5 py-4"><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-2">ELISPOT PROTOCOL</p><p className="text-[13px] text-muted-foreground leading-relaxed whitespace-pre-wrap">{plan.elispot_protocol}</p></div>}
          {plan?.immunisation_schedule && <div className="px-5 py-4"><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-2">IMMUNISATION SCHEDULE</p><p className="text-[13px] text-muted-foreground leading-relaxed whitespace-pre-wrap">{plan.immunisation_schedule}</p></div>}
          {plan?.nhp_plan              && <div className="px-5 py-4"><p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-2">NHP PLAN</p><p className="text-[13px] text-muted-foreground leading-relaxed whitespace-pre-wrap">{plan.nhp_plan}</p></div>}
          {reasoning && !plan          && <div className="px-5 py-4"><p className="text-[13px] text-muted-foreground leading-relaxed whitespace-pre-wrap">{reasoning}</p></div>}
        </div>
      )}
    </Card>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   AUDIT LOG
══════════════════════════════════════════════════════════════════════ */

function sanitizeReasoning(raw: string, stage: string): string {
  if (!raw) return "";
  return raw
    .replace(/\.\s*Advancing to N\d+[^.]*\./gi, ".")
    .replace(/\.\s*No quality flags\./gi, ".")
    .replace(/\bInput type:\s*\w+\.\s*/gi, "")
    .replace(/\[organism=[^\]]+\]/g, "")
    .replace(/\bOrganism class inferred:\s*\w+\.\s*/gi, "")
    .replace(/\bPSORTb unavailable[^.]*\.\s*/gi, "")
    .replace(/\bPhobius used as proxy\.\s*/gi, "")
    .replace(/\b(Kozi AI|TOPE_DEEP)\b/gi, "")
    .replace(/\bSearch time:\s*[\d.]+s\.\s*/gi, "")
    .replace(/\bEvidence PMIDs:\s*\.\s*/gi, "")
    .replace(/\bFailure signals:\s*none detected\.\s*/gi, "")
    .replace(/\bPrior experimental validation found:\s*(True|False)\.\s*/gi, "")
    .replace(/Protein loaded from uniprot\.\s*/gi, "")
    .replace(/\.{2,}/g, ".")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/^\.|\.$/g, "")
    .trim();
}

type AuditCol = "agent"|"decision"|"reasoning"|"time";
const ALL_COLS: AuditCol[] = ["agent","decision","reasoning","time"];
const COL_LABELS: Record<AuditCol, string> = { agent: "Agent", decision: "Decision", reasoning: "Reasoning", time: "Time" };

function buildTimingMap(timing: PipelineTiming): Record<string, number> {
  const map: Record<string, number> = {};
  Object.entries(TIMING_STAGE_MAP).forEach(([timingKey, stageKey]) => {
    const val = (timing as any)[timingKey];
    if (val != null) map[stageKey] = val;
  });
  return map;
}

function AuditAndTiming({ decisions, timing }: { decisions: Decision[]; timing: PipelineTiming }) {
  const timingMap   = buildTimingMap(timing);
  const [visibleCols, setVisibleCols] = useState<Set<AuditCol>>(new Set(["agent","decision","reasoning","time"]));

  const toggleCol = (col: AuditCol) => setVisibleCols(prev => {
    const next = new Set(prev);
    if (next.has(col)) { if (next.size > 1) next.delete(col); }
    else next.add(col);
    return next;
  });

  const copyLog = (d: Decision) => {
    const meta    = AGENT_META[d.stage];
    const t       = timingMap[d.stage];
    const cleaned = sanitizeReasoning(d.reasoning, d.stage);
    copyToClipboard([
      `Stage: ${meta?.title ?? d.stage} (${meta?.tool ?? ""})`,
      `Decision: ${d.decision}`,
      t && t > 0 ? `Elapsed: ${fmt(t)}` : null,
      "",
      cleaned,
    ].filter(Boolean).join("\n"));
  };

  return (
    <motion.div custom={11} initial="hidden" animate="visible" variants={fadeUp}>
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-border/20 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-[14px] font-semibold tracking-wide uppercase">PIPELINE AUDIT LOG</h2>
            <p className="text-[13px] text-muted-foreground mt-0.5">Antigen-to-construct decision record · epitope screening traceability</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[13px] shrink-0">
                Columns <ChevronDown className="size-3.5" strokeWidth={1.5} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36 shadow-lg rounded-lg">
              {ALL_COLS.map(col => (
                <DropdownMenuItem key={col} onClick={() => toggleCol(col)} className="text-[13px] gap-2.5 py-2 cursor-pointer">
                  <span className={cn(
                    "size-3.5 rounded border border-border flex items-center justify-center shrink-0",
                    visibleCols.has(col) ? "bg-foreground border-foreground" : "bg-transparent",
                  )}>
                    {visibleCols.has(col) && <Check className="size-2.5 text-background" strokeWidth={2.5} />}
                  </span>
                  {COL_LABELS[col]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border/20 bg-muted/20">
                {visibleCols.has("agent")    && <th className="px-4 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-widest text-left min-w-[200px]">Agent</th>}
                {visibleCols.has("decision") && <th className="px-4 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-widest text-left min-w-[140px]">Decision</th>}
                {visibleCols.has("reasoning")&& <th className="px-4 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-widest text-left">Reasoning</th>}
                {visibleCols.has("time")     && <th className="px-4 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-widest text-right w-[80px]">Time</th>}
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {decisions.map((d, i) => {
                const meta     = AGENT_META[d.stage];
                const t        = timingMap[d.stage];
                const isFailed = d.decision?.toLowerCase().includes("failed");
                const cleaned  = sanitizeReasoning(d.reasoning, d.stage);
                return (
                  <tr key={i} className={cn(
                    "border-b border-border/20 last:border-0 hover:bg-muted/10 transition-colors align-top",
                    isFailed && "bg-amber-500/3",
                  )}>
                    {visibleCols.has("agent") && (
                      <td className="px-4 py-3.5">
                        <p className="text-[13px] font-semibold text-foreground leading-tight">
                          {meta?.title ?? d.stage.replace(/_/g, " ").toUpperCase()}
                        </p>
                      </td>
                    )}
                    {visibleCols.has("decision") && (
                      <td className="px-4 py-3.5">
                        {isFailed ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="size-3" strokeWidth={2} />{d.decision}
                          </span>
                        ) : (
                          <span className="font-mono text-[13px] text-foreground">{d.decision}</span>
                        )}
                      </td>
                    )}
                    {visibleCols.has("reasoning") && (
                      <td className="px-4 py-3.5 max-w-[0] w-full">
                        <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-3" title={cleaned}>
                          {cleaned || <span className="opacity-40 italic">No reasoning recorded.</span>}
                        </p>
                      </td>
                    )}
                    {visibleCols.has("time") && (
                      <td className="px-4 py-3.5 text-right">
                        {t && t > 0
                          ? <span className="font-mono text-[13px] text-muted-foreground tabular-nums">{fmt(t)}</span>
                          : <span className="text-[13px] text-muted-foreground/30">-</span>}
                      </td>
                    )}
                    <td className="px-3 py-3.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground">
                            <MoreHorizontal className="size-4" strokeWidth={1.5} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 shadow-lg rounded-lg">
                          <DropdownMenuItem onClick={() => copyLog(d)} className="text-[13px] gap-2.5 py-2 cursor-pointer">
                            <ClipboardCopy className="size-3.5" strokeWidth={1.5} />Copy full log
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => copyToClipboard(cleaned)} className="text-[13px] gap-2.5 py-2 cursor-pointer">
                            <ScrollText className="size-3.5" strokeWidth={1.5} />Copy reasoning
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => copyToClipboard(d.stage)} className="text-[13px] gap-2.5 py-2 cursor-pointer">
                            <Copy className="size-3.5" strokeWidth={1.5} />Copy stage key
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {timing.total_seconds > 0 && (
          <div className="border-t border-border/20 bg-muted/10 px-5 py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Clock className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">TOTAL PIPELINE TIME</p>
            </div>
            <p className="font-mono text-[13px] font-semibold tabular-nums">{fmt(timing.total_seconds)}</p>
          </div>
        )}
      </Card>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   PAGE ROOT
══════════════════════════════════════════════════════════════════════ */

export default function ResultsPage() {
  const { runId } = useParams<{ runId: string }>();
  const router    = useRouter();
  const [res,     setRes]     = useState<PipelineResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [sel,     setSel]     = useState(0);

  useEffect(() => {
    if (runId) api.getResults(runId).then(setRes).catch(console.error).finally(() => setLoading(false));
  }, [runId]);

  const handleExportCSV = () => {
    if (!res) return;
    downloadCSV(res.candidates, String(runId));
  };

  const handleExportPDF = async () => {
    if (!res) return;
    try {
      await downloadReportPDF(String(runId), res.candidates);
    } catch (err) {
      console.error("PDF export failed:", err);
    }
  };

  const handleGmail = () => {
    if (!res) return;
    const c = res.candidates[sel];
    openGmailCompose(c.protein_name, c.protein_id, String(runId));
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
    </div>
  );

  if (!res) return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <AlertTriangle className="size-8 text-muted-foreground/30" strokeWidth={1.5} />
      <p className="text-[13px] text-muted-foreground text-center max-w-xs leading-relaxed">
        Results not found. The run may have expired or belong to another account.
      </p>
      <Button variant="outline" onClick={() => router.push("/history")} className="h-8 text-[13px]">
        <ChevronLeft className="size-3.5 mr-1.5" strokeWidth={1.5} />Back to History
      </Button>
    </div>
  );

  const c           = res.candidates[sel];
  const decisions   = c.decisions ?? [];
  const litDec      = decisions.find(d => d.stage === "literature_search");
  const expDec      = decisions.find(d => d.stage === "experiment_planning");
  const displayName = cleanProteinName(c.protein_name);

  return (
    <div className="h-full overflow-y-auto">
      <div className="w-full px-4 sm:px-6 lg:px-8 pb-12 flex flex-col gap-4 sm:gap-5">

        {/* Sticky header */}
        <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 bg-background/95 backdrop-blur-sm border-b border-border/20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-[16px] font-semibold tracking-tight uppercase leading-tight" style={{ fontFamily: "var(--font-geist-sans)" }}>
              {displayName}
            </h1>
            <Badge variant="outline" className="font-mono text-[13px] text-muted-foreground shrink-0 px-2 py-0.5 h-6 rounded border-border/30 bg-muted/40">
              {c.protein_id}
            </Badge>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <motion.div whileTap={{ scale: 0.95 }} className="shrink-0">
                <Button variant="outline" size="sm" className="gap-1.5 text-[13px] h-8">
                  Quick Actions <ChevronDown className="size-3.5" strokeWidth={1.5} />
                </Button>
              </motion.div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 shadow-lg rounded-lg" sideOffset={6}>
              <DropdownMenuItem onClick={handleExportCSV} className="text-[13px] gap-2.5 py-2">
                <FileDown className="size-3.5" strokeWidth={1.5} />Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF} className="text-[13px] gap-2.5 py-2">
                <Printer className="size-3.5" strokeWidth={1.5} />Full Report PDF
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleGmail} className="text-[13px] gap-2.5 py-2">
                <Mail className="size-3.5" strokeWidth={1.5} />Send via Gmail
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Protein selector tabs */}
        {res.candidates.length > 1 && (
          <div className="sticky top-[57px] z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 bg-background/95 backdrop-blur-sm border-b border-border/20">
            <div className="flex overflow-x-auto gap-0 scrollbar-none">
              {res.candidates.map((x, i) => {
                const name = cleanProteinName(x.protein_name);
                const tab  = name.length > 25 ? name.slice(0, 25).trimEnd() + "…" : name;
                return (
                  <button key={x.protein_id} type="button" onClick={() => setSel(i)}
                    className={cn(
                      "relative shrink-0 px-4 py-3 text-[13px] font-medium whitespace-nowrap transition-colors border-b-2 -mb-px",
                      sel === i ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/40",
                    )}>
                    {tab}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* KPI + Structure */}
        <div className="grid gap-4 sm:gap-5 grid-cols-1 lg:grid-cols-[3fr_2fr]">
          <div className="flex flex-col gap-4 sm:gap-5">
            <KPIStrip c={c} />
            <CoverageSection detail={c.coverage_detail ?? undefined} />
          </div>
          <div className="min-h-[360px] sm:min-h-[480px] lg:min-h-0">
            <StructureSummaryCard c={c} />
          </div>
        </div>

        <EpitopeTable epitopes={c.epitopes} />
        <StructureSection c={c} />
        <TCellSection c={c} />
        <BCellSection c={c} />
        <SafetySection c={c} />
        <ConstructSection report={res.construct_report ?? null} />

        <div className="grid gap-5 lg:grid-cols-2">
          <LiteratureSection decision={litDec} />
          <ExperimentSection decision={expDec} />
        </div>

        <AuditAndTiming decisions={decisions} timing={res.timing} />
      </div>
    </div>
  );
}