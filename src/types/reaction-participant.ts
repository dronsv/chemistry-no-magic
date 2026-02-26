/** One of 11 possible roles a substance can play in a reaction. */
export type ReactionRoleId =
  | 'reactant'
  | 'product'
  | 'catalyst'
  | 'inhibitor'
  | 'solvent'
  | 'medium'
  | 'oxidizing_agent'
  | 'reducing_agent'
  | 'precipitate'
  | 'gas_evolved'
  | 'electrolyte';

/** A role definition from reaction_roles.json. */
export interface ReactionRole {
  id: ReactionRoleId;
  name_ru: string;
  description_ru: string;
}

/** An n-ary participation record linking reaction, entity, and role. */
export interface ReactionParticipant {
  reaction: string;
  entity: string;
  role: ReactionRoleId;
  stoichiometry?: number;
}
