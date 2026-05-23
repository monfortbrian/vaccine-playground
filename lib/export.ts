/**
 * export.ts — TOPE_DEEP result download utilities
 *
 * File naming:
 *   topdp_{pathogen}_{datatype}_{date}_v2_{runId8}.{ext}
 *
 * CSV columns include method_used so scientists can tell
 * whether VaxiJen ran (real) or ACC approximation was used,
 * and whether IC50 is from IEDB or approximated from rank.
 */

import type { Candidate } from "@/types";

const PIPELINE_VERSION = "v2";

function dl(blob: Blob, name: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

function buildFileName(
  candidates: Candidate[],
  runId: string,
  datatype: string,
  ext: string
): string {
  const pathogen =
    candidates[0]?.protein_name
      ?.split(" ")[0]
      ?.toLowerCase()
      ?.replace(/[^a-z0-9]/g, "") ?? "unknown";
  const date = new Date().toISOString().slice(0, 10);
  const id = runId.slice(0, 8);
  return `topdp_${pathogen}_${datatype}_${date}_${PIPELINE_VERSION}_${id}.${ext}`;
}

export function downloadJSON(
  data: unknown,
  runId: string,
  candidates: Candidate[]
): void {
  const name = buildFileName(candidates, runId, "fullreport", "json");
  dl(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    name
  );
}

export function downloadCSV(candidates: Candidate[], runId: string): void {
  const name = buildFileName(candidates, runId, "epitopes", "csv");

  // Headers include method_used and ic50_note for scientific traceability
  const headers = [
    "protein",
    "protein_id",
    "epitope_sequence",
    "type",
    "hla_allele",
    "ic50_nm",
    "ic50_note",
    "percentile_rank",
    "confidence",
    "allergenicity_safe",
    "toxicity_safe",
    "safety_verdict",
    "n3_method_used",
    "n6_method_used",
    "vaxijen_score",
    "localization",
  ];

  const rows = candidates.flatMap((c) =>
    c.epitopes.map((e) => {
      const toolOutputs = (e as any).tool_outputs ?? {};
      const safetyMethod = Object.values(
        toolOutputs.safety_method_used ?? {}
      ).join("; ");

      return [
        c.protein_name,
        c.protein_id,
        e.sequence,
        e.epitope_type,
        e.hla_allele ?? "",
        e.ic50_nm != null ? String(e.ic50_nm) : "",
        toolOutputs.ic50_note ?? "approximated_from_percentile_rank",
        (e as any).percentile_rank != null
          ? String((e as any).percentile_rank)
          : "",
        e.confidence,
        e.allergenicity_safe != null ? String(e.allergenicity_safe) : "unscored",
        e.toxicity_safe != null ? String(e.toxicity_safe) : "unscored",
        toolOutputs.safety_verdict ?? "",
        toolOutputs.method_used ?? "",
        safetyMethod,
        (c as any).vaxijen_score != null
          ? String((c as any).vaxijen_score)
          : "",
        (c as any).structure_source ?? "",
      ];
    })
  );

  const csv =
    headers.join(",") +
    "\n" +
    rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

  dl(new Blob([csv], { type: "text/csv" }), name);
}