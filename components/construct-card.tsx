"use client";

/**
 * ConstructCard — N8 Construct Designer result display
 *
 * Renders:
 *   - Full construct sequence with copy button
 *   - Physicochemical summary (MW, pI, instability index, GRAVY)
 *   - Linker map with sequence annotations
 *   - RS09 adjuvant badge + reference
 *   - Limitations accordion (non-negotiable per CSO policy)
 *   - Next steps checklist
 *
 * All values are theoretical (ProtParam). No overconfidence claims.
 */

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// ---- Types ------------------------------------------------------------------

interface Physicochemical {
  molecular_weight_da?: number;
  isoelectric_point?: number;
  instability_index?: number;
  is_stable?: boolean;
  gravy?: number;
  hydrophilicity?: string;
  aromaticity?: number;
  method?: string;
  instability_reference?: string;
  error?: string;
}

interface ConstructReport {
  construct_sequence: string;
  length_aa: number;
  epitope_counts: { CTL: number; HTL: number; "B-cell": number };
  physicochemical: Physicochemical;
  adjuvant_included: boolean;
  adjuvant_sequence?: string;
  adjuvant_reference?: string;
  linker_scheme: Record<string, string>;
  linker_reference: string;
  limitations: string[];
  next_steps: string[];
  assembly_log?: Array<{
    element: string;
    sequence: string;
    hla_allele?: string;
    ic50_nm?: number;
    confidence?: string;
    rationale?: string;
  }>;
}

// ---- Sequence display with copy ---------------------------------------------

function SequenceBlock({ sequence }: { sequence: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(sequence).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Break into 10-char chunks for readability (FASTA-style)
  const chunks: string[] = [];
  for (let i = 0; i < sequence.length; i += 10) {
    chunks.push(sequence.slice(i, i + 10));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Construct sequence ({sequence.length} aa)
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={copy}
          className="h-7 text-xs gap-1.5"
        >
          {copied ? "Copied ✓" : "Copy FASTA"}
        </Button>
      </div>
      <div className="rounded-md bg-muted/60 border p-3 overflow-x-auto">
        <code className="font-mono text-xs leading-relaxed break-all tracking-wider text-foreground">
          {chunks.map((chunk, i) => (
            <React.Fragment key={i}>
              {chunk}
              {(i + 1) % 6 === 0 ? "\n" : " "}
            </React.Fragment>
          ))}
        </code>
      </div>
    </div>
  );
}

// ---- Physicochemical summary ------------------------------------------------

function PhyschemGrid({ props }: { props: Physicochemical }) {
  if (props.error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
        <p className="text-xs text-destructive">
          ProtParam computation failed: {props.error}. Install biopython≥1.83.
        </p>
      </div>
    );
  }

  const metrics = [
    {
      label: "Molecular weight",
      value:
        props.molecular_weight_da != null
          ? `${(props.molecular_weight_da / 1000).toFixed(2)} kDa`
          : "—",
      note: "Theoretical",
    },
    {
      label: "Isoelectric point (pI)",
      value: props.isoelectric_point != null
        ? props.isoelectric_point.toFixed(2)
        : "—",
      note: "±0.3 pH units typical error",
    },
    {
      label: "Instability index",
      value: props.instability_index != null
        ? props.instability_index.toFixed(2)
        : "—",
      note: props.is_stable != null
        ? (props.is_stable ? "Predicted stable (<40)" : "Predicted unstable (≥40) — review required")
        : "",
      highlight: props.is_stable === false ? "warning" : undefined,
    },
    {
      label: "GRAVY score",
      value: props.gravy != null ? props.gravy.toFixed(4) : "—",
      note: props.hydrophilicity ?? "",
    },
    {
      label: "Aromaticity",
      value: props.aromaticity != null ? props.aromaticity.toFixed(4) : "—",
      note: "Phe + Trp + Tyr fraction",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {metrics.map((m) => (
        <div
          key={m.label}
          className={`rounded-md border p-3 space-y-0.5 ${
            m.highlight === "warning"
              ? "border-yellow-500/40 bg-yellow-500/5"
              : "bg-card"
          }`}
        >
          <p className="text-xs text-muted-foreground">{m.label}</p>
          <p className="text-lg font-semibold font-mono tabular-nums">
            {m.value}
          </p>
          {m.note && (
            <p
              className={`text-[10px] leading-snug ${
                m.highlight === "warning"
                  ? "text-yellow-600 dark:text-yellow-400"
                  : "text-muted-foreground"
              }`}
            >
              {m.note}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ---- Linker legend ----------------------------------------------------------

function LinkerLegend({
  scheme,
  reference,
}: {
  scheme: Record<string, string>;
  reference: string;
}) {
  const displayed = Object.entries(scheme)
    .filter(([k]) => k !== "DEFAULT")
    .slice(0, 6);

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Linker scheme
      </p>
      <div className="flex flex-wrap gap-2">
        {displayed.map(([junction, linker]) => (
          <div
            key={junction}
            className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1"
          >
            <span className="text-[10px] text-muted-foreground">{junction}</span>
            <span className="text-xs font-mono font-medium">{linker}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Ref:{" "}
        <a
          href="https://doi.org/10.1016/j.compbiolchem.2014.08.020"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          {reference}
        </a>
      </p>
    </div>
  );
}

// ---- Epitope count summary --------------------------------------------------

function EpitopeSummary({
  counts,
}: {
  counts: { CTL: number; HTL: number; "B-cell": number };
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {(
        [
          { label: "CTL", count: counts.CTL, color: "default" },
          { label: "HTL", count: counts.HTL, color: "secondary" },
          { label: "B-cell", count: counts["B-cell"], color: "outline" },
        ] as const
      ).map((t) => (
        <div
          key={t.label}
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5"
        >
          <Badge variant={t.color} className="text-xs">
            {t.label}
          </Badge>
          <span className="text-sm font-semibold tabular-nums">{t.count}</span>
        </div>
      ))}
    </div>
  );
}

// ---- Main component ---------------------------------------------------------

export function ConstructCard({
  report,
}: {
  report: ConstructReport | null | undefined;
}) {
  if (!report) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">N8 — Construct Designer</CardTitle>
          <CardDescription>
            No construct was produced. This occurs when no safety-passed,
            confidence-scored epitopes remain after N6 filtering. Review N6
            safety screening results.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">
              N8 — Multi-Epitope Construct
            </CardTitle>
            <CardDescription className="mt-1">
              Assembled from safety-passed, high-confidence epitopes. All
              physicochemical values are theoretical (ProtParam). Requires
              wet-lab validation before any experimental use.
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {report.adjuvant_included && (
              <Badge variant="outline" className="text-xs">
                RS09 adjuvant
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs font-mono">
              {report.length_aa} aa
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Epitope count summary */}
        <EpitopeSummary counts={report.epitope_counts} />

        {/* Sequence block */}
        <SequenceBlock sequence={report.construct_sequence} />

        {/* Physicochemical properties */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Physicochemical properties
          </p>
          <PhyschemGrid props={report.physicochemical} />
          {report.physicochemical.method && (
            <p className="text-[10px] text-muted-foreground">
              Method: {report.physicochemical.method}
            </p>
          )}
        </div>

        {/* Adjuvant info */}
        {report.adjuvant_included && report.adjuvant_sequence && (
          <div className="rounded-md border bg-muted/30 p-3 space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium">RS09 TLR4 agonist adjuvant</p>
              <Badge variant="outline" className="text-[10px]">
                Prepended
              </Badge>
            </div>
            <code className="font-mono text-xs tracking-wider">
              {report.adjuvant_sequence}
            </code>
            {report.adjuvant_reference && (
              <p className="text-[10px] text-muted-foreground">
                {report.adjuvant_reference}. Immunogenicity established in
                murine models only.
              </p>
            )}
          </div>
        )}

        {/* Linker scheme */}
        <LinkerLegend
          scheme={report.linker_scheme}
          reference={report.linker_reference}
        />

        {/* Limitations — always visible, non-collapsible */}
        <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-2">
          <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 uppercase tracking-wider">
            Limitations — read before use
          </p>
          <ul className="space-y-1">
            {report.limitations.map((l, i) => (
              <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                <span className="text-yellow-500 shrink-0 mt-0.5">—</span>
                <span>{l}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Next steps accordion */}
        <Accordion type="single" collapsible>
          <AccordionItem value="next-steps" className="border rounded-md px-3">
            <AccordionTrigger className="text-sm font-medium py-3">
              Recommended next steps
            </AccordionTrigger>
            <AccordionContent>
              <ol className="space-y-2 pb-2">
                {report.next_steps.map((s, i) => (
                  <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                    <span className="font-mono text-primary shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}