import { describe, it, expect } from 'vitest';
import { parseDsl } from '../parse-dsl.js';

describe('parseDsl', () => {
  it('parses find with element lookup', () => {
    const { query, error } = parseDsl('find(element.electronegativity(Na))');
    expect(error).toBeUndefined();
    expect(query).not.toBeNull();
    expect(query!.intent).toBe('find');
    expect(query!.target).toEqual({
      kind: 'call',
      predicate: 'element.electronegativity',
      args: [{ kind: 'symbol', ref: { kind: 'element', id: 'Na' } }],
    });
  });

  it('parses find with substance ref', () => {
    const { query } = parseDsl('find(substance.class(sub:h2so4))');
    expect(query!.intent).toBe('find');
    expect(query!.target).toEqual({
      kind: 'call',
      predicate: 'substance.class',
      args: [{ kind: 'symbol', ref: { kind: 'substance', id: 'sub:h2so4' } }],
    });
  });

  it('parses derive with givens', () => {
    const { query } = parseDsl('derive(quantity.mass(sub:nacl), given=[quantity.amount(sub:nacl) = 2 mol])');
    expect(query!.intent).toBe('derive');
    expect(query!.target).toEqual({
      kind: 'call',
      predicate: 'quantity.mass',
      args: [{ kind: 'symbol', ref: { kind: 'substance', id: 'sub:nacl' } }],
    });
    expect(query!.givens).toHaveLength(1);
    const given = query!.givens![0];
    expect(given.kind).toBe('equality');
    expect(given.left).toEqual({
      kind: 'call',
      predicate: 'quantity.amount',
      args: [{ kind: 'symbol', ref: { kind: 'substance', id: 'sub:nacl' } }],
    });
    expect(given.right).toEqual({ kind: 'value', value: 2, unit: 'mol' });
  });

  it('parses check intent', () => {
    const { query } = parseDsl('check(reaction.possible(sub:agno3, sub:nacl))');
    expect(query!.intent).toBe('check');
    expect(query!.target).toEqual({
      kind: 'call',
      predicate: 'reaction.possible',
      args: [
        { kind: 'symbol', ref: { kind: 'substance', id: 'sub:agno3' } },
        { kind: 'symbol', ref: { kind: 'substance', id: 'sub:nacl' } },
      ],
    });
  });

  it('parses derive with numeric value without unit', () => {
    const { query } = parseDsl('derive(quantity.mass(sub:nacl), given=[quantity.amount(sub:nacl) = 2])');
    expect(query!.givens![0].right).toEqual({ kind: 'value', value: 2, unit: undefined });
  });

  it('parses element ref with el: prefix', () => {
    const { query } = parseDsl('find(element.atomic_mass(el:Fe))');
    expect(query!.target).toEqual({
      kind: 'call',
      predicate: 'element.atomic_mass',
      args: [{ kind: 'symbol', ref: { kind: 'element', id: 'Fe' } }],
    });
  });

  it('handles missing closing paren gracefully', () => {
    const { query } = parseDsl('find(element.electronegativity(Na)');
    expect(query).not.toBeNull();
    expect(query!.intent).toBe('find');
  });

  it('returns error for empty input', () => {
    const { query, error } = parseDsl('');
    expect(query).toBeNull();
    expect(error).toBeDefined();
  });

  it('returns error for unknown intent', () => {
    const { query, error } = parseDsl('solve(quantity.mass(NaCl))');
    expect(query).toBeNull();
    expect(error).toContain('Unknown intent');
  });

  it('parses multiple givens', () => {
    const { query } = parseDsl(
      'derive(quantity.yield(sub:nacl), given=[quantity.mass(sub:nacl) = 50 g, quantity.mass(sub:na2co3) = 100 g])',
    );
    expect(query!.givens).toHaveLength(2);
    expect(query!.givens![0].right).toEqual({ kind: 'value', value: 50, unit: 'g' });
    expect(query!.givens![1].right).toEqual({ kind: 'value', value: 100, unit: 'g' });
  });

  it('handles predicate without args', () => {
    const { query } = parseDsl('find(reaction.type())');
    expect(query!.target).toEqual({
      kind: 'call',
      predicate: 'reaction.type',
      args: [],
    });
  });
});
