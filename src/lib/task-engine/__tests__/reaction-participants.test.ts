import { describe, it, expect } from 'vitest';
// @ts-expect-error — .mjs module, no type declarations
import { generateReactionParticipants } from '../../../../scripts/lib/generate-reaction-participants.mjs';
import type { ReactionRole, ReactionParticipant, ReactionRoleId } from '../../../types/reaction-participant';
import reactionRoles from '../../../../data-src/reactions/reaction_roles.json';
import reactions from '../../../../data-src/reactions/reactions.json';

describe('reaction_roles.json', () => {
  it('has 11 role definitions', () => {
    expect(reactionRoles).toHaveLength(11);
  });

  it('each role has id, name_ru, description_ru', () => {
    for (const role of reactionRoles as ReactionRole[]) {
      expect(role.id).toBeTruthy();
      expect(role.name_ru).toBeTruthy();
      expect(role.description_ru).toBeTruthy();
    }
  });

  it('contains all expected role IDs', () => {
    const ids = (reactionRoles as ReactionRole[]).map(r => r.id);
    const expected: ReactionRoleId[] = [
      'reactant', 'product', 'catalyst', 'inhibitor', 'solvent',
      'medium', 'oxidizing_agent', 'reducing_agent', 'precipitate',
      'gas_evolved', 'electrolyte',
    ];
    for (const e of expected) {
      expect(ids).toContain(e);
    }
  });
});

describe('generateReactionParticipants', () => {
  const participants: ReactionParticipant[] = generateReactionParticipants(reactions);

  it('generates participation records', () => {
    expect(participants.length).toBeGreaterThan(0);
  });

  it('every record has reaction, entity, and role', () => {
    for (const p of participants) {
      expect(p.reaction).toBeTruthy();
      expect(p.entity).toBeTruthy();
      expect(p.role).toBeTruthy();
    }
  });

  it('reactants and products have stoichiometry', () => {
    const rpRecords = participants.filter(
      p => p.role === 'reactant' || p.role === 'product'
    );
    expect(rpRecords.length).toBeGreaterThan(0);
    for (const r of rpRecords) {
      expect(r.stoichiometry).toBeGreaterThan(0);
    }
  });

  it('all reactions have at least one reactant and one product', () => {
    const reactionIds = [...new Set(reactions.map((r: { reaction_id: string }) => r.reaction_id))];
    for (const rid of reactionIds) {
      const rxParticipants = participants.filter(p => p.reaction === rid);
      expect(rxParticipants.some(p => p.role === 'reactant')).toBe(true);
      expect(rxParticipants.some(p => p.role === 'product')).toBe(true);
    }
  });

  it('redox reactions have oxidizing and reducing agents', () => {
    const redoxIds = reactions
      .filter((r: { type_tags: string[] }) => r.type_tags.includes('redox'))
      .map((r: { reaction_id: string }) => r.reaction_id);

    for (const rid of redoxIds) {
      const rxParticipants = participants.filter(p => p.reaction === rid);
      expect(rxParticipants.some(p => p.role === 'oxidizing_agent')).toBe(true);
      expect(rxParticipants.some(p => p.role === 'reducing_agent')).toBe(true);
    }
  });

  it('precipitation reactions have precipitate role', () => {
    const precipIds = reactions
      .filter((r: { observations: { precipitate?: string[] } }) =>
        (r.observations.precipitate ?? []).length > 0
      )
      .map((r: { reaction_id: string }) => r.reaction_id);

    expect(precipIds.length).toBeGreaterThan(0);
    for (const rid of precipIds) {
      const rxParticipants = participants.filter(p => p.reaction === rid);
      expect(rxParticipants.some(p => p.role === 'precipitate')).toBe(true);
    }
  });

  it('gas evolution reactions have gas_evolved role (where product formula matches)', () => {
    // Note: some reactions have gas observations describing gas *absorption* (e.g. CO₂ поглощается),
    // where the gas is a reactant not a product. We only check reactions with gas_evolution type tag.
    const gasEvolutionIds = reactions
      .filter((r: { type_tags: string[] }) => r.type_tags.includes('gas_evolution'))
      .map((r: { reaction_id: string }) => r.reaction_id);

    expect(gasEvolutionIds.length).toBeGreaterThan(0);
    for (const rid of gasEvolutionIds) {
      const rxParticipants = participants.filter(p => p.reaction === rid);
      expect(rxParticipants.some(p => p.role === 'gas_evolved')).toBe(true);
    }
  });

  it('does not produce false positive precipitates (NaCl in Fe(OH)3 reaction)', () => {
    // rx_precip_04_feoh3: Fe(OH)3 is the precipitate, not NaCl
    const feoh3 = participants.filter(
      p => p.reaction === 'rx_precip_04_feoh3' && p.role === 'precipitate'
    );
    expect(feoh3).toHaveLength(1);
    expect(feoh3[0].entity).toBe('Fe(OH)3');
  });

  it('correctly identifies BaSO4 as precipitate', () => {
    const baso4 = participants.filter(
      p => p.reaction === 'rx_precip_01_baso4' && p.role === 'precipitate'
    );
    expect(baso4).toHaveLength(1);
    expect(baso4[0].entity).toBe('BaSO4');
  });

  it('correctly identifies H2 as gas_evolved in redox reactions', () => {
    const h2gas = participants.filter(
      p => p.reaction === 'rx_redox_01_zn_hcl' && p.role === 'gas_evolved'
    );
    expect(h2gas).toHaveLength(1);
    expect(h2gas[0].entity).toBe('H2');
  });
});
