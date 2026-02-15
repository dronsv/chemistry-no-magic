export type CompetencyId =
  | 'periodic_table'
  | 'electron_config'
  | 'periodic_trends'
  | 'oxidation_states'
  | 'bond_type'
  | 'crystal_structure_type'
  | 'classification'
  | 'naming'
  | 'amphoterism_logic'
  | 'reactions_exchange'
  | 'gas_precipitate_logic'
  | 'reactions_redox'
  | 'genetic_chain_logic'
  | 'qualitative_analysis_logic'
  | 'reaction_energy_profile'
  | 'catalyst_role_understanding'
  | 'calculations_basic'
  | 'calculations_solutions'
  | 'reaction_yield_logic'
  | 'electrolyte_logic';

export type CompetencyBlock = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export interface CompetencyNode {
  id: CompetencyId;
  name_ru: string;
  description_ru: string;
  block: CompetencyBlock;
  block_name_ru: string;
  prerequisites: CompetencyId[];
  oge_task_types: number[];
  link: string | null;
}
