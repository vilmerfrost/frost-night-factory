// lib/pipeline/pipeline-json-types.ts
// JSON-based Pipeline Type Definitions for Full Context Passing
// Each phase outputs structured JSON with references to previous phases

/**
 * Base interface for all pipeline phase outputs
 */
export interface BasePipelinePhaseJSON {
  phase: string;
  timestamp: string;
  raw_text_audit?: string; // Original raw text for audit trail
  full_raw_output?: string; // ✅ COMPLETE raw text from AI agent (ENTIRE output, not summary)
}

/**
 * Input reference for tracing context chain
 */
export interface PhaseReference {
  timestamp: string;
  summary?: string;
}

// ============================================================
// 1. RESEARCH PHASE OUTPUT
// ============================================================

export interface ResearchSourceResult {
  title: string;
  url?: string;
  snippet: string;
  relevance_score: number;
  key_takeaways: string[];
}

export interface ResearchSources {
  perplexity?: {
    query: string;
    results: ResearchSourceResult[];
    summary: string;
  };
  kimi_k2?: {
    query: string;
    results: ResearchSourceResult[];
    summary: string;
  };
  gemini?: {
    query: string;
    results: ResearchSourceResult[];
    summary: string;
  };
}

export interface ExtractedRequirement {
  id: string;
  name: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  technical_constraints?: string[];
  source?: string[];
}

export interface TechRecommendation {
  choice: string;
  reason: string;
  alternatives?: string[];
  confidence: number;
}

export interface PotentialChallenge {
  challenge: string;
  solution: string;
  risk_level: "low" | "medium" | "high";
  estimated_effort_hours?: number;
}

export interface CompetitorAnalysis {
  name: string;
  strengths: string[];
  weaknesses: string[];
  our_advantage?: string;
}

export interface ResearchPhaseJSON extends BasePipelinePhaseJSON {
  phase: "research";
  sources: ResearchSources;
  extracted_requirements: {
    must_have: ExtractedRequirement[];
    should_have: ExtractedRequirement[];
    nice_to_have: ExtractedRequirement[];
  };
  technology_recommendations: {
    frontend: TechRecommendation;
    backend: TechRecommendation;
    database: TechRecommendation;
    ui_library?: TechRecommendation;
    auth?: TechRecommendation;
  };
  potential_challenges: PotentialChallenge[];
  competitive_analysis?: {
    similar_tools: CompetitorAnalysis[];
  };
  best_practices_found: string[];
  estimated_scope: {
    total_features: number;
    estimated_dev_hours: number;
    estimated_timeline_weeks: number;
    complexity_score: number; // 0-10 scale
  };
}

// ============================================================
// 2. PLANNER PHASE OUTPUT
// ============================================================

export interface FieldDefinition {
  name: string;
  type: string;
  primary_key?: boolean;
  foreign_key?: string;
  required?: boolean;
  unique?: boolean;
  default?: string;
  enum_values?: string[];
}

export interface TableDefinition {
  name: string;
  columns: FieldDefinition[];
}

export interface FeatureBreakdown {
  feature_id: string;
  name: string;
  description: string;
  components?: string[];
  database_tables?: string[];
  api_endpoints?: string[];
  npm_packages?: string[];
  estimated_hours: number;
  dependencies: string[];
  priority: number;
  technical_notes?: string;
  status?: "planned" | "in_progress" | "complete";
}

export interface ApiRouteDefinition {
  path: string;
  method?: string;
  description: string;
  body?: Record<string, string>;
  query_params?: Record<string, string>;
  response?: Record<string, string>;
}

export interface TimelinePhase {
  week: number;
  features: string[];
  milestone: string;
}

export interface RiskMitigation {
  risk: string;
  mitigation: string;
  contingency?: string;
}

export interface PlannerPhaseJSON extends BasePipelinePhaseJSON {
  phase: "planner";
  input_references: {
    research_timestamp: string;
    research_summary?: string;
  };
  project_overview: {
    name: string;
    description: string;
    objectives: string[];
  };
  tech_stack: {
    frontend: {
      framework: string;
      language: string;
      ui_library: string;
      styling: string;
      state_management?: string;
    };
    backend: {
      runtime: string;
      language: string;
    };
    database: {
      type: string;
      provider: string;
      auth?: string;
    };
    external_services?: Array<{
      service: string;
      options: string[];
      choice: string;
    }>;
  };
  feature_breakdown: {
    phase_1_mvp: FeatureBreakdown[];
    phase_2_optional?: FeatureBreakdown[];
  };
  database_schema_outline: {
    tables: TableDefinition[];
  };
  component_tree: {
    app: {
      children: string[];
    };
    components: {
      layout?: string[];
      ui?: string[];
      [key: string]: string[] | undefined;
    };
    lib?: string[];
  };
  api_routes_planned: ApiRouteDefinition[];
  timeline: {
    total_weeks: number;
    phases: TimelinePhase[];
  };
  risks_and_mitigations: RiskMitigation[];
  success_criteria: string[];
  warnings?: string[]; // ✅ Optional warnings field for fallback scenarios
}

// ============================================================
// 3. CODER PHASE OUTPUT
// ============================================================

export interface GeneratedFile {
  path: string;
  lines: number;
  purpose: string;
  exports?: string[];
  depends_on?: string;
  imports_from_plan?: string[];
  uses_types?: string[];
  uses_api?: string[];
  external_libs?: string[];
  status: "complete" | "partial" | "needs_review";
  notes?: string;
}

export interface TypeDefinition {
  name: string;
  fields: string[];
  matches_plan_schema?: boolean;
}

export interface DependencyUsed {
  package: string;
  version: string;
  reason: string;
}

export interface CodeQualityMetrics {
  typescript_errors: number;
  typescript_warnings: number;
  eslint_errors: number;
  eslint_warnings: number;
  components_without_docstrings?: number;
  functions_documented?: number;
  test_coverage?: number;
  linting_status: "passing" | "passing_with_warnings" | "failing";
}

export interface FeatureImplementation {
  feature_id: string;
  status: "complete" | "partial" | "blocked";
  files_created: string[];
  plan_matches: boolean;
  notes?: string;
}

export interface CoderPhaseJSON extends BasePipelinePhaseJSON {
  phase: "coder";
  input_references: {
    research_timestamp: string;
    plan_timestamp: string;
    plan_summary?: string;
  };
  code_generated: {
    frontend: {
      files_count: number;
      total_lines: number;
      language: string;
      files: GeneratedFile[];
    };
    backend: {
      files_count: number;
      total_lines: number;
      language: string;
      files: GeneratedFile[];
    };
  };
  type_definitions: {
    coverage: number;
    strict_mode: boolean;
    files_with_any: number;
    types_defined: TypeDefinition[];
  };
  dependencies_used: DependencyUsed[];
  code_quality_metrics: CodeQualityMetrics;
  features_implemented: FeatureImplementation[];
  critical_notes_for_sql_editor: string[];
}

// ============================================================
// 4. SQL EDITOR PHASE OUTPUT
// ============================================================

export interface CreatedTable {
  name: string;
  sql: string;
  columns_count: number;
  indexes?: number;
  relationships?: number;
  validation_rules?: string[];
  foreign_keys?: string[];
}

export interface RLSPolicy {
  table: string;
  policy_name: string;
  definition: string;
  status: "enabled" | "disabled";
}

export interface MigrationFile {
  version: string;
  description: string;
  sql_file: string;
  status: "ready_to_apply" | "applied" | "failed";
  tested: boolean;
}

export interface QueryOptimization {
  query_name: string;
  optimization: string;
  expected_improvement: string;
}

export interface SqlEditorPhaseJSON extends BasePipelinePhaseJSON {
  phase: "sql_editor";
  input_references: {
    research_timestamp: string;
    plan_timestamp: string;
    coder_timestamp: string;
    context_summary?: string;
  };
  database_schema_created: {
    tables: CreatedTable[];
  };
  rls_policies: RLSPolicy[];
  migrations_created: MigrationFile[];
  queries_optimized: QueryOptimization[];
  type_schema_match: {
    invoice_type_columns: string[];
    database_columns: string[];
    match_status: string;
  };
  seed_data?: {
    provided: boolean;
    records_created: number;
    test_records?: Array<Record<string, unknown>>;
  };
  performance_expectations: {
    read_operations: Record<string, string>;
    write_operations: Record<string, string>;
  };
  critical_notes_for_tester: string[];
}

// ============================================================
// 5. TESTER PHASE OUTPUT
// ============================================================

export interface TestCase {
  test_id: string;
  name: string;
  depends_on_feature?: string;
  context_used?: string[];
  test_steps?: string[];
  test_data?: Record<string, unknown>;
  expected_result?: string;
  actual_result?: string;
  performance_target?: string;
  actual_time?: string;
  status: "passed" | "failed" | "skipped" | "pending";
  notes?: string;
}

export interface IntegrationTest {
  test_name: string;
  steps: string[];
  status: "passed" | "failed" | "skipped";
  total_time_ms?: number;
}

export interface SecurityCheck {
  check: string;
  result: "passed" | "failed" | "warning";
  evidence?: string;
}

export interface QualityGate {
  gate: string;
  result: "passed" | "failed";
  evidence?: string;
  errors?: number;
  implemented?: number;
  planned?: number;
  metrics?: string;
}

export interface TesterPhaseJSON extends BasePipelinePhaseJSON {
  phase: "tester";
  input_references: {
    research_timestamp: string;
    plan_timestamp: string;
    coder_timestamp: string;
    sql_timestamp: string;
  };
  context_received: {
    research: string;
    plan: string;
    code: string;
    sql: string;
  };
  test_suite: TestCase[];
  integration_tests: IntegrationTest[];
  security_checks: SecurityCheck[];
  quality_gates: QualityGate[];
  final_recommendation: "READY_FOR_DEPLOYMENT" | "NEEDS_FIXES" | "BLOCKED";
  blockers: string[];
  warnings: string[];
  notes: string;
}

// ============================================================
// UNIFIED PIPELINE CONTEXT
// ============================================================

export interface PipelineContext {
  research?: ResearchPhaseJSON;
  planner?: PlannerPhaseJSON;
  coder?: CoderPhaseJSON;
  sql_editor?: SqlEditorPhaseJSON;
  tester?: TesterPhaseJSON;
}

export type AnyPipelinePhaseJSON = 
  | ResearchPhaseJSON 
  | PlannerPhaseJSON 
  | CoderPhaseJSON 
  | SqlEditorPhaseJSON 
  | TesterPhaseJSON;

