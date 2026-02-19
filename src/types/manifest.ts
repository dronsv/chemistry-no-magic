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

export interface Manifest {
  bundle_hash: string;
  created_at: string;
  schema_version: string;
  entrypoints: ManifestEntrypoints;
  stats: ManifestStats;
}
