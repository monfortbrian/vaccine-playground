export type InputType = "pathogen" | "uniprot_id" | "sequence";

export type PipelineStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "paused"
  | "cancelled";

export type PipelineNode = "N1" | "N2" | "N3" | "N4" | "N5" | "N6" | "N7" | "N8" | "N9" | "N10";

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
  tool_outputs?: {
    method_used?: string;
    ic50_note?: string;
    safety_verdict?: string;
    safety_method_used?: Record<string, string>;
    animal_model_alleles?: string[];
    mamu_alleles?: string[];
    human_hla_alleles?: string[];
  };
}

export interface Decision {
  stage: string;
  decision: string;
  reasoning: string;
  mean_plddt?: number;
  plddt_field_used?: string;
  model_version?: string;
  alphafold_entry_id?: string;
  fragment_coverage?: string;
  structure_source?: string;
  cif_url?: string;
  pdb_url?: string;
  colabfold_hint?: string;
  vaxijen_score?: number;
  vaxijen_method?: string;
  phobius_localization?: string;
  construct_length?: number;
  adjuvant_used?: string;
  instability_index?: number;
  is_stable?: boolean;
  per_population?: Record<string, CoverageDetail>;
  ctl_method?: string;
  htl_method?: string;
  mouse_h2_reactive?: number;
  mamu_reactive?: number;
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
  instability_ref?: string;
  error?: string;
}

export interface AdjuvantInfo {
  key: string;
  sequence: string;
  mechanism: string;
  validation: string;
  citation: string;
  note: string;
}

export interface ConstructReport {
  construct_sequence: string;
  length_aa: number;
  epitope_counts: { CTL: number; HTL: number; "B-cell": number };
  physicochemical: Physicochemical;
  adjuvant: AdjuvantInfo;
  adjuvant_included?: boolean;
  adjuvant_sequence?: string;
  adjuvant_reference?: string;
  linker_scheme: Record<string, string>;
  linker_citation: string;
  linker_reference?: string;
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
  structure_source?: string | null;
  structure_pdb_url?: string | null;
  phobius_localization?: string | null;
  vaxijen_score?: number | null;
  vaxijen_method?: string | null;
  epitopes: Epitope[];
  decisions: Decision[];
  coverage_detail: Record<string, CoverageDetail> | null;
}

export interface PipelineTiming {
  total_seconds: number;
  n1_curation?: number;
  n2_screening?: number;
  n3_tcell?: number;
  n4_bcell?: number;
  n5_structure?: number;
  n6_safety?: number;
  n7_coverage?: number;
  n8_construct?: number;
  n9_literature?: number | null;
  n10_experiment?: number | null;
}

export interface PipelineResults {
  run_id: string;
  status: PipelineStatus;
  timing: PipelineTiming;
  candidates: Candidate[];
  construct_report?: ConstructReport | null;
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
  has_construct?: boolean;
  // NEW: size of serialized run data in bytes (estimated from candidates+epitopes)
  size_bytes?: number | null;
  // NEW: archived timestamp set when user archives, cleared on restore
  archived_at?: string | null;
}

export interface NodeInfo {
  id: PipelineNode;
  label: string;
  description: string;
  shortDesc: string;
  tool: string;
}

export const PIPELINE_NODES: NodeInfo[] = [
  { id: "N1",  label: "Data Curation",      description: "Fetch pathogen proteome from UniProt & NCBI",                                       shortDesc: "Proteome fetch",    tool: "UniProt · NCBI"         },
  { id: "N2",  label: "Antigen Screening",   description: "Identify surface-exposed antigenic proteins via Phobius and VaxiJen",               shortDesc: "Surface antigens",  tool: "VaxiJen · Phobius"      },
  { id: "N3",  label: "T-Cell Prediction",   description: "Predict CTL and HTL epitopes binding human HLA, mouse H-2, macaque Mamu",           shortDesc: "CTL / HTL epitopes",tool: "NetMHCpan · IEDB"       },
  { id: "N4",  label: "B-Cell Prediction",   description: "Identify linear and conformational antibody-binding regions",                        shortDesc: "Antibody epitopes", tool: "BepiPred · ESM-2"       },
  { id: "N5",  label: "Structure Retrieval", description: "Retrieve 3D protein structure from AlphaFold DB by UniProt accession",              shortDesc: "3D structure",      tool: "AlphaFold DB"           },
  { id: "N6",  label: "Safety Filter",       description: "WHO allergenicity, AllerTOP v2.0, HemoPI, FDA/EMA human homology",                  shortDesc: "Safety checks",     tool: "AllerTOP · HemoPI"      },
  { id: "N7",  label: "Population Coverage", description: "HLA coverage across global and African populations",                                 shortDesc: "HLA coverage",      tool: "IEDB · AFND 2020"       },
  { id: "N8",  label: "Construct Design",    description: "Multi-epitope construct with configurable adjuvant and ProtParam analysis",          shortDesc: "Final construct",   tool: "ProtParam · RS09"       },
  { id: "N9",  label: "Literature Agent",    description: "PubMed search + Qdrant semantic retrieval + Claude synthesis",                       shortDesc: "Literature",        tool: "PubMed · Qdrant"        },
  { id: "N10", label: "Experiment Planner",  description: "AI-generated wet-lab validation roadmap",                                            shortDesc: "Wet-lab plan",      tool: "Anthropic Claude"             },
];