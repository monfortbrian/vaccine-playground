/**
 * export.ts - TOPE_DEEP result download utilities
 *
 * File naming convention:
 *   TD_{pathogen}_{datatype}_{YYYYMMDD}_{runId8}.{ext}
 *
 * Examples:
 *   TD_mtb_epitopes_20260523_d07e53cb.csv
 *   TD_spike_fullreport_20260523_d07e53cb.json
 *   TD_p9wnk7_epitopes_20260523_d07e53cb.csv
 *   TD_custom_epitopes_20260523_d07e53cb.csv
 *
 * Rules:
 *   TD_       prefix - TOPE_DEEP abbreviation, always uppercase
 *   pathogen  first meaningful word from protein/pathogen name, lowercase,
 *             alphanumeric only, max 12 chars. Falls back to UniProt ID slug.
 *   datatype  epitopes | fullreport | construct | coverage
 *   YYYYMMDD  compact ISO date, sortable, no separators
 *   runId8    first 8 chars of run UUID for traceability
 *
 * CSV columns include method_used and ic50_note so scientists can verify
 * which tools ran and that IC50 is approximated, not measured.
 */

import type { Candidate } from "@/types";

// ── Slug builder ─────────────────────────────────────────────────────────────

function slugify(name: string | null | undefined): string {
  if (!name) return "unknown";

  const raw = name.trim();

  // If it looks like a UniProt accession (P9WNK7, P0DTC2 etc) use it directly
  const uniprotPattern = /^[OPQ][0-9][A-Z0-9]{3}[0-9]$|^[A-NR-Z][0-9][A-Z0-9]{5,9}$/i;
  if (uniprotPattern.test(raw)) {
    return raw.toLowerCase().slice(0, 12);
  }

  // Take first meaningful word, strip non-alphanumeric, lowercase, cap at 12
  const slug = raw
    .split(/[\s\-_\/\(\)]+/)[0]   // first word
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")    // alphanumeric only
    .slice(0, 12);

  return slug || "unknown";
}

function compactDate(): string {
  // YYYYMMDD - sortable, no separators
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function buildFileName(
  candidates: Candidate[],
  runId: string,
  datatype: "epitopes" | "fullreport" | "construct" | "coverage",
  ext: "csv" | "json"
): string {
  // Prefer protein_name, fall back to protein_id
  const source = candidates[0]?.protein_name || candidates[0]?.protein_id;
  const pathogen = slugify(source);
  const date = compactDate();
  const id = runId.slice(0, 8);
  return `TD_${pathogen}_${datatype}_${date}_${id}.${ext}`;
}

// ── Download helper ───────────────────────────────────────────────────────────

function dl(blob: Blob, name: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Download the full pipeline result as JSON.
 * Filename: TD_{pathogen}_fullreport_{YYYYMMDD}_{runId8}.json
 */
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

/**
 * Download epitopes as CSV with full audit trail columns.
 * Filename: TD_{pathogen}_epitopes_{YYYYMMDD}_{runId8}.csv
 *
 * Columns:
 *   protein, protein_id, epitope_sequence, type, hla_allele,
 *   ic50_nm, ic50_note, percentile_rank, confidence,
 *   allergenicity_safe, toxicity_safe, safety_verdict,
 *   n3_method_used, n6_method_used, vaxijen_score, localization
 */
export function downloadCSV(candidates: Candidate[], runId: string): void {
  const name = buildFileName(candidates, runId, "epitopes", "csv");

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
      const to = (e as any).tool_outputs ?? {};
      const safetyMethod = Object.values(
        to.safety_method_used ?? {}
      ).join("; ");

      return [
        c.protein_name,
        c.protein_id,
        e.sequence,
        e.epitope_type,
        e.hla_allele ?? "",
        e.ic50_nm != null ? String(e.ic50_nm) : "",
        to.ic50_note ?? "approximated_from_percentile_rank",
        (e as any).percentile_rank != null
          ? String((e as any).percentile_rank)
          : "",
        e.confidence,
        e.allergenicity_safe != null
          ? String(e.allergenicity_safe)
          : "unscored",
        e.toxicity_safe != null
          ? String(e.toxicity_safe)
          : "unscored",
        to.safety_verdict ?? "",
        to.method_used ?? "",
        safetyMethod,
        (c as any).vaxijen_score != null
          ? String((c as any).vaxijen_score)
          : "",
        (c as any).structure_source ?? "",
      ];
    })
  );

  const escape = (v: string) =>
    `"${String(v).replace(/"/g, '""')}"`;

  const csv =
    headers.join(",") +
    "\n" +
    rows.map((r) => r.map(escape).join(",")).join("\n");

  dl(new Blob([csv], { type: "text/csv" }), name);
}

/**
 * Slug builder exposed for history page DownloadMenu
 * so filenames are consistent across results and history.
 */
export function buildTDFileName(
  pathogenName: string | null | undefined,
  runId: string,
  datatype: "epitopes" | "fullreport" | "construct" | "coverage",
  ext: "csv" | "json"
): string {
  const pathogen = slugify(pathogenName);
  const date = compactDate();
  const id = runId.slice(0, 8);
  return `TD_${pathogen}_${datatype}_${date}_${id}.${ext}`;
}