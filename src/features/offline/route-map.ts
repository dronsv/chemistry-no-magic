import type { ComponentType } from 'react';
import type { SupportedLocale } from '../../types/i18n';

export interface RouteEntry {
  /** Canonical path prefix (from i18n.ts SLUG_MAP keys) */
  canonical: string;
  /** Whether this is an exact match or prefix match */
  exact: boolean;
  /** Dynamic import of the React page component */
  load: () => Promise<{ default: ComponentType<{ locale?: SupportedLocale }> }>;
}

/**
 * Route table for offline rendering. Order matters — more specific routes first.
 * Each entry maps a canonical path to a lazy-loaded React component.
 */
export const ROUTES: RouteEntry[] = [
  { canonical: '/exam/compare/', exact: true, load: () => import('../../features/exam/ExamComparison') },
  { canonical: '/periodic-table/', exact: true, load: () => import('../../features/periodic-table/PeriodicTablePage') },
  { canonical: '/substances/', exact: true, load: () => import('../../features/substances/SubstancesPage') },
  { canonical: '/bonds/', exact: true, load: () => import('../../features/bonds/BondsPage') },
  { canonical: '/oxidation-states/', exact: true, load: () => import('../../features/oxidation-states/OxidationStatesPage') },
  { canonical: '/reactions/', exact: true, load: () => import('../../features/reactions/ReactionsPage') },
  { canonical: '/ions/', exact: true, load: () => import('../../features/ions/IonsPage') },
  { canonical: '/calculations/', exact: true, load: () => import('../../features/calculations/CalculationsPage') },
  { canonical: '/diagnostics/', exact: true, load: () => import('../../features/diagnostics/DiagnosticsApp') },
  { canonical: '/exam/', exact: true, load: () => import('../../features/exam/ExamPage') },
  { canonical: '/profile/', exact: true, load: () => import('../../features/profile/ProfileApp') },
  { canonical: '/search/', exact: true, load: () => import('../../features/search/SearchPage') },
  { canonical: '/settings/', exact: true, load: () => import('../../features/settings/SettingsPage') },
  { canonical: '/processes/', exact: true, load: () => import('../../features/processes/ProcessesPage') },
  { canonical: '/physical-foundations/', exact: true, load: () => import('../../features/physical-foundations/PhysicalFoundationsPage') },
  { canonical: '/competencies/', exact: true, load: () => import('../../features/competency/CompetencyGraphIsland') },
];
