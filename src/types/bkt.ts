import type { CompetencyId } from './competency';

export interface BktParams {
  competency_id: CompetencyId;
  P_L0: number;
  P_T: number;
  P_S: number;
  P_G: number;
}

export interface BktState {
  competency_id: CompetencyId;
  P_L: number;
  updated_at: string;
}

export interface Attempt {
  id: string;
  task_type: number;
  competency_id: CompetencyId;
  correct: boolean;
  hint_used: boolean;
  timestamp: string;
}

export interface CompetencyCredit {
  competency_id: CompetencyId;
  coverage: 'P' | 'S' | 'O';
  weight: number;
}
