// ── Interaction types ──────────────────────────────────────────
export type InteractionType =
  | 'choice_single'
  | 'choice_multi'
  | 'order_dragdrop'
  | 'numeric_input'
  | 'match_pairs'
  | 'interactive_orbital'
  | 'guided_selection';

// ── Object types ───────────────────────────────────────────────
export type ObjectType = 'element' | 'ion' | 'substance' | 'property' | 'reaction';

// ── Reasoning types ────────────────────────────────────────────
export type ReasoningType =
  | 'ordering_by_trend'
  | 'classification'
  | 'constraint_satisfaction'
  | 'property_lookup'
  | 'conservation_laws';

// ── Evaluation modes ───────────────────────────────────────────
export type EvaluationMode = 'exact' | 'tolerance' | 'partial_credit' | 'set_equivalence';

export interface EvaluationSpec {
  mode: EvaluationMode;
  partial_credit?: boolean;
  tolerance?: number;
}

// ── Pipeline step definitions ──────────────────────────────────
export interface PipelineStep {
  id: string;
  params: Record<string, unknown>;
}

export interface Pipeline {
  generator: PipelineStep;
  solvers: PipelineStep[];
  renderers: PipelineStep[];
}

// ── Task template (loaded from JSON) ───────────────────────────
export interface TaskTemplateMeta {
  interaction: InteractionType;
  objects: ObjectType[];
  reasoning: ReasoningType[];
  evaluation: EvaluationSpec;
}

export interface DifficultyModel {
  features: Record<string, string | boolean>;
  target_band: [number, number];
}

export interface TaskTemplate {
  template_id: string;
  meta: TaskTemplateMeta;
  pipeline: Pipeline;
  prompt_template_id: string;
  explanation_template_id: string;
  evidence_rules: string[];
  difficulty_model: DifficultyModel;
  exam_tags?: string[];
  competency_hint?: Record<string, 'P' | 'S'>;
}

// ── Prompt template (loaded from locale JSON) ──────────────────
export interface PromptTemplate {
  question: string;
  slots: Record<string, string | Record<string, string>>;
}

export type PromptTemplateMap = Record<string, PromptTemplate>;

// ── Property definition (from rules/properties.json) ───────────
export interface PropertyFilter {
  min_Z?: number;
  max_Z?: number;
  exclude_groups?: number[];
}

export interface PropertyDef {
  id: string;
  value_field: string;
  object: string;
  unit: string | null;
  trend_hint: { period: string | null; group: string | null } | null;
  filter: PropertyFilter | null;
  i18n: Record<string, Record<string, string>>;
}

// ── Morphology (from translations/ru/morphology.json) ──────────
export interface MorphEntry {
  nom: string;
  gen: string;
  gender?: string;
}

export interface MorphologyData {
  elements: Record<string, MorphEntry>;
  properties: Record<string, MorphEntry>;
  directions: Record<string, { nom: string; gen: string }>;
}

// ── Slot context (filled by generator) ─────────────────────────
export type SlotValues = Record<string, string | number | string[]>;

// ── Solver result ──────────────────────────────────────────────
export interface SolverResult {
  answer: string | number | string[];
  explanation_slots?: Record<string, string>;
}

// ── Generated task (output of the engine) ──────────────────────
export interface GeneratedTask {
  template_id: string;
  interaction: InteractionType;
  question: string;
  correct_answer: string | number | string[];
  distractors: string[];
  explanation: string;
  competency_map: Record<string, 'P' | 'S'>;
  difficulty: number;
  exam_tags: string[];
  slots: SlotValues;
}

// ── Ontology data bundle (passed to generators/solvers) ────────

export interface OntologyCore {
  elements: import('../../types/element').Element[];
  ions: import('../../types/ion').Ion[];
  properties: PropertyDef[];
}

export interface OntologyRules {
  solubilityPairs: Array<{ cation: string; anion: string; solubility: string }>;
  oxidationExamples: import('../../types/oxidation').OxidationExample[];
  bondExamples?: import('../../types/bond').BondExamplesData;
  activitySeries?: import('../../types/rules').ActivitySeriesEntry[];
  classificationRules?: import('../../types/classification').ClassificationRule[];
  namingRules?: import('../../types/classification').NamingRule[];
  qualitativeTests?: import('../../types/qualitative').QualitativeTest[];
  energyCatalyst?: import('../../types/energy-catalyst').EnergyCatalystTheory;
  ionNomenclature?: import('../../types/ion-nomenclature').IonNomenclatureRules;
}

export interface OntologyDataSources {
  substances?: import('../../types/classification').SubstanceIndexEntry[];
  reactions?: import('../../types/reaction').Reaction[];
  geneticChains?: import('../../types/genetic-chain').GeneticChain[];
  calculations?: import('../../types/calculations').CalculationsData;
  reactionParticipants?: import('../../types/reaction-participant').ReactionParticipant[];
}

export interface OntologyI18n {
  morphology: MorphologyData | null;
  promptTemplates: PromptTemplateMap;
}

export interface OntologyData {
  core: OntologyCore;
  rules: OntologyRules;
  data: OntologyDataSources;
  i18n: OntologyI18n;
}

// ── Evaluation result ──────────────────────────────────────────
export interface EvaluationResult {
  correct: boolean;
  score: number;       // 0..1
  feedback?: string;
}
