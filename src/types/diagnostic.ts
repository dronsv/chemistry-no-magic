import type { CompetencyId } from './competency';

export interface DiagnosticOption {
  id: string;
  text: string;
}

export interface DiagnosticQuestion {
  id: string;
  competency_id: CompetencyId;
  task_type: number;
  question_ru: string;
  options: DiagnosticOption[];
  correct_option: string;
  explanation_ru: string;
}
