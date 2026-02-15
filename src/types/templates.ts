import type { CompetencyId } from './competency';

export type CompetencyCoverage = 'P' | 'S' | 'O';

export interface ReactionTemplate {
  id: string;
  type: string;
  pattern: string;
  description_ru: string;
  conditions?: string;
  catalyst?: string;
  examples: Array<{ reactants: string; products: string }>;
}

export interface TaskTemplate {
  id: string;
  type_number: number;
  name_ru: string;
  description_ru: string;
  competencies: Partial<Record<CompetencyId, CompetencyCoverage>>;
  seed_params: Record<string, unknown>;
}
