"use client";

/**
 * StructureCard - N5 3D Structure Retrieval
 *
 * Molstar integration via EMBL-EBI hosted viewer.
 * Uses the PDBe Molstar app which supports AlphaFold CIF URLs directly.
 * No npm packages required, iframe embed with URL parameters.
 *
 * AlphaFold DB link note: direct links to alphafold.ebi.ac.uk/entry/{id}
 * are blocked for some IPs due to EBI access policies. The CIF file URL
 * (alphafold.ebi.ac.uk/files/...) works for downloads. The viewer iframe
 * uses the official PDBe Molstar embed which has no access restrictions.
 */

import { useState } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Maximize2, Minimize2, ExternalLink, Download, AlertTriangle,
} from "lucide-react";

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

function pLDDTLabel(score: number): { label: string; color: string } {
  if (score >= 90) return { label: "Very high confidence", color: "text-foreground" };
  if (score >= 70) return { label: "Confident",            color: "text-foreground" };
  if (score >= 50) return { label: "Low confidence",       color: "text-muted-foreground" };
  return              { label: "Very low backbone unreliable", color: "text-destructive" };
}

function MolstarViewer({
  cifUrl,
  uniprotId,
  expanded,
}: {
  cifUrl: string;
  uniprotId: string;
  expanded: boolean;
}) {
  // PDBe Molstar embed official EMBL-EBI hosted viewer
  // Supports AlphaFold CIF URLs directly via the `url` parameter
  // pLDDT confidence coloring is applied automatically for AF models
  const molstarUrl = [
    "https://www.ebi.ac.uk/pdbe/entry/files/",
    `?url=${encodeURIComponent(cifUrl)}`,
    "&preset=alphafold-confidence",
    "&hideControls=false",
    "&bgColor=0,0,0",
  ].join("");

  // Use the simpler AlphaFold-specific embed URL
  const afdbEmbedUrl =
    `https://alphafold.ebi.ac.uk/entry/${uniprotId}` +
    `?view=structure`;

  // Primary: PDBe structure viewer with CIF URL
  const embedUrl =
    `https://www.ebi.ac.uk/pdbe/molstar-app/latest/index.html` +
    `?afdb=${uniprotId}` +
    `&hideControls=0`;

  return (
    <div
      className={`w-full rounded-lg overflow-hidden border bg-black transition-all duration-300 ${
        expanded ? "h-[560px]" : "h-[320px]"
      }`}
    >
      <iframe
        src={embedUrl}
        className="w-full h-full border-0"
        title={`AlphaFold structure: ${uniprotId}`}
        allow="fullscreen"
        loading="lazy"
      />
    </div>
  );
}

function StructureEntry({ s }: { s: StructureResult }) {
  const [expanded, setExpanded] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  const plddt = s.mean_plddt ?? 0;
  const { label: plddtLabel } = pLDDTLabel(plddt);
  const hasStructure = s.structure_source === "alphafold_db" && s.structure_pdb_url;
  const uniprotId = s.protein_id;

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">{s.protein_name}</p>
          <p className="font-mono text-xs text-muted-foreground">{s.protein_id}</p>
        </div>
        <Badge variant="outline" className="text-xs shrink-0">
          {s.structure_source === "alphafold_db" ? "AlphaFold DB" : "Unavailable"}
        </Badge>
      </div>

      {/* pLDDT bar */}
      {hasStructure && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Mean pLDDT</span>
            <span className="font-mono text-xs tabular-nums">
              {plddt.toFixed(1)} / 100
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-foreground transition-all duration-500"
              style={{ width: `${plddt}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">{plddtLabel}</p>
        </div>
      )}

      {/* Metadata grid */}
      {hasStructure && (
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Model version",  `v${s.model_version ?? "?"}`],
            ["Residue range",  s.residue_range ?? "-"],
            ["Entry ID",       s.entry_id ?? "-"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-muted/40 px-3 py-2 space-y-0.5">
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className="font-mono text-xs truncate">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Molstar viewer */}
      {viewerOpen && hasStructure && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              3D structure - pLDDT confidence coloring (blue=high, red=low)
            </p>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded
                ? <><Minimize2 className="size-3" /> Collapse</>
                : <><Maximize2 className="size-3" /> Expand</>}
            </button>
          </div>
          <MolstarViewer
            cifUrl={s.structure_pdb_url!}
            uniprotId={uniprotId}
            expanded={expanded}
          />
        </div>
      )}

      {/* Action buttons */}
      {hasStructure ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setViewerOpen(!viewerOpen)}
          >
            {viewerOpen ? "Hide structure" : "View 3D structure"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            asChild
          >
            <a href={s.structure_pdb_url} download>
              <Download className="size-3 mr-1.5" />
              Download CIF
            </a>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            asChild
          >
            <a
              href={`https://www.rcsb.org/search?query=${uniprotId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="size-3 mr-1.5" />
              PDB (experimental)
            </a>
          </Button>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2.5">
          <AlertTriangle className="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            No AlphaFold entry for this protein. Submit sequence to{" "}
            <a
              href="https://colab.research.google.com/github/sokrypton/ColabFold/blob/main/AlphaFold2.ipynb"
              target="_blank" rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              ColabFold
            </a>{" "}
            for de novo structure prediction.
          </p>
        </div>
      )}
    </div>
  );
}

export function StructureCard({ structures }: StructureCardProps) {
  const resolved = structures.filter((s) => s.structure_source === "alphafold_db");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">N5 3D Structure Retrieval</CardTitle>
            <CardDescription className="mt-1">
              AlphaFold DB lookup by UniProt accession. pLDDT scores indicate
              per-residue model confidence, not experimental validation.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs shrink-0">
            {resolved.length}/{structures.length} resolved
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {structures.map((s, i) => (
          <div key={s.protein_id}>
            {i > 0 && <div className="border-t mb-6" />}
            <StructureEntry s={s} />
          </div>
        ))}

        {/* Scientific footnote */}
        <p className="text-[10px] text-muted-foreground leading-relaxed border-t pt-3">
          pLDDT: per-residue confidence (0–100). ≥90 very high · ≥70 confident · ≥50 low · &lt;50 unreliable backbone.{" "}
          <a
            href="https://doi.org/10.1038/s41586-021-03819-2"
            target="_blank" rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Jumper et al. (2021)
          </a>
          . Source: AlphaFold Protein Structure Database (EBI/DeepMind).
          Computational predictions only for experimental structures see{" "}
          <a
            href="https://rcsb.org"
            target="_blank" rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            PDB (rcsb.org)
          </a>.
        </p>
      </CardContent>
    </Card>
  );
}