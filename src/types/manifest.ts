export interface ManifestEntrypoints {
  elements: string;
  ions: string;
  rules: Record<string, string>;
  templates: Record<string, string>;
  substances: string;
  indices: Record<string, string>;
  diagnostic?: string;
  element_groups?: string;
  periodic_table_content?: string;
  reactions?: string;
  structures?: string;
  exercises?: Record<string, string>;
  oge_tasks?: string;
  oge_solution_algorithms?: string;
  exam_systems?: string;
  search_index?: string;
}

export interface ManifestStats {
  elements_count: number;
  ions_count: number;
  substances_count: number;
  reaction_templates_count: number;
  task_templates_count: number;
  reactions_count?: number;
}

/**
 * Translation availability per locale.
 * Keys are locale codes (e.g. 'en', 'pl', 'es').
 * Values are arrays of available data keys (e.g. ['elements', 'competencies', 'pages']).
 */
export type ManifestTranslations = Record<string, string[]>;

export interface Manifest {
  bundle_hash: string;
  created_at: string;
  schema_version: string;
  entrypoints: ManifestEntrypoints;
  translations: ManifestTranslations;
  stats: ManifestStats;
}
