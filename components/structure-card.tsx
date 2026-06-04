"use client";

/**
 * N5 3D Structure Retrieval
 *
 * Molstar viewer: molstar.org/viewer/?afdb={uniprotId}
 * This is the correct embed, loads from AlphaFold DB directly,
 * pLDDT confidence coloring applied automatically, no access denied.
 *
 * Design: Apple HIG neutral, DM Sans, precise spacing, no pill badges,
 * no vibe-coded clutter. Every element earns its place.
 */

import { useState } from "react";
import { Download, ExternalLink, Maximize2, Minimize2, AlertTriangle, Dna } from "lucide-react";

interface StructureResult {
  protein_name: string;
  protein_id: string;
  structure_source: string;
  structure_pdb_url?: string;
  mean_plddt?: number;
  model_version?: string;
  residue_range?: string;
  entry_id?: string;
}

interface StructureCardProps {
  structures: StructureResult[];
}

function pLDDTColor(score: number): string {
  if (score >= 90) return "bg-foreground";
  if (score >= 70) return "bg-foreground/70";
  if (score >= 50) return "bg-foreground/40";
  return "bg-destructive/60";
}

function pLDDTLabel(score: number): string {
  if (score >= 90) return "Very high confidence";
  if (score >= 70) return "Confident";
  if (score >= 50) return "Low confidence";
  return "Very low backbone unreliable";
}

function StructureEntry({ s }: { s: StructureResult }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [expanded,   setExpanded]   = useState(false);

  const plddt    = s.mean_plddt ?? 0;
  const hasEntry = s.structure_source === "alphafold_db";

  // Correct Molstar URL loads from AlphaFold DB directly, pLDDT colored
  const molstarUrl = `https://molstar.org/viewer/?afdb=${s.protein_id}`;

  return (
    <div className="space-y-4">

      {/* Protein header row */}
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-0.5 min-w-0">
          <p className="text-[15px] font-semibold leading-snug truncate">
            {s.protein_name}
          </p>
          <p className="font-mono text-xs text-muted-foreground tracking-wide">
            {s.protein_id}
          </p>
        </div>
        <span
          className={[
            "shrink-0 rounded-md px-2.5 py-1 text-xs font-medium",
            hasEntry
              ? "bg-foreground/8 text-foreground"
              : "bg-muted text-muted-foreground",
          ].join(" ")}
        >
          {hasEntry ? "AlphaFold DB" : "Unavailable"}
        </span>
      </div>

      {/* pLDDT confidence */}
      {hasEntry && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">Mean pLDDT</span>
            <span className="font-mono text-sm font-semibold tabular-nums">
              {plddt.toFixed(1)}
              <span className="text-muted-foreground font-normal"> / 100</span>
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${pLDDTColor(plddt)}`}
              style={{ width: `${plddt}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">{pLDDTLabel(plddt)}</p>
        </div>
      )}

      {/* Metadata */}
      {hasEntry && (
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Model version",  s.model_version ? `v${s.model_version}` : "-"],
            ["Residue range",  s.residue_range ?? "-"],
            ["Entry ID",       s.entry_id ?? "-"],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-lg bg-muted/50 px-3 py-2.5 space-y-1">
              <p className="text-[10px] text-muted-foreground leading-none">{label}</p>
              <p className="font-mono text-xs font-medium truncate">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Molstar viewer */}
      {viewerOpen && hasEntry && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">
              pLDDT coloring blue = high confidence · red = low confidence
            </p>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded
                ? <><Minimize2 className="size-3" />Collapse</>
                : <><Maximize2 className="size-3" />Expand</>}
            </button>
          </div>
          <div
            className={[
              "w-full rounded-xl overflow-hidden border border-border",
              "transition-all duration-300",
              expanded ? "h-[600px]" : "h-[360px]",
            ].join(" ")}
          >
            <iframe
              src={molstarUrl}
              className="w-full h-full border-0"
              title={`AlphaFold structure ${s.protein_id}`}
              allow="fullscreen"
              loading="lazy"
            />
          </div>
        </div>
      )}

      {/* Action row */}
      {hasEntry ? (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setViewerOpen(!viewerOpen)}
            className={[
              "inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium",
              "transition-colors duration-150",
              viewerOpen
                ? "bg-foreground text-background hover:bg-foreground/90"
                : "bg-foreground/8 text-foreground hover:bg-foreground/12 border border-border",
            ].join(" ")}
          >
            <Dna className="size-3.5" />
            {viewerOpen ? "Hide viewer" : "View 3D structure"}
          </button>

          {s.structure_pdb_url && (
            <a
              href={s.structure_pdb_url}
              download
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-transparent px-4 text-sm font-medium text-foreground hover:bg-accent transition-colors duration-150"
            >
              <Download className="size-3.5" />
              Download CIF
            </a>
          )}

          <a
            href={`https://www.rcsb.org/search?query=${s.protein_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-transparent px-4 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-150"
          >
            <ExternalLink className="size-3.5" />
            Experimental (PDB)
          </a>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3.5">
          <AlertTriangle className="size-4 shrink-0 text-muted-foreground mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              No AlphaFold entry for this protein.
            </p>
            <a
              href="https://colab.research.google.com/github/sokrypton/ColabFold/blob/main/AlphaFold2.ipynb"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-foreground underline underline-offset-4 hover:opacity-70 transition-opacity"
            >
              Submit to ColabFold for de novo prediction →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export function StructureCard({ structures }: StructureCardProps) {
  const resolved = structures.filter((s) => s.structure_source === "alphafold_db");

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">

      {/* Card header */}
      <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-5 border-b border-border">
        <div className="space-y-1">
          <h3 className="text-[15px] font-semibold tracking-tight">
            N5 - 3D Structure Retrieval
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-lg">
            AlphaFold DB lookup by UniProt accession. pLDDT scores indicate
            per-residue model confidence, not experimental validation.
          </p>
        </div>
        <div className="shrink-0 rounded-md bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground tabular-nums font-medium">
          {resolved.length}/{structures.length} resolved
        </div>
      </div>

      {/* Entries */}
      <div className="divide-y divide-border">
        {structures.map((s) => (
          <div key={s.protein_id} className="px-6 py-5">
            <StructureEntry s={s} />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-border bg-muted/20">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          pLDDT: per-residue confidence (0–100).{" "}
          ≥90 very high · ≥70 confident · ≥50 low · &lt;50 backbone unreliable.{" "}
          <a
            href="https://doi.org/10.1038/s41586-021-03819-2"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Jumper et al. (2021)
          </a>
          . Source: AlphaFold Protein Structure Database (EBI/DeepMind).
          Computational predictions only for experimental structures see{" "}
          <a
            href="https://rcsb.org"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            PDB (rcsb.org)
          </a>.
        </p>
      </div>
    </div>
  );
}