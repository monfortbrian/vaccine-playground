/**
 * TOPE_DEEP result downloads
 *
 * CSV columns include tool_outputs fields (method_used, safety_verdict,
 * safety_method_used, ic50_note, animal_model_alleles) read from
 * epitope.tool_outputs JSONB which is now fully persisted to Supabase.
 *
 * Naming: TD_{pathogen}_{datatype}_{YYYYMMDD}_{runId8}.{ext}
 */

import type { Candidate } from "@/types";

function slugify(name: string | null | undefined): string {
  if (!name) return "unknown";
  const raw = name.trim();
  const uniprot = /^[OPQ][0-9][A-Z0-9]{3}[0-9]$|^[A-NR-Z][0-9][A-Z0-9]{5,9}$/i;
  if (uniprot.test(raw)) return raw.toLowerCase().slice(0, 12);
  return raw.split(/[\s\-_\/\(\)]+/)[0].toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) || "unknown";
}

function compactDate(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function buildFileName(
  candidates: Candidate[],
  runId: string,
  datatype: "epitopes" | "fullreport" | "construct" | "coverage",
  ext: "csv" | "json"
): string {
  const source = candidates[0]?.protein_name || candidates[0]?.protein_id;
  return `TD_${slugify(source)}_${datatype}_${compactDate()}_${runId.slice(0, 8)}.${ext}`;
}

function dl(blob: Blob, name: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

export function downloadJSON(data: unknown, runId: string, candidates: Candidate[]): void {
  dl(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    buildFileName(candidates, runId, "fullreport", "json")
  );
}

export function downloadCSV(candidates: Candidate[], runId: string): void {
  const headers = [
    "protein", "protein_id", "epitope_sequence", "type", "hla_allele",
    "ic50_nm", "ic50_note", "percentile_rank", "confidence",
    "allergenicity_safe", "toxicity_safe", "safety_verdict",
    "n3_method_used", "n6_method_used",
    "animal_model_alleles", "mamu_alleles",
    "vaxijen_score", "localization",
  ];

  const rows = candidates.flatMap((c) =>
    c.epitopes.map((e) => {
      const to = (e as any).tool_outputs ?? {};
      const safetyMethod = Object.values(to.safety_method_used ?? {}).join("; ");
      const animalAlleles = (to.animal_model_alleles ?? []).join("; ");
      const mamuAlleles   = (to.mamu_alleles ?? []).join("; ");

      return [
        c.protein_name,
        c.protein_id,
        e.sequence,
        e.epitope_type,
        e.hla_allele ?? "",
        e.ic50_nm != null ? String(e.ic50_nm) : "",
        to.ic50_note ?? "approximated_from_percentile_rank",
        (e as any).percentile_rank != null ? String((e as any).percentile_rank) : "",
        e.confidence,
        e.allergenicity_safe != null ? String(e.allergenicity_safe) : "unscored",
        e.toxicity_safe      != null ? String(e.toxicity_safe)      : "unscored",
        to.safety_verdict ?? "",
        to.method_used    ?? "",
        safetyMethod,
        animalAlleles,
        mamuAlleles,
        (c as any).vaxijen_score != null ? String((c as any).vaxijen_score) : "",
        (c as any).structure_source ?? "",
      ];
    })
  );

  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = headers.join(",") + "\n" + rows.map((r) => r.map(esc).join(",")).join("\n");
  dl(new Blob([csv], { type: "text/csv" }), buildFileName(candidates, runId, "epitopes", "csv"));
}

export function buildTDFileName(
  pathogenName: string | null | undefined,
  runId: string,
  datatype: "epitopes" | "fullreport" | "construct" | "coverage",
  ext: "csv" | "json"
): string {
  return `TD_${slugify(pathogenName)}_${datatype}_${compactDate()}_${runId.slice(0, 8)}.${ext}`;
}