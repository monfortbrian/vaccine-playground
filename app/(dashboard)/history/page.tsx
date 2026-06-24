"use client";

/**
 * Run History — TOPE_DEEP
 * Full Report PDF wired to backend /api/pipeline/report/{runId}
 * CSV uses downloadCSV from lib/export
 * No direct Anthropic API calls from browser
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconPlus, IconDotsVertical, IconFileSpreadsheet, IconFileText,
  IconSearch, IconStar, IconStarFilled, IconChevronUp,
  IconChevronDown, IconSelector, IconFilter, IconX,
  IconArchive, IconEye, IconLoader2,
} from "@tabler/icons-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { downloadCSV, downloadReportPDF, buildTDFileName } from "@/lib/export";
import type { RunSummary, InputType } from "@/types";
import { cn } from "@/lib/utils";

/* ══════════════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════════════ */

const STARRED_KEY   = "tope_deep:starred_runs";
const ARCHIVED_KEY  = "tope_deep:archived_runs";
const ARCHIVE_TTL_DAYS = 5;

const INPUT_TYPE_LABELS: Record<InputType, string> = {
  pathogen:   "Pathogen",
  uniprot_id: "UniProt ID",
  sequence:   "Sequence",
};

/* ══════════════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════════════ */

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? "-" : d.toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return "-"; }
}

function formatDuration(start?: string | null, end?: string | null): string {
  if (!start || !end) return "";
  try {
    const s = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
    if (isNaN(s) || s <= 0) return "";
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60), rem = s % 60;
    return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
  } catch { return ""; }
}

function formatSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getStarred(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try { return new Set(JSON.parse(localStorage.getItem(STARRED_KEY) ?? "[]")); }
  catch { return new Set(); }
}
function toggleStarred(id: string): Set<string> {
  const s = getStarred();
  s.has(id) ? s.delete(id) : s.add(id);
  localStorage.setItem(STARRED_KEY, JSON.stringify([...s]));
  return new Set(s);
}

function getArchived(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(ARCHIVED_KEY) ?? "{}"); }
  catch { return {}; }
}
function archiveRun(id: string): Record<string, string> {
  const a = getArchived();
  a[id] = new Date().toISOString();
  localStorage.setItem(ARCHIVED_KEY, JSON.stringify(a));
  return { ...a };
}
function restoreRun(id: string): Record<string, string> {
  const a = getArchived();
  delete a[id];
  localStorage.setItem(ARCHIVED_KEY, JSON.stringify(a));
  return { ...a };
}
function pruneExpired(archived: Record<string, string>): Record<string, string> {
  const cutoff = Date.now() - ARCHIVE_TTL_DAYS * 86400 * 1000;
  const pruned: Record<string, string> = {};
  for (const [id, iso] of Object.entries(archived)) {
    if (new Date(iso).getTime() > cutoff) pruned[id] = iso;
  }
  return pruned;
}

/* ══════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
══════════════════════════════════════════════════════════════════════ */

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, { cls: string; label: string }> = {
    completed: { cls: "text-[var(--signal-green)] bg-[var(--signal-green-bg)]", label: "Completed" },
    failed:    { cls: "text-[var(--signal-red)]   bg-[var(--signal-red-bg)]",   label: "Failed"    },
    running:   { cls: "text-[var(--signal-amber)] bg-[var(--signal-amber-bg)]", label: "Running"   },
  };
  const cfg = m[status] ?? { cls: "text-muted-foreground bg-muted", label: status };
  return (
    <span className={cn(
      "inline-flex items-center h-5 px-2 rounded font-mono text-[11px] font-medium",
      cfg.cls,
    )}>
      {cfg.label}
    </span>
  );
}

function InputTypeBadge({ type }: { type: InputType | undefined }) {
  if (!type) return null;
  return (
    <span className="inline-flex items-center h-4 px-1.5 rounded bg-muted border border-border/40 font-mono text-[10px] text-muted-foreground">
      {INPUT_TYPE_LABELS[type] ?? type}
    </span>
  );
}

function CoverageCell({ value }: { value?: number | null }) {
  if (value == null) return <span className="text-muted-foreground font-mono text-[13px]">-</span>;
  const cls =
    value >= 75 ? "text-[var(--signal-green)]" :
    value >= 60 ? "text-[var(--signal-amber)]" : "text-[var(--signal-red)]";
  return (
    <span className={cn("font-mono text-[13px] font-medium tabular-nums", cls)}>
      {value.toFixed(1)}%
    </span>
  );
}

/* ── Sort header ── */

type SortKey = "date" | "name" | "coverage" | "status" | "duration" | "size";
type SortDir = "asc" | "desc";

function SortTh({ label, k, cur, dir, onSort, right }: {
  label: string; k: SortKey; cur: SortKey; dir: SortDir;
  onSort: (k: SortKey) => void; right?: boolean;
}) {
  const active = cur === k;
  const Icon = active ? (dir === "asc" ? IconChevronUp : IconChevronDown) : IconSelector;
  return (
    <button type="button" onClick={() => onSort(k)}
      className={cn(
        "flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider",
        "text-muted-foreground hover:text-foreground transition-colors w-full",
        right && "justify-end",
      )}>
      {right && <Icon className={cn("size-3", !active && "opacity-40")} />}
      {label}
      {!right && <Icon className={cn("size-3", !active && "opacity-40")} />}
    </button>
  );
}

/* ── Row actions menu ── */

interface RowMenuProps {
  run: RunSummary;
  isArchivePage?: boolean;
  onArchive?: (id: string) => void;
  onRestore?: (id: string) => void;
}

function RowMenu({ run, isArchivePage, onArchive, onRestore }: RowMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const stop = (e: React.MouseEvent) => { e.stopPropagation(); setOpen(false); };

  const handleView = (e: React.MouseEvent) => {
    stop(e);
    router.push(`/results/${run.id}`);
  };

  const handleCSV = async (e: React.MouseEvent) => {
    stop(e);
    try {
      const res = await api.getResults(run.id);
      if (!res.candidates?.length) return;
      downloadCSV(res.candidates, run.id);
    } catch (err) { console.error("CSV export failed:", err); }
  };

  const handleFullReportPDF = async (e: React.MouseEvent) => {
    stop(e);
    setPdfLoading(true);
    try {
      await downloadReportPDF(
        run.id,
        // candidates array passed empty — backend builds report from run_id directly
        [],
      );
    } catch (err) {
      console.error("PDF report failed:", err);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleArchive = (e: React.MouseEvent) => { stop(e); onArchive?.(run.id); };
  const handleRestore = (e: React.MouseEvent) => { stop(e); onRestore?.(run.id); };

  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        aria-label="Actions"
      >
        <IconDotsVertical className="size-[15px]" strokeWidth={1.5} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 rounded-md border border-border bg-popover shadow-lg p-1 min-w-[185px]">
          {!isArchivePage && run.status === "completed" && (
            <button onClick={handleView}
              className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-[13px] hover:bg-accent transition-colors">
              <IconEye className="size-[14px] text-muted-foreground" strokeWidth={1.5} />
              View Results
            </button>
          )}
          {run.status === "completed" && (
            <button onClick={handleCSV}
              className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-[13px] hover:bg-accent transition-colors">
              <IconFileSpreadsheet className="size-[14px] text-muted-foreground" strokeWidth={1.5} />
              Export CSV
            </button>
          )}
          {run.status === "completed" && (
            <button onClick={handleFullReportPDF} disabled={pdfLoading}
              className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-[13px] hover:bg-accent transition-colors disabled:opacity-50">
              {pdfLoading
                ? <IconLoader2 className="size-[14px] text-muted-foreground animate-spin" strokeWidth={1.5} />
                : <IconFileText className="size-[14px] text-muted-foreground" strokeWidth={1.5} />}
              {pdfLoading ? "Generating…" : "Full Report PDF"}
            </button>
          )}
          <div className="h-px bg-border/60 my-1" />
          {isArchivePage ? (
            <button onClick={handleRestore}
              className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-[13px] hover:bg-accent transition-colors">
              <IconArchive className="size-[14px] text-muted-foreground" strokeWidth={1.5} />
              Restore to History
            </button>
          ) : (
            <button onClick={handleArchive}
              className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-[13px] text-destructive hover:bg-destructive/5 transition-colors">
              <IconArchive className="size-[14px]" strokeWidth={1.5} />
              Archive
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   SHARED RUN TABLE
══════════════════════════════════════════════════════════════════════ */

export interface RunTableProps {
  runs: RunSummary[];
  starred: Set<string>;
  archived: Record<string, string>;
  onToggleStar: (id: string) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onRowClick: (run: RunSummary) => void;
  isArchivePage?: boolean;
  emptyMessage?: string;
}

export function RunTable({
  runs, starred, archived, onToggleStar, onArchive, onRestore,
  onRowClick, isArchivePage, emptyMessage,
}: RunTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilter(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  const statuses   = ["all", ...Array.from(new Set(runs.map(r => r.status)))];
  const inputTypes = ["all", ...Array.from(new Set(runs.map(r => r.input_type).filter(Boolean)))];

  let filtered = runs.filter(r => {
    if (query && !(r.pathogen_name ?? "").toLowerCase().includes(query.toLowerCase())) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (typeFilter !== "all" && r.input_type !== typeFilter) return false;
    return true;
  });

  filtered = [...filtered].sort((a, b) => {
    let va: any = "", vb: any = "";
    if (sortKey === "date")     { va = a.created_at ?? "";    vb = b.created_at ?? "";    }
    if (sortKey === "name")     { va = a.pathogen_name ?? ""; vb = b.pathogen_name ?? ""; }
    if (sortKey === "coverage") { va = a.global_coverage ?? -1; vb = b.global_coverage ?? -1; }
    if (sortKey === "status")   { va = a.status; vb = b.status; }
    if (sortKey === "size")     { va = a.size_bytes ?? 0; vb = b.size_bytes ?? 0; }
    if (sortKey === "duration") {
      const ms = (r: RunSummary) =>
        r.completed_at && r.created_at
          ? new Date(r.completed_at).getTime() - new Date(r.created_at).getTime()
          : -1;
      va = ms(a); vb = ms(b);
    }
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const activeFilters = (statusFilter !== "all" ? 1 : 0) + (typeFilter !== "all" ? 1 : 0);

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative flex-1 max-w-[280px]">
          <IconSearch
            className="absolute left-2.5 top-1/2 -translate-y-1/2 size-[14px] text-muted-foreground"
            strokeWidth={1.5}
          />
          <input
            type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search pathogen or protein…"
            className="h-8 w-full rounded-md border border-border bg-transparent pl-8 pr-8 text-[13px] placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring/40 transition-colors"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <IconX className="size-[13px]" strokeWidth={1.5} />
            </button>
          )}
        </div>

        <div ref={filterRef} className="relative">
          <button type="button" onClick={() => setShowFilter(o => !o)}
            className={cn(
              "flex items-center gap-1.5 h-8 rounded-md border border-border px-3 text-[13px]",
              "text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
              activeFilters > 0 && "border-foreground/40 text-foreground bg-accent/60",
            )}>
            <IconFilter className="size-[13px]" strokeWidth={1.5} />
            Filter
            {activeFilters > 0 && (
              <span className="inline-flex size-4 items-center justify-center rounded-full bg-foreground text-background text-[10px] font-semibold">
                {activeFilters}
              </span>
            )}
          </button>
          {showFilter && (
            <div className="absolute top-full mt-1 left-0 z-50 rounded-md border border-border bg-popover shadow-lg p-2 min-w-[200px] space-y-2">
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1 mb-1">Status</p>
                {statuses.map(s => (
                  <button key={s} type="button" onClick={() => setStatusFilter(s)}
                    className={cn(
                      "flex w-full items-center rounded-sm px-2 py-1 text-[13px] hover:bg-accent transition-colors capitalize",
                      statusFilter === s && "font-medium text-foreground bg-accent/50",
                    )}>
                    {s === "all" ? "All statuses" : s}
                  </button>
                ))}
              </div>
              <div className="h-px bg-border/60" />
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1 mb-1">Input type</p>
                {inputTypes.map(t => (
                  <button key={t} type="button" onClick={() => setTypeFilter(t)}
                    className={cn(
                      "flex w-full items-center rounded-sm px-2 py-1 text-[13px] hover:bg-accent transition-colors",
                      typeFilter === t && "font-medium text-foreground bg-accent/50",
                    )}>
                    {t === "all" ? "All types" : INPUT_TYPE_LABELS[t as InputType] ?? t}
                  </button>
                ))}
              </div>
              {activeFilters > 0 && (
                <>
                  <div className="h-px bg-border/60" />
                  <button type="button"
                    onClick={() => { setStatusFilter("all"); setTypeFilter("all"); }}
                    className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1 text-[12px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                    <IconX className="size-[11px]" strokeWidth={1.5} /> Clear filters
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <span className="text-[12px] text-muted-foreground ml-auto">
          {filtered.length} run{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-border bg-card">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-center">
            <p className="text-[13px] font-medium">No runs found</p>
            <p className="text-[12px] text-muted-foreground">
              {emptyMessage ?? "Try adjusting your search or filters."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border">
                {!isArchivePage && <TableHead className="w-9 pl-3 pr-0" />}
                <TableHead className="min-w-[160px] pl-3">
                  <SortTh label="Date" k="date" cur={sortKey} dir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortTh label="Pathogen / Protein" k="name" cur={sortKey} dir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[90px]">
                  <SortTh label="Type" k="name" cur={sortKey} dir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[100px]">
                  <SortTh label="Coverage" k="coverage" cur={sortKey} dir={sortDir} onSort={handleSort} right />
                </TableHead>
                <TableHead className="w-[110px]">
                  <SortTh label="Status" k="status" cur={sortKey} dir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[80px]">
                  <SortTh label="Duration" k="duration" cur={sortKey} dir={sortDir} onSort={handleSort} right />
                </TableHead>
                <TableHead className="w-[75px]">
                  <SortTh label="Size" k="size" cur={sortKey} dir={sortDir} onSort={handleSort} right />
                </TableHead>
                <TableHead className="w-[50px] pr-3" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r, i) => {
                const isStarred = starred.has(r.id);
                const dur = formatDuration(r.created_at, r.completed_at);
                const sz  = formatSize(r.size_bytes);
                return (
                  <TableRow
                    key={r.id || i}
                    className="cursor-pointer group"
                    onClick={() => { if (r.status === "completed") onRowClick(r); }}
                  >
                    {!isArchivePage && (
                      <TableCell className="pl-3 pr-0 w-9"
                        onClick={e => { e.stopPropagation(); onToggleStar(r.id); }}>
                        <button type="button" aria-label={isStarred ? "Unstar" : "Star"}
                          className="flex size-7 items-center justify-center rounded text-muted-foreground/30 hover:text-amber-400 transition-colors">
                          {isStarred
                            ? <IconStarFilled className="size-[13px] text-amber-400" />
                            : <IconStar className="size-[13px] opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />}
                        </button>
                      </TableCell>
                    )}
                    <TableCell className="text-[13px] text-muted-foreground whitespace-nowrap pl-3">
                      {formatDate(r.created_at)}
                    </TableCell>
                    <TableCell className="text-[13px] font-medium font-mono max-w-[280px] truncate">
                      {r.pathogen_name || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      <InputTypeBadge type={r.input_type} />
                    </TableCell>
                    <TableCell className="text-right">
                      <CoverageCell value={r.global_coverage} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-right font-mono text-[12px] text-muted-foreground tabular-nums">
                      {dur || <span className="text-muted-foreground/30">-</span>}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[12px] text-muted-foreground tabular-nums">
                      {sz || <span className="text-muted-foreground/30">-</span>}
                    </TableCell>
                    <TableCell className="pr-3">
                      <div className="flex justify-end">
                        <RowMenu
                          run={r}
                          isArchivePage={isArchivePage}
                          onArchive={onArchive}
                          onRestore={onRestore}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   HISTORY PAGE
══════════════════════════════════════════════════════════════════════ */

export default function HistoryPage() {
  const router = useRouter();
  const [runs,     setRuns]     = useState<RunSummary[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [starred,  setStarred]  = useState<Set<string>>(new Set());
  const [archived, setArchived] = useState<Record<string, string>>({});

  useEffect(() => {
    setStarred(getStarred());
    const a = pruneExpired(getArchived());
    setArchived(a);
    localStorage.setItem(ARCHIVED_KEY, JSON.stringify(a));
    api.listRuns().then(setRuns).catch(() => setRuns([])).finally(() => setLoading(false));
  }, []);

  const handleToggleStar = useCallback((id: string) => setStarred(toggleStarred(id)), []);
  const handleArchive    = useCallback((id: string) => setArchived(archiveRun(id)),    []);
  const handleRestore    = useCallback((id: string) => setArchived(restoreRun(id)),    []);
  const handleRowClick   = useCallback((r: RunSummary) => router.push(`/results/${r.id}`), [router]);

  const visibleRuns = runs.filter(r => !archived[r.id]);

  return (
    <div className="flex flex-col h-[calc(100dvh-3rem)] overflow-hidden p-4 gap-3">
      <div className="flex items-start justify-between gap-4 shrink-0">
        <div className="space-y-0.5">
          <h1 className="text-[16px] font-semibold tracking-tight" style={{ fontFamily: "var(--font-geist-sans)" }}>
            Run History
          </h1>
          <p className="text-[13px] text-muted-foreground">All pipeline runs and their results.</p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/playground")}
          className="flex items-center gap-1.5 h-8 rounded-md bg-foreground text-background px-3 text-[13px] font-semibold hover:bg-foreground/90 transition-colors shrink-0"
        >
          <IconPlus className="size-[15px]" strokeWidth={1.75} />
          New run
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="size-5 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
        </div>
      ) : (
        <RunTable
          runs={visibleRuns}
          starred={starred}
          archived={archived}
          onToggleStar={handleToggleStar}
          onArchive={handleArchive}
          onRestore={handleRestore}
          onRowClick={handleRowClick}
          emptyMessage="Start your first analysis in the Playground."
        />
      )}
    </div>
  );
}