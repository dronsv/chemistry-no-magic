export type CompetencyId =
  | 'periodic_table'
  | 'electron_config'
  | 'oxidation_states'
  | 'classification'
  | 'naming'
  | 'reactions_exchange'
  | 'gas_precipitate_logic'
  | 'reactions_redox'
  | 'reaction_energy_profile'
  | 'catalyst_role_understanding'
  | 'calculations_basic'
  | 'calculations_solutions';

export interface CompetencyNode {
  id: CompetencyId;
  name_ru: string;
  block: 'A' | 'B' | 'C' | 'D' | 'E';
  prerequisites: CompetencyId[];
}
