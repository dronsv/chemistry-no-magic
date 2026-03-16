/**
 * Trigger background precache if on WiFi or no connection info available.
 * On mobile data, precaching is skipped (user can trigger from Settings).
 * The SW guards against duplicate runs, so calling this on every page load is safe.
 */
export function initPrecache(locale: string): void {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.ready.then(reg => {
    if (!reg.active) return;

    const conn = (navigator as unknown as { connection?: { type?: string; effectiveType?: string } }).connection;
    // Auto-precache on WiFi, 4g, or when API unavailable (desktop browsers)
    const shouldAuto = !conn || conn.type === 'wifi' || conn.effectiveType === '4g';

    if (shouldAuto) {
      reg.active.postMessage({ type: 'START_PRECACHE', locale });
    }
  });
}

/**
 * Manually trigger precache regardless of connection type.
 * Called from Settings page when user clicks "Download for offline".
 */
export function triggerPrecache(locale: string): void {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.ready.then(reg => {
    if (!reg.active) return;
    reg.active.postMessage({ type: 'START_PRECACHE', locale });
  });
}

/**
 * Check if precache is complete by looking for the completion flag.
 */
export async function isPrecacheComplete(): Promise<boolean> {
  const names = await caches.keys();
  for (const name of names) {
    if (name.startsWith('precache-')) {
      const cache = await caches.open(name);
      const flag = await cache.match('__precache_complete__');
      if (flag) return true;
    }
  }
  return false;
}
