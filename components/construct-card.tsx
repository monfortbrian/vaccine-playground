"use client";

/**
 * N8 Multi-Epitope Construct
 *
 * Handles both adjuvant formats:
 *   v1 (old runs): report.adjuvant_sequence + report.adjuvant_reference (flat)
 *   v2 (new runs): report.adjuvant.sequence + report.adjuvant.citation (nested object)
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Copy, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import type { ConstructReport } from "@/types";

interface ConstructCardProps {
  report: ConstructReport | null;
}

// Normalize adjuvant fields across v1 and v2 backend formats
function getAdjuvantInfo(report: ConstructReport) {
  if (report.adjuvant && typeof report.adjuvant === "object" && report.adjuvant.sequence) {
    return {
      key:       report.adjuvant.key,
      sequence:  report.adjuvant.sequence,
      mechanism: report.adjuvant.mechanism,
      citation:  report.adjuvant.citation,
      note:      report.adjuvant.note,
    };
  }
  // Legacy v1 flat format
  return {
    key:       "RS09",
    sequence:  report.adjuvant_sequence ?? "APPHALS",
    mechanism: "TLR4 agonist derived from flagellin C-terminal domain",
    citation:  report.adjuvant_reference ?? "Chuang et al. (2010) Vaccine",
    note:      "Immunogenicity established in murine models only.",
  };
}

function getLinkerCitation(report: ConstructReport) {
  return report.linker_citation ?? report.linker_reference ?? "Nezafat et al. (2014)";
}

export function ConstructCard({ report }: ConstructCardProps) {
  const [copied, setCopied]           = useState(false);
  const [nextStepsOpen, setNextStepsOpen] = useState(true);

  if (!report) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">N8 Multi-Epitope Construct</CardTitle>
          <CardDescription>
            No construct produced. This occurs when no safety-passed, confidence-scored
            epitopes remain after N6 filtering. Review safety screening results.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const adjuvant = getAdjuvantInfo(report);

  function copyFasta() {
    const fasta = `>TOPE_DEEP_construct_${report.length_aa}aa\n${report.construct_sequence}`;
    navigator.clipboard.writeText(fasta).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base">N8 - Multi-Epitope Construct</CardTitle>
            <CardDescription className="mt-1">
              Assembled from safety-passed, high-confidence epitopes. All physicochemical
              values are theoretical (ProtParam). Requires wet-lab validation.
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {["CTL", "HTL", "B-cell"].map((t) => {
              const count = report.epitope_counts[t as keyof typeof report.epitope_counts];
              if (!count) return null;
              return (
                <Badge key={t} variant="outline" className="text-xs font-mono">
                  {t} {count}
                </Badge>
              );
            })}
            <Badge variant="secondary" className="text-xs">{report.length_aa} aa</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">

        {/* Construct sequence */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Construct sequence ({report.length_aa} aa)
            </p>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={copyFasta}>
              {copied
                ? <><Check className="size-3" /> Copied</>
                : <><Copy className="size-3" /> Copy FASTA</>}
            </Button>
          </div>
          <div className="rounded-lg bg-muted/40 border px-4 py-3 font-mono text-[11px] leading-relaxed tracking-wider break-all">
            {report.construct_sequence.match(/.{1,10}/g)?.join(" ")}
          </div>
        </div>

        {/* Physicochemical properties */}
        {report.physicochemical && !report.physicochemical.error && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Physicochemical properties
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                {
                  label: "Molecular weight",
                  value: report.physicochemical.molecular_weight_da
                    ? `${(report.physicochemical.molecular_weight_da / 1000).toFixed(2)} kDa`
                    : "-",
                  sub: "Theoretical",
                },
                {
                  label: "Isoelectric point (pI)",
                  value: report.physicochemical.isoelectric_point?.toFixed(2) ?? "-",
                  sub: "±0.3 pH units typical error",
                },
                {
                  label: "Instability index",
                  value: report.physicochemical.instability_index?.toFixed(2) ?? "-",
                  sub: report.physicochemical.is_stable
                    ? "Predicted stable (<40)"
                    : "Predicted unstable (≥40)",
                },
                {
                  label: "GRAVY score",
                  value: report.physicochemical.gravy?.toFixed(4) ?? "-",
                  sub: report.physicochemical.hydrophilicity ?? "",
                },
                {
                  label: "Aromaticity",
                  value: report.physicochemical.aromaticity?.toFixed(4) ?? "-",
                  sub: "Phe + Trp + Tyr fraction",
                },
              ].map(({ label, value, sub }) => (
                <div key={label} className="rounded-lg border bg-card px-4 py-3 space-y-0.5">
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                  <p className="text-xl font-semibold tabular-nums">{value}</p>
                  {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
                </div>
              ))}
            </div>
            {report.physicochemical.method && (
              <p className="text-[10px] text-muted-foreground">
                Method: {report.physicochemical.method}
              </p>
            )}
          </div>
        )}

        {/* Adjuvant */}
        <div className="rounded-lg border p-4 space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium">{adjuvant.key} adjuvant</p>
            <Badge variant="secondary" className="text-[10px]">Prepended</Badge>
          </div>
          <p className="font-mono text-sm font-medium tracking-wider">{adjuvant.sequence}</p>
          <p className="text-xs text-muted-foreground">{adjuvant.mechanism}</p>
          <p className="text-[10px] text-muted-foreground">{adjuvant.citation}</p>
          {adjuvant.note && (
            <p className="text-[10px] text-muted-foreground italic">{adjuvant.note}</p>
          )}
        </div>

        {/* Linker scheme */}
        {report.linker_scheme && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Linker scheme
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(report.linker_scheme)
                .filter(([k]) => !k.includes("DEFAULT"))
                .map(([junction, seq]) => (
                  <div
                    key={junction}
                    className="flex items-center gap-1.5 rounded-full border px-3 py-1"
                  >
                    <span className="text-[10px] text-muted-foreground">{junction.replace("_", "-")}</span>
                    <code className="font-mono text-xs font-medium">{seq}</code>
                  </div>
                ))}
            </div>
            <p className="text-[10px] text-muted-foreground">{getLinkerCitation(report)}</p>
          </div>
        )}

        {/* Limitations */}
        {report.limitations && report.limitations.length > 0 && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-2">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
              Limitations  read before use
            </p>
            <ul className="space-y-1">
              {report.limitations.map((l, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5 shrink-0">-</span>
                  <p className="text-xs text-muted-foreground leading-relaxed">{l}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Next steps */}
        {report.next_steps && report.next_steps.length > 0 && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setNextStepsOpen(!nextStepsOpen)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {nextStepsOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              Recommended next steps
            </button>
            {nextStepsOpen && (
              <ol className="space-y-2 pl-1">
                {report.next_steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="font-mono text-[10px] text-muted-foreground mt-0.5 shrink-0 w-4">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="text-xs text-muted-foreground leading-relaxed">{s}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

      </CardContent>
    </Card>
  );
}