import { describe, it, expect } from 'vitest';

describe('offline-precache module', () => {
  it('exports initPrecache function', async () => {
    const mod = await import('../offline-precache');
    expect(typeof mod.initPrecache).toBe('function');
  });

  it('exports triggerPrecache function', async () => {
    const mod = await import('../offline-precache');
    expect(typeof mod.triggerPrecache).toBe('function');
  });

  it('exports isPrecacheComplete function', async () => {
    const mod = await import('../offline-precache');
    expect(typeof mod.isPrecacheComplete).toBe('function');
  });
});
