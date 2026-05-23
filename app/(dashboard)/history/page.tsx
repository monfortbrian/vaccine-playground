"use client";

/**
 * History page - changes from previous version:
 *   1. DownloadMenu: traceable file naming (topdp_... convention)
 *   2. DownloadMenu: passes pathogen_name to filename builder
 *   3. Row click navigates to results (entire row is clickable)
 *   4. View button tooltip updated to "View results"
 */

import React, { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconPlus, IconEye, IconDownload } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { RunSummary } from "@/types";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

const PIPELINE_VERSION = "v2";

function buildFileName(
  runId: string,
  pathogenName: string | undefined | null,
  datatype: string,
  ext: string
): string {
  const pathogen = (pathogenName ?? "unknown")
    .split(" ")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const date = new Date().toISOString().slice(0, 10);
  const id = runId.slice(0, 8);
  return `topdp_${pathogen}_${datatype}_${date}_${PIPELINE_VERSION}_${id}.${ext}`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

// ── DownloadMenu ──────────────────────────────────────────────────────────────


function DownloadMenu({
  runId,
  pathogenName,
}: {
  runId: string;
  pathogenName?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDownload = async (format: "csv" | "json") => {
    setOpen(false);
    try {
      const results = await api.getResults(runId);
      const resolvedPathogen =
        pathogenName ?? results.candidates?.[0]?.protein_name;

      if (format === "json") {
        const name = buildTDFileName(resolvedPathogen, runId, "fullreport", "json");
        const blob = new Blob([JSON.stringify(results, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }

      // CSV
      const rows =
        results.candidates?.flatMap(
          (c: any) =>
            c.epitopes?.map((e: any) => ({
              protein: c.protein_name,
              protein_id: c.protein_id,
              epitope_sequence: e.sequence,
              type: e.epitope_type,
              hla_allele: e.hla_allele ?? "",
              ic50_nm: e.ic50_nm != null ? String(e.ic50_nm) : "",
              ic50_note: "approximated_from_percentile_rank",
              confidence: e.confidence,
              allergenicity_safe: e.allergenicity_safe != null ? String(e.allergenicity_safe) : "unscored",
              toxicity_safe: e.toxicity_safe != null ? String(e.toxicity_safe) : "unscored",
              safety_verdict: e.safety_verdict ?? "",
            })) ?? []
        ) ?? [];

      if (rows.length === 0) return;

      const name = buildTDFileName(resolvedPathogen, runId, "epitopes", "csv");
      const headers = Object.keys(rows[0]).join(",");
      const csvRows = rows
        .map((d: any) =>
          Object.values(d)
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(",")
        )
        .join("\n");

      const blob = new Blob([headers + "\n" + csvRows], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download failed:", e);
    }
  };

  return (
    <div ref={ref} className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Download results"
          >
            <IconDownload className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Download</TooltipContent>
      </Tooltip>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-[999] rounded-lg border bg-popover p-1 shadow-md min-w-[160px]">
          <button
            onClick={() => handleDownload("csv")}
            className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            Epitopes CSV
          </button>
          <button
            onClick={() => handleDownload("json")}
            className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            Full report JSON
          </button>
          <button
            disabled
            className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground cursor-not-allowed"
          >
            PDF report
            <Badge variant="secondary" className="text-[9px]">Soon</Badge>
          </button>
        </div>
      )}
    </div>
  );
}

// ── History page ──────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listRuns()
      .then(setRuns)
      .catch(() => setRuns([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Run History</h2>
          <p className="text-sm text-muted-foreground mt-1">
            All pipeline runs and their results.
          </p>
        </div>
        <Button onClick={() => router.push("/")} size="sm">
          <IconPlus className="mr-2 size-4" />
          New Run
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : runs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-20">
            <div className="rounded-full bg-muted p-4 mb-4">
              <IconPlus className="size-6 text-muted-foreground" />
            </div>
            <p className="font-medium text-sm">No runs yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Start your first analysis in the Playground.
            </p>
            <Button
              className="mt-6"
              size="sm"
              onClick={() => router.push("/")}
            >
              Go to Playground
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border overflow-visible relative">
          <TooltipProvider delayDuration={200}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                    Date
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                    Pathogen / Protein
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">
                    Coverage
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r, index) => (
                  <tr
                    key={r.id || `run-${index}`}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => {
                      if (r.status === "completed") router.push(`/results/${r.id}`);
                    }}
                  >
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(r.created_at)}
                    </td>
                    <td className="px-4 py-3 font-medium text-sm">
                      {r.pathogen_name || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          r.status === "completed"
                            ? "default"
                            : r.status === "failed"
                              ? "destructive"
                              : "secondary"
                        }
                        className="text-xs"
                      >
                        {r.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                      {r.global_coverage != null
                        ? `${r.global_coverage.toFixed(1)}%`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.status === "completed" && (
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => router.push(`/results/${r.id}`)}
                                  className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                                  aria-label="View results"
                                >
                                  <IconEye className="size-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>View results</TooltipContent>
                            </Tooltip>
                            <DownloadMenu
                              runId={r.id}
                              pathogenName={r.pathogen_name}
                            />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}