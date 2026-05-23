// types/index.ts — full replacement
// Changes from previous version:
//   - PipelineNode: added 'N5' | 'N8'
//   - PIPELINE_NODES: added N5 and N8 entries
//   - PipelineTiming: added n5_structure, n8_construct
//   - Candidate: added structure_source, structure_pdb_url, construct_report
//   - Added ConstructReport, Physicochemical interfaces

export type InputType = "pathogen" | "uniprot_id" | "sequence";

export type PipelineStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "paused"
  | "cancelled";

// N5 and N8 added
export type PipelineNode = "N1" | "N2" | "N3" | "N4" | "N5" | "N6" | "N7" | "N8";

export interface PipelineRunRequest {
  input_type: InputType;
  input_value: string;
  max_proteins?: number;
  protein_name?: string;
}

export interface PipelineRunResponse {
  run_id: string;
  status: PipelineStatus;
}

export interface PipelineStatusResponse {
  run_id: string;
  status: PipelineStatus;
  current_node: PipelineNode | null;
  progress: number;
  message: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface CoverageDetail {
  mhc_i_pct: number;
  mhc_ii_pct: number;
  combined_pct: number;
  population_label: string;
}

export interface Epitope {
  sequence: string;
  epitope_type: "CTL" | "HTL" | "B-cell";
  hla_allele: string | null;
  ic50_nm: number | null;
  percentile_rank: number | null;
  confidence: "high" | "medium" | "low";
  allergenicity_safe: boolean | null;
  toxicity_safe: boolean | null;
}

export interface Decision {
  stage: string;
  decision: string;
  reasoning: string;
  // structure_retrieval fields
  mean_plddt?: number;
  model_version?: string;
  alphafold_entry_id?: string;
  fragment_coverage?: string;
  structure_source?: string;
  colabfold_hint?: string;
  // construct_design fields
  construct_length?: number;
  instability_index?: number;
  is_stable?: boolean;
  // coverage fields
  per_population?: Record<string, CoverageDetail>;
}

export interface Physicochemical {
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

export interface ConstructReport {
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

export interface Candidate {
  protein_id: string;
  protein_name: string;
  sequence_length: number;
  ctl_count: number;
  ctl_strong: number;
  htl_count: number;
  bcell_count: number;
  global_coverage_pct: number;
  african_coverage_pct: number;
  // N5 fields
  structure_source?: string | null;
  structure_pdb_url?: string | null;
  // Epitopes + decisions
  epitopes: Epitope[];
  decisions: Decision[];
  coverage_detail: Record<string, CoverageDetail> | null;
}

export interface PipelineTiming {
  total_seconds: number;
  n2_screening?: number;
  n3_tcell?: number;
  n4_bcell?: number;
  n5_structure?: number;  // N5 added
  n6_safety?: number;
  n7_coverage?: number;
  n8_construct?: number;  // N8 added
}

export interface PipelineResults {
  run_id: string;
  status: PipelineStatus;
  timing: PipelineTiming;
  candidates: Candidate[];
  construct_report?: ConstructReport | null;  // N8 added
}

export interface RunSummary {
  id: string;
  pathogen_name: string | null;
  input_type: InputType;
  status: PipelineStatus;
  created_at: string;
  completed_at: string | null;
  epitope_count?: number;
  global_coverage?: number;
  has_construct?: boolean;  // N8 flag
}

export interface NodeInfo {
  id: PipelineNode;
  label: string;
  description: string;
  shortDesc: string;
  tool: string;  // primary tool/source for this node
}

// N5 and N8 added — order matches pipeline execution
export const PIPELINE_NODES: NodeInfo[] = [
  {
    id: "N1",
    label: "Data Curation",
    description: "Fetch pathogen proteome from UniProt & NCBI, filter human-homologous proteins",
    shortDesc: "Proteome fetch",
    tool: "UniProt · NCBI",
  },
  {
    id: "N2",
    label: "Antigen Screening",
    description: "Identify surface-exposed, antigenic proteins via PSORTb, TMHMM, VaxiJen",
    shortDesc: "Surface antigens",
    tool: "VaxiJen · Phobius",
  },
  {
    id: "N3",
    label: "T-Cell Prediction",
    description: "Predict CTL & HTL epitopes binding HLA class I and II molecules",
    shortDesc: "CTL / HTL epitopes",
    tool: "NetMHCpan · IEDB",
  },
  {
    id: "N4",
    label: "B-Cell Prediction",
    description: "Identify linear and conformational antibody-binding regions",
    shortDesc: "Antibody epitopes",
    tool: "BepiPred · ESM-2",
  },
  {
    id: "N5",
    label: "Structure Retrieval",
    description: "Retrieve 3D protein structure from AlphaFold DB by UniProt accession",
    shortDesc: "3D structure",
    tool: "AlphaFold DB",
  },
  {
    id: "N6",
    label: "Safety Filter",
    description: "Screen all epitopes for allergenicity and toxicity",
    shortDesc: "Safety checks",
    tool: "AllerTOP · ToxinPred",
  },
  {
    id: "N7",
    label: "Population Coverage",
    description: "Calculate HLA coverage across global and African populations",
    shortDesc: "HLA coverage",
    tool: "IEDB Coverage",
  },
  {
    id: "N8",
    label: "Construct Design",
    description: "Assemble multi-epitope construct with linkers, adjuvant, and ProtParam analysis",
    shortDesc: "Final construct",
    tool: "ProtParam · RS09",
  },
];