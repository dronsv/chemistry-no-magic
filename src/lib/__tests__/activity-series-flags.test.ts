import { describe, it, expect } from 'vitest';
import activitySeriesData from '../../../data-src/rules/activity_series.json';
import type { ActivitySeriesEntry } from '../../types/rules';

const series = activitySeriesData as unknown as ActivitySeriesEntry[];

describe('activity_series.json — machine flags', () => {
  it('Li, K, Ba, Ca, Na have reduces_H_from_water: true', () => {
    const waterMetals = ['Li', 'K', 'Ba', 'Ca', 'Na'];
    for (const sym of waterMetals) {
      const entry = series.find(e => e.symbol === sym);
      expect(entry?.reduces_H_from_water, `${sym}.reduces_H_from_water`).toBe(true);
    }
  });

  it('Mg, Al, Zn, Fe, Ni, Sn, Pb have reduces_H_from_water: false', () => {
    const acidOnlyMetals = ['Mg', 'Al', 'Zn', 'Fe', 'Ni', 'Sn', 'Pb'];
    for (const sym of acidOnlyMetals) {
      const entry = series.find(e => e.symbol === sym);
      expect(entry?.reduces_H_from_water, `${sym}.reduces_H_from_water`).toBe(false);
    }
  });

  it('Mg, Al, Zn, Fe, Ni, Sn, Pb have displacement_below: true', () => {
    const displacers = ['Mg', 'Al', 'Zn', 'Fe', 'Ni', 'Sn', 'Pb'];
    for (const sym of displacers) {
      const entry = series.find(e => e.symbol === sym);
      expect(entry?.displacement_below, `${sym}.displacement_below`).toBe(true);
    }
  });

  it('Li, K, Ba, Ca, Na, Cu, Hg, Ag, Pt, Au have displacement_below: false', () => {
    const nonDisplacers = ['Li', 'K', 'Ba', 'Ca', 'Na', 'Cu', 'Hg', 'Ag', 'Pt', 'Au'];
    for (const sym of nonDisplacers) {
      const entry = series.find(e => e.symbol === sym);
      expect(entry?.displacement_below, `${sym}.displacement_below`).toBe(false);
    }
  });
});
