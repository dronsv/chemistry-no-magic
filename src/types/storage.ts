export interface TrendAnomaly {
  id: string;       // namespace exc:
  property: string; // e.g. "electron_affinity"
  from: string;     // element symbol with anomalously low value
  to: string;       // element symbol with higher value
  reason: string;   // AnomalyReason id
  direction: 'period' | 'group';
  overrides_trend: string; // ref to trend:* in trend_rules
  note?: string;
}

export interface AnomalyReason {
  id: string;
  labels: { ru: string; en: string; pl: string; es: string; [locale: string]: string };
  mechanism_ref: string | null; // ref to mechanism ID in mechanisms.json, or null
  subshell?: string;            // e.g. "s", "p"
  fill_state?: string;          // e.g. "full", "half"
  factor?: string;              // e.g. "electron_repulsion"
}

export interface StorageRequirement {
  id: string; // e.g. "env:under_oil", "container:sealed"
  kind: 'environment' | 'temperature' | 'container' | 'avoid_contact' | 'mechanical';
  labels: { ru: string; en: string; pl: string; es: string; [locale: string]: string };
  reason_tags?: string[];
}

export interface StorageProfile {
  id: string; // e.g. "storage:alkali_metal_basic"
  labels: { ru: string; en: string; pl: string; es: string; [locale: string]: string };
  requires: string[]; // StorageRequirement ids
  reason_tags?: string[];
  applies_to?: { element_symbols?: string[]; substance_classes?: string[] };
}
