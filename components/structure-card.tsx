"use client";

/**
 * StructureCard — N5 Structure Retrieval result display
 *
 * Shows AlphaFold DB hit/miss per candidate protein.
 * pLDDT confidence bands:
 *   ≥ 90   very high  (dark blue  in AlphaFold colouring)
 *   70–89  confident  (light blue)
 *   50–69  low        (yellow)
 *   < 50   very low   (orange)
 *
 * Reference: Jumper et al. (2021) Nature doi:10.1038/s41586-021-03819-2
 */

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Candidate } from "@/types";

interface StructureDecision {
  stage: string;
  decision: string;
  reasoning: string;
  structure_source?: string;
  mean_plddt?: number;
  pdb_url?: string;
  cif_url?: string;
  alphafold_entry_id?: string;
  model_version?: string;
  fragment_coverage?: string;
  colabfold_hint?: string;
}

function getPlddt(decisions: Candidate["decisions"]): StructureDecision | null {
  return (
    (decisions?.find(
      (d) => d.stage === "structure_retrieval"
    ) as StructureDecision) ?? null
  );
}

function PlddtBand({ score }: { score: number }) {
  let label: string;
  let className: string;
  let barColor: string;

  if (score >= 90) {
    label = "Very high confidence";
    className = "text-blue-600 dark:text-blue-400";
    barColor = "bg-blue-600 dark:bg-blue-400";
  } else if (score >= 70) {
    label = "Confident";
    className = "text-sky-500 dark:text-sky-400";
    barColor = "bg-sky-500 dark:bg-sky-400";
  } else if (score >= 50) {
    label = "Low confidence";
    className = "text-yellow-500 dark:text-yellow-400";
    barColor = "bg-yellow-500 dark:bg-yellow-400";
  } else {
    label = "Very low confidence";
    className = "text-orange-500 dark:text-orange-400";
    barColor = "bg-orange-500 dark:bg-orange-400";
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Mean pLDDT</span>
        <span className={`text-xs font-semibold font-mono ${className}`}>
          {score.toFixed(1)} / 100
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
      <p className={`text-xs ${className}`}>{label}</p>
    </div>
  );
}

function StructureEntry({ candidate }: { candidate: Candidate }) {
  const decision = getPlddt(candidate.decisions);
  const source = candidate.structure_source;
  const pdbUrl = candidate.structure_pdb_url;

  const isHit = source === "alphafold_db";
  const isUnavailable = source === "unavailable" || !source;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{candidate.protein_name}</p>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            {candidate.protein_id}
          </p>
        </div>
        <Badge
          variant={isHit ? "default" : "secondary"}
          className="shrink-0 text-xs"
        >
          {isHit ? "AlphaFold DB" : "Unavailable"}
        </Badge>
      </div>

      {isHit && decision && (
        <>
          {/* pLDDT bar */}
          {decision.mean_plddt != null && (
            <PlddtBand score={decision.mean_plddt} />
          )}

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {decision.model_version && (
              <>
                <span className="text-muted-foreground">Model version</span>
                <span className="font-mono">{decision.model_version}</span>
              </>
            )}
            {decision.fragment_coverage && (
              <>
                <span className="text-muted-foreground">Residue range</span>
                <span className="font-mono">{decision.fragment_coverage}</span>
              </>
            )}
            {decision.alphafold_entry_id && (
              <>
                <span className="text-muted-foreground">Entry ID</span>
                <span className="font-mono">{decision.alphafold_entry_id}</span>
              </>
            )}
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-2 pt-1">
            {pdbUrl && (
              <a
                href={pdbUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                View structure ↗
              </a>
            )}
            {candidate.protein_id && candidate.protein_id !== "user_input" && (
              <a
                href={`https://alphafold.ebi.ac.uk/entry/${candidate.protein_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                AlphaFold DB ↗
              </a>
            )}
          </div>
        </>
      )}

      {isUnavailable && decision && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {decision.decision === "skipped"
              ? "Non-UniProt accession — AlphaFold lookup not applicable."
              : "No entry in AlphaFold DB for this accession. Conformational B-cell epitope accuracy is reduced; linear sequence only was used."}
          </p>
          {decision.colabfold_hint && (
            <a
              href={decision.colabfold_hint}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Submit to ColabFold ↗
            </a>
          )}
        </div>
      )}

      {/* pLDDT legend note */}
      {isHit && (
        <p className="text-[10px] text-muted-foreground border-t pt-2">
          pLDDT: per-residue confidence score (0–100). ≥70 = reliable backbone.{" "}
          <a
            href="https://doi.org/10.1038/s41586-021-03819-2"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            Jumper et al. (2021)
          </a>
        </p>
      )}
    </div>
  );
}

export function StructureCard({ candidates }: { candidates: Candidate[] }) {
  const withStructure = candidates.filter(
    (c) => c.structure_source === "alphafold_db"
  ).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">
              N5 — 3D Structure Retrieval
            </CardTitle>
            <CardDescription className="mt-1">
              AlphaFold DB lookup by UniProt accession. pLDDT scores indicate
              per-residue model confidence, not experimental validation.
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs shrink-0">
            {withStructure}/{candidates.length} resolved
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {candidates.map((c) => (
          <StructureEntry key={c.protein_id} candidate={c} />
        ))}

        <p className="text-[10px] text-muted-foreground pt-1">
          Source: AlphaFold Protein Structure Database (EBI/DeepMind).
          Structures are computational predictions — not experimentally
          determined. For crystallographic or cryo-EM data, cross-reference
          with PDB (rcsb.org).
        </p>
      </CardContent>
    </Card>
  );
}