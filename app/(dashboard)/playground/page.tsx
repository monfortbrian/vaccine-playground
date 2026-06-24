"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useSidebar } from "@/components/ui/sidebar";
import {
  IconPlayerPlay, IconPlayerPause, IconPlayerStop, IconAlertTriangle,
  IconChevronDown, IconFlask2, IconDna2,
  IconBook2, IconTestPipe, IconMicroscope, IconAdjustmentsHorizontal,
} from "@tabler/icons-react";
import { Switch } from "@/components/ui/switch";
import { PipelineAnimation } from "@/components/pipeline-animation";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { InputType, PipelineStatusResponse } from "@/types";
import { cn } from "@/lib/utils";

/*
  TYPOGRAPHY RULES for this page:
  - User name only: 16px Geist Sans font-medium
  - ALL other titles (Pipeline ready, Input type, Proteins to analyse,
    Pipeline configuration, Safety screening, etc.): 16px Geist Mono font-normal
  - Body / descriptions: 13px Geist Sans font-normal
  - Tool short labels inside pipeline-animation: 13px Geist Mono font-normal
  - NO font-medium anywhere except the user's name
  - NO opacity modifiers on text (/50, /60, /70 forbidden)
*/

type UserProfile = "immunologist"|"vaccinologist"|"bioinformatician"|"phd_postdoc"|"medical_scientist";

interface ProfileConfig {
  label: string;
  icon: React.ElementType;
  defaults: {
    runSafety: boolean; runCoverage: boolean; runLiterature: boolean; runExperiment: boolean;
    maxProteins: number; preferredInput: InputType; organism: string;
  };
}

const PROFILES: Record<UserProfile, ProfileConfig> = {
  immunologist:     { label: "Immunologist",     icon: IconMicroscope, defaults: { runSafety: true,  runCoverage: true,  runLiterature: true,  runExperiment: true,  maxProteins: 5, preferredInput: "uniprot_id", organism: "bacteria" } },
  vaccinologist:    { label: "Vaccinologist",    icon: IconFlask2,     defaults: { runSafety: true,  runCoverage: true,  runLiterature: true,  runExperiment: true,  maxProteins: 3, preferredInput: "pathogen",   organism: "bacteria" } },
  bioinformatician: { label: "Bioinformatician", icon: IconDna2,       defaults: { runSafety: true,  runCoverage: true,  runLiterature: true,  runExperiment: false, maxProteins: 5, preferredInput: "sequence",   organism: "bacteria" } },
  phd_postdoc:      { label: "PhD / Postdoc",    icon: IconBook2,      defaults: { runSafety: true,  runCoverage: true,  runLiterature: true,  runExperiment: true,  maxProteins: 3, preferredInput: "pathogen",   organism: "bacteria" } },
  medical_scientist:{ label: "Public health",    icon: IconTestPipe,   defaults: { runSafety: true,  runCoverage: false, runLiterature: false, runExperiment: true,  maxProteins: 1, preferredInput: "pathogen",   organism: "bacteria" } },
};

const INPUT_TYPES: { value: InputType; label: string }[] = [
  { value: "pathogen",   label: "Pathogen"   },
  { value: "uniprot_id", label: "UniProt ID" },
  { value: "sequence",   label: "Sequence"   },
];

const INPUT_LABELS: Record<InputType, string> = {
  pathogen:   "Pathogen name",
  uniprot_id: "UniProt accession",
  sequence:   "Amino acid sequence",
};

const PLACEHOLDERS: Record<InputType, string> = {
  pathogen:   "e.g. Mycobacterium tuberculosis",
  uniprot_id: "e.g. P9WNK7",
  sequence:   "MTEQQWNFAGIEAAASAIQ…",
};

const ORGANISM_CLASSES = [
  { value: "bacteria", label: "Bacteria" },
  { value: "virus",    label: "Virus"    },
  { value: "parasite", label: "Parasite" },
];

const LAB_OPTIONS = [
  { value: "standard academic lab",    label: "Standard academic lab" },
  { value: "high containment BSL-3",   label: "BSL-3 containment"    },
  { value: "resource-limited setting", label: "Resource-limited"     },
  { value: "industrial CRO",           label: "Industrial / CRO"     },
];

/* Shared title style — 16px Geist Mono regular */
const monoTitle = {
  fontFamily: "var(--font-geist-mono)",
  fontSize:   "14px",
  fontWeight: 400,
  lineHeight: "1.25",
} as React.CSSProperties;

/* Shared subtitle style — 13px Geist regular */
const sansBody = {
  fontFamily: "var(--font-geist-sans)",
  fontSize:   "12px",
  fontWeight: 400,
} as React.CSSProperties;

function TopDropdown({ open, onToggle, onClose, label, icon: Icon, children, disabled }: {
  open: boolean; onToggle: () => void; onClose: () => void;
  label: string; icon: React.ElementType; children: React.ReactNode; disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button type="button" onClick={onToggle} disabled={disabled}
        className={cn(
          "flex items-center gap-1.5 h-8 rounded-sm border border-border px-2.5",
          "hover:bg-accent transition-colors disabled:opacity-40",
          open && "bg-accent",
        )}
        style={sansBody}>
        <Icon className="size-[18px] text-muted-foreground" strokeWidth={1.5} />
        <span>{label}</span>
        <IconChevronDown className={cn("size-[14px] text-muted-foreground transition-transform", open && "rotate-180")} strokeWidth={1.5} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 rounded-md border border-border bg-popover shadow-lg p-1.5 min-w-[260px] max-w-[300px]">
          {children}
        </div>
      )}
    </div>
  );
}

function SectionCard({ title, children, className }: {
  title?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-3 space-y-2.5", className)}>
      {title && (
        /* Section titles: 16px Geist Mono regular */
        <p className="text-muted-foreground" style={monoTitle}>{title}</p>
      )}
      {children}
    </div>
  );
}

export default function PlaygroundPage() {
  const router    = useRouter();
  const { user }  = useAuth();
  const { state } = useSidebar();
  const sidebarCollapsed = state === "collapsed";

  const displayName =
    user?.user_metadata?.name?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "Researcher";

  const [profile,       setProfile]       = useState<UserProfile>("vaccinologist");
  const [profileOpen,   setProfileOpen]   = useState(false);
  const [advancedOpen,  setAdvancedOpen]  = useState(false);
  const profileConfig = PROFILES[profile];

  const [inputType,     setInputType]     = useState<InputType>(profileConfig.defaults.preferredInput);
  const [inputValue,    setInputValue]    = useState("");
  const [proteinName,   setProteinName]   = useState("");
  const [organism,      setOrganism]      = useState(profileConfig.defaults.organism);
  const [maxProteins,   setMaxProteins]   = useState(profileConfig.defaults.maxProteins);
  const [runSafety,     setRunSafety]     = useState(profileConfig.defaults.runSafety);
  const [runCoverage,   setRunCoverage]   = useState(profileConfig.defaults.runCoverage);
  const [runLiterature, setRunLiterature] = useState(profileConfig.defaults.runLiterature);
  const [runExperiment, setRunExperiment] = useState(profileConfig.defaults.runExperiment);
  const [labConstraints,setLabConstraints]= useState("standard academic lab");

  const [running,  setRunning]  = useState(false);
  const [paused,   setPaused]   = useState(false);
  const [ps,       setPs]       = useState<PipelineStatusResponse | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [runId,    setRunId]    = useState<string | null>(null);
  const [runLabel, setRunLabel] = useState<string>("");

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

  const applyProfile = (p: UserProfile) => {
    const cfg = PROFILES[p].defaults;
    setInputType(cfg.preferredInput); setInputValue(""); setProteinName("");
    setMaxProteins(cfg.maxProteins); setRunSafety(cfg.runSafety);
    setRunCoverage(cfg.runCoverage); setRunLiterature(cfg.runLiterature);
    setRunExperiment(cfg.runExperiment); setOrganism(cfg.organism);
    setProfile(p); setProfileOpen(false);
  };

  const handleRun = async () => {
    if (!inputValue.trim()) return;
    setError(null); setRunning(true); setPaused(false); setPs(null);
    setRunLabel(inputType === "sequence" ? (proteinName.trim() || "Custom sequence") : inputValue.trim());
    try {
      await supabase.auth.getSession();
      const body: Record<string, unknown> = {
        input_type: inputType, input_value: inputValue.trim(),
        run_safety: runSafety, run_coverage: runCoverage,
        run_literature: runLiterature, run_experiment: runExperiment,
        lab_constraints: labConstraints,
      };
      if (inputType === "pathogen") body.max_proteins = maxProteins;
      if (inputType === "sequence" && proteinName.trim()) body.protein_name = proteinName.trim();

      const r = await api.startRun(body);
      setRunId(r.run_id);
      setPs({ run_id: r.run_id, status: "pending", current_node: null, progress: 0, message: "Queued…", started_at: null, completed_at: null });
      startPolling(r.run_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start pipeline.");
      setRunning(false); setRunLabel("");
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
    stopPolling(); setRunning(false); setPaused(false); setRunLabel("");
    if (ps) setPs({ ...ps, status: "cancelled", message: "Cancelled by user." });
  };

  const IconProfile  = profileConfig.icon;
  const gridTemplate = sidebarCollapsed ? "2.5fr 7.5fr" : "3fr 6fr";
  const isIdle       = !ps && !running;

  const AGENT_LABELS: Record<string, string> = {
    N1: "Sequence Ingestor",    N2: "Antigenicity Screener",
    N3: "MHC Binding Predictor",N4: "Linear Epitope Mapper",
    N5: "Structural Resolver",  N6: "Immunosafety Filter",
    N7: "Population Coverage",  N8: "Construct Assembler",
    N9: "Evidence Retriever",   N10: "Validation Roadmap",
  };
  const STAGE_TO_LABEL: Record<string, string> = {
    data_curation:      "Sequence Ingestor",    antigen_screening: "Antigenicity Screener",
    tcell_prediction:   "MHC Binding Predictor",bcell_prediction:  "Linear Epitope Mapper",
    structure_retrieval:"Structural Resolver",  safety_filter:     "Immunosafety Filter",
    coverage_analysis:  "Population Coverage",  construct_design:  "Construct Assembler",
    literature_search:  "Evidence Retriever",   experiment_planning:"Validation Roadmap",
  };

  const activeAgentLabel = ps?.current_node
    ? (AGENT_LABELS[ps.current_node] ?? STAGE_TO_LABEL[ps.current_node] ?? "Running")
    : null;

  /* Panel header text — 16px Geist Mono regular */
  const panelTitle = isIdle ? "Pipeline ready"
    : ps?.status === "completed"  ? "Analysis complete"
    : ps?.status === "failed"     ? "Pipeline failed"
    : ps?.status === "cancelled"  ? "Analysis stopped"
    : ps?.status === "paused"     ? "Analysis paused"
    : activeAgentLabel ?? "Initialising…";

  const panelSubtitle = isIdle
    ? "Configure your input and click Run Analysis."
    : ps?.status === "failed"    ? "Pipeline encountered an error"
    : ps?.status === "cancelled" ? "Stopped by user"
    : ps?.status === "paused"    ? "Analysis paused — resume to continue"
    : ps?.message ?? "10 agents · Sequence Ingestor to Validation Roadmap";

  return (
    <div className="flex flex-col h-[calc(100dvh-3rem)] overflow-hidden p-4">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 pb-3 shrink-0">
        <div className="space-y-0.5 min-w-0">
          {/* User name: 16px Geist Sans font-medium — the ONLY medium weight on this page */}
          <h1 style={{ fontFamily: "var(--font-geist-sans)", fontSize: "16px", fontWeight: 500, lineHeight: "1.25" }}>
            Good day, {displayName}
          </h1>
          <p className="text-muted-foreground" style={sansBody}>
            Configure your analysis and run the 10-agent pipeline.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <TopDropdown
            open={advancedOpen}
            onToggle={() => { setAdvancedOpen(!advancedOpen); setProfileOpen(false); }}
            onClose={() => setAdvancedOpen(false)}
            label="Advanced" icon={IconAdjustmentsHorizontal} disabled={running}
          >
            <p className="px-2.5 py-1 text-[10px] font-normal text-muted-foreground uppercase tracking-wider">
              Organism class
            </p>
            <div className="px-2.5 pb-2 grid grid-cols-3 gap-1.5">
              {ORGANISM_CLASSES.map(o => (
                <button key={o.value} type="button" disabled={running} onClick={() => setOrganism(o.value)}
                  className={cn(
                    "h-7 rounded-sm transition-colors border border-border disabled:opacity-40",
                    o.value === organism
                      ? "bg-foreground text-background border-foreground"
                      : "hover:bg-accent text-muted-foreground",
                  )}
                  style={{ fontFamily: "var(--font-geist-sans)", fontSize: "11px", fontWeight: 400 }}>
                  {o.label}
                </button>
              ))}
            </div>
            <div className="h-px bg-border mx-2.5 my-1" />
            <p className="px-2.5 py-1 text-[10px] font-normal text-muted-foreground uppercase tracking-wider">
              Lab constraints
            </p>
            <div className="px-2.5 pb-2 space-y-1">
              {LAB_OPTIONS.map(opt => (
                <button key={opt.value} type="button" disabled={running} onClick={() => setLabConstraints(opt.value)}
                  className={cn(
                    "w-full h-7 rounded-sm text-left px-2.5 transition-colors border border-border disabled:opacity-40",
                    opt.value === labConstraints
                      ? "bg-foreground text-background border-foreground"
                      : "hover:bg-accent text-muted-foreground",
                  )}
                  style={{ fontFamily: "var(--font-geist-sans)", fontSize: "11px", fontWeight: 400 }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </TopDropdown>

          <TopDropdown
            open={profileOpen}
            onToggle={() => { setProfileOpen(!profileOpen); setAdvancedOpen(false); }}
            onClose={() => setProfileOpen(false)}
            label={profileConfig.label} icon={IconProfile} disabled={running}
          >
            <p className="px-2.5 py-1 text-[10px] font-normal text-muted-foreground uppercase tracking-wider">
              Your profile
            </p>
            {(Object.entries(PROFILES) as [UserProfile, ProfileConfig][]).map(([key, cfg]) => {
              const Icon = cfg.icon;
              return (
                <button key={key} type="button" onClick={() => applyProfile(key)}
                  className={cn(
                    "flex items-center gap-2.5 w-full rounded-sm px-2.5 py-2 text-left transition-colors",
                    key === profile ? "bg-foreground/[0.06]" : "hover:bg-accent",
                  )}>
                  <Icon className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.5} />
                  <p style={sansBody}>{cfg.label}</p>
                </button>
              );
            })}
          </TopDropdown>
        </div>
      </div>

      {/* Main grid */}
      <div
        className="flex-1 min-h-0 grid gap-4 transition-[grid-template-columns] duration-300 [transition-timing-function:cubic-bezier(0.4,0,0.2,1)]"
        style={{ gridTemplateColumns: gridTemplate }}
      >

        {/* LEFT: Config */}
        <div className="flex flex-col min-h-0 gap-3">

          {/* Input type card — title: 16px Geist Mono regular */}
          <SectionCard title="Input type">
            <div className="grid grid-cols-3 gap-1 p-1 rounded-md bg-muted h-9">
              {INPUT_TYPES.map(t => (
                <button key={t.value} type="button" disabled={running}
                  onClick={() => { setInputType(t.value); setInputValue(""); setProteinName(""); }}
                  className={cn(
                    "rounded-sm transition-all disabled:opacity-40",
                    inputType === t.value
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  style={sansBody}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              {/* Input field label: 13px Geist regular */}
              <label className="block text-foreground" style={sansBody}>
                {INPUT_LABELS[inputType]}
              </label>

              {inputType === "sequence" ? (
                <textarea
                  className="w-full rounded-sm border border-border bg-transparent px-3 py-2.5 resize-none min-h-[60px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 disabled:opacity-40 transition-colors"
                  style={{ fontFamily: "var(--font-geist-mono)", fontSize: "13px", fontWeight: 400 }}
                  placeholder={PLACEHOLDERS.sequence}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  disabled={running}
                  spellCheck={false}
                />
              ) : (
                <input type="text"
                  className="w-full h-9 rounded-sm border border-border bg-transparent px-3 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 disabled:opacity-40 transition-colors"
                  style={{
                    fontFamily: inputType === "uniprot_id" ? "var(--font-geist-mono)" : "var(--font-geist-sans)",
                    fontSize: "13px", fontWeight: 400,
                  }}
                  placeholder={PLACEHOLDERS[inputType]}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  disabled={running}
                  spellCheck={false}
                />
              )}

              {inputType === "sequence" && (
                <input type="text"
                  className="w-full h-9 rounded-sm border border-border bg-transparent px-3 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 disabled:opacity-40 transition-colors"
                  style={sansBody}
                  placeholder="Protein name (optional)"
                  value={proteinName}
                  onChange={e => setProteinName(e.target.value)}
                  disabled={running}
                />
              )}
            </div>
          </SectionCard>

          {inputType === "pathogen" && (
            /* "Proteins to analyse" — 16px Geist Mono regular */
            <div className="rounded-lg border border-border bg-card p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-foreground" style={monoTitle}>Proteins to analyse</p>
                <span className="rounded-sm bg-foreground text-background px-2 py-0.5 tabular-nums"
                  style={{ fontFamily: "var(--font-geist-mono)", fontSize: "11px", fontWeight: 400 }}>
                  {maxProteins}
                </span>
              </div>
              <input type="range" min={1} max={10} step={1} value={maxProteins}
                onChange={e => setMaxProteins(Number(e.target.value))} disabled={running}
                className="w-full h-1.5 rounded-full cursor-pointer disabled:opacity-40 accent-foreground"
              />
              <div className="flex justify-between text-muted-foreground"
                style={{ fontFamily: "var(--font-geist-mono)", fontSize: "10px", fontWeight: 400 }}>
                <span>1</span><span>5</span><span>10</span>
              </div>
            </div>
          )}

          {/* Pipeline config card */}
          <div className="rounded-lg border border-border bg-card space-y-0 divide-y divide-border flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="px-3 py-2.5 shrink-0">
              {/* "Pipeline configuration" — 16px Geist Mono regular */}
              <p className="text-foreground" style={monoTitle}>Pipeline configuration</p>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {[
                { label: "Safety screening",    desc: "Allergenicity · toxicity · human homology", val: runSafety,     set: setRunSafety     },
                { label: "Population coverage", desc: "African HLA primary · 7 populations",        val: runCoverage,   set: setRunCoverage   },
                { label: "Literature search",   desc: "Published evidence · AI synthesis",           val: runLiterature, set: setRunLiterature },
                { label: "Wet-lab roadmap",     desc: "ELISpot · immunisation schedule",             val: runExperiment, set: setRunExperiment },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between px-3 py-2 gap-2 border-b border-border last:border-0">
                  <div className="min-w-0 flex flex-col gap-0.5">
                    {/* Toggle label: 16px Geist Mono regular */}
                    <p className="text-foreground leading-tight" style={monoTitle}>{row.label}</p>
                    {/* Description: 12px Geist regular */}
                    <p className="text-muted-foreground leading-tight truncate mt-0.5"
                      style={{ fontFamily: "var(--font-geist-sans)", fontSize: "12px", fontWeight: 400 }}>
                      {row.desc}
                    </p>
                  </div>
                  <Switch checked={row.val} onCheckedChange={row.set} disabled={running} className="shrink-0" />
                </div>
              ))}
            </div>

            <div className="px-3 py-3 shrink-0">
              {!running ? (
                <button type="button" onClick={handleRun} disabled={!inputValue.trim()}
                  className={cn(
                    "w-full h-10 rounded-md flex items-center justify-center gap-2 transition-all",
                    inputValue.trim()
                      ? "bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98]"
                      : "bg-muted text-muted-foreground cursor-not-allowed",
                  )}
                  style={sansBody}>
                  <IconPlayerPlay className="size-[18px]" strokeWidth={1.5} fill="currentColor" />
                  Run Analysis
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={handlePause}
                    className="h-10 rounded-md border border-border bg-card flex items-center justify-center gap-1.5 hover:bg-accent transition-colors"
                    style={sansBody}>
                    {paused
                      ? <><IconPlayerPlay  className="size-[18px]" strokeWidth={1.5} />Resume</>
                      : <><IconPlayerPause className="size-[18px]" strokeWidth={1.5} />Pause</>}
                  </button>
                  <button type="button" onClick={handleStop}
                    className="h-10 rounded-md bg-destructive/10 border border-destructive/30 text-destructive flex items-center justify-center gap-1.5 hover:bg-destructive/15 transition-colors"
                    style={sansBody}>
                    <IconPlayerStop className="size-[18px]" strokeWidth={1.5} />Stop
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Pipeline panel */}
        <div className="flex flex-col min-h-0 rounded-lg border border-border bg-card overflow-hidden">
          {error ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="flex items-start gap-3 rounded-md border border-destructive/20 bg-destructive/5 p-4 max-w-sm">
                <IconAlertTriangle className="size-[18px] text-destructive shrink-0 mt-0.5" strokeWidth={1.5} />
                <div className="space-y-1">
                  <p className="text-destructive" style={sansBody}>Pipeline error</p>
                  <p className="text-muted-foreground" style={{ ...sansBody, fontSize: "11px" }}>{error}</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Panel header — 16px Geist Mono regular */}
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border shrink-0">
                <div className="min-w-0">
                  <p className="truncate text-foreground" style={monoTitle}>{panelTitle}</p>
                  <p className="text-muted-foreground" style={{ ...sansBody, fontSize: "11px" }}>{panelSubtitle}</p>
                </div>
                {!isIdle && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5",
                      ps?.status === "running" || ps?.status === "pending"
                        ? "bg-foreground/[0.06] text-foreground"
                        : ps?.status === "failed"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-muted text-muted-foreground",
                    )}
                    style={{ fontFamily: "var(--font-geist-sans)", fontSize: "11px", fontWeight: 400 }}>
                      {(ps?.status === "running" || ps?.status === "pending") && (
                        <span className="size-1.5 rounded-full bg-foreground animate-pulse" />
                      )}
                      {ps?.status === "running" || ps?.status === "pending" ? "Running"
                        : ps?.status === "paused"    ? "Paused"
                        : ps?.status === "cancelled" ? "Stopped"
                        : ps?.status === "failed"    ? "Failed"
                        : (ps?.status ?? "")}
                    </span>
                    {ps?.run_id && (
                      <span className="text-muted-foreground bg-muted rounded-sm px-1.5 py-0.5"
                        style={{ fontFamily: "var(--font-geist-mono)", fontSize: "10px", fontWeight: 400 }}>
                        {ps.run_id.slice(0, 8)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none">
                <div className="px-6 py-5">
                  <PipelineAnimation
                    currentNode={ps?.current_node ?? null}
                    status={ps?.status}
                    message={ps?.message}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}