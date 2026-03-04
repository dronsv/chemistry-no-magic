import { describe, it, expect } from 'vitest';
import { parseOntRef, toOntRefStr, richTextToPlainString } from '../ontology-ref';
import type { RichText } from '../../types/ontology-ref';
import { localizeUrl } from '../i18n';

describe('parseOntRef', () => {
  it('parses substance ref', () => {
    expect(parseOntRef('sub:naoh')).toEqual({ kind: 'substance', id: 'naoh' });
  });
  it('parses element ref', () => {
    expect(parseOntRef('el:Na')).toEqual({ kind: 'element', id: 'Na' });
  });
  it('parses ion ref', () => {
    expect(parseOntRef('ion:Na_plus')).toEqual({ kind: 'ion', id: 'Na_plus' });
  });
  it('parses concept refs', () => {
    expect(parseOntRef('cls:base')).toEqual({ kind: 'substance_class', id: 'base' });
    expect(parseOntRef('grp:alkali_metals')).toEqual({ kind: 'element_group', id: 'alkali_metals' });
    expect(parseOntRef('rxtype:neutralization')).toEqual({ kind: 'reaction_type', id: 'neutralization' });
    expect(parseOntRef('proc:decomposition')).toEqual({ kind: 'process', id: 'decomposition' });
    expect(parseOntRef('prop:electronegativity')).toEqual({ kind: 'property', id: 'electronegativity' });
  });
  it('throws on invalid format', () => {
    expect(() => parseOntRef('invalid')).toThrow();
    expect(() => parseOntRef('xxx:foo')).toThrow();
  });
});

describe('toOntRefStr', () => {
  it('serializes substance ref', () => {
    expect(toOntRefStr({ kind: 'substance', id: 'naoh' })).toBe('sub:naoh');
  });
  it('serializes element ref', () => {
    expect(toOntRefStr({ kind: 'element', id: 'Na' })).toBe('el:Na');
  });
  it('serializes concept refs', () => {
    expect(toOntRefStr({ kind: 'substance_class', id: 'base' })).toBe('cls:base');
    expect(toOntRefStr({ kind: 'element_group', id: 'alkali_metals' })).toBe('grp:alkali_metals');
  });
});

describe('richTextToPlainString', () => {
  it('converts text segments', () => {
    const rich: RichText = [{ t: 'text', v: 'Hello ' }, { t: 'text', v: 'world' }];
    expect(richTextToPlainString(rich)).toBe('Hello world');
  });
  it('uses surface for refs', () => {
    const rich: RichText = [
      { t: 'text', v: 'Реакция ' },
      { t: 'ref', id: 'grp:alkali_metals', form: 'gen_pl', surface: 'щелочных металлов' },
      { t: 'text', v: ' с водой' },
    ];
    expect(richTextToPlainString(rich)).toBe('Реакция щелочных металлов с водой');
  });
  it('falls back to id when no surface', () => {
    const rich: RichText = [{ t: 'ref', id: 'cls:base' }];
    expect(richTextToPlainString(rich)).toBe('cls:base');
  });
  it('handles formula segments', () => {
    const rich: RichText = [{ t: 'formula', kind: 'substance', id: 'naoh', formula: 'NaOH' }];
    expect(richTextToPlainString(rich)).toBe('NaOH');
  });
  it('handles nested em/strong', () => {
    const rich: RichText = [{ t: 'em', children: [{ t: 'text', v: 'важно' }] }];
    expect(richTextToPlainString(rich)).toBe('важно');
  });
});

describe('element URL building (via localizeUrl)', () => {
  it('builds Russian element URL (no prefix)', () => {
    expect(localizeUrl('/periodic-table/Na/', 'ru')).toBe('/periodic-table/Na/');
  });
  it('builds English element URL', () => {
    expect(localizeUrl('/periodic-table/Na/', 'en')).toBe('/en/periodic-table/Na/');
  });
  it('builds Polish element URL', () => {
    expect(localizeUrl('/periodic-table/Fe/', 'pl')).toBe('/pl/tablica-okresowa/Fe/');
  });
  it('builds Spanish element URL', () => {
    expect(localizeUrl('/periodic-table/Fe/', 'es')).toBe('/es/tabla-periodica/Fe/');
  });
});
