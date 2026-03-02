/**
 * Build-time overlay utility for applying locale-specific translation overlays
 * to data loaded directly from data-src/ during static page generation.
 *
 * Reads overlay files from data-src/translations/{locale}/{dataKey}.json.
 * Returns null for 'ru' locale (base data is already Russian) or if file doesn't exist.
 */
import { cachedLoadOverlay } from './build-data-cache';

/**
 * Load a translation overlay file at build time.
 * @param locale - Target locale (e.g. 'en', 'es', 'pl')
 * @param dataKey - Overlay filename without extension (e.g. 'elements', 'substances')
 * @returns Overlay dict keyed by item ID, or null if unavailable
 */
export async function loadBuildOverlay(
  locale: string,
  dataKey: string,
): Promise<Record<string, Record<string, unknown>> | null> {
  return cachedLoadOverlay(locale, dataKey);
}

/**
 * Apply an overlay to a single data item (shallow merge).
 * Fields in the overlay replace matching fields in the base item.
 */
export function applyBuildOverlay<T extends Record<string, unknown>>(
  item: T,
  overlay: Record<string, unknown>,
): T {
  return { ...item, ...overlay };
}
