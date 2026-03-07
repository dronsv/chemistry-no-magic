import { cachedReadDataSrc } from './build-data-cache';

export interface EntityPolicy {
  mode: 'all' | 'allowlist';
  full?: string[];
  sitemap?: string[];
}

export interface RoutePolicy {
  elements: EntityPolicy;
  substances: EntityPolicy;
  competencies: EntityPolicy;
}

const DEFAULT_POLICY: RoutePolicy = {
  elements: { mode: 'all' },
  substances: { mode: 'all' },
  competencies: { mode: 'all' },
};

let cached: RoutePolicy | null = null;

export async function loadRoutePolicy(): Promise<RoutePolicy> {
  if (cached) return cached;
  try {
    cached = await cachedReadDataSrc<RoutePolicy>('route_policy.json');
  } catch {
    cached = DEFAULT_POLICY;
  }
  return cached;
}

export function isRouteAllowed(policy: EntityPolicy, id: string): boolean {
  if (policy.mode === 'all') return true;
  return policy.full?.includes(id) ?? false;
}

export function isInSitemap(policy: EntityPolicy, id: string): boolean {
  if (policy.mode === 'all') return true;
  return policy.sitemap?.includes(id) ?? policy.full?.includes(id) ?? false;
}
