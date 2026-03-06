export interface TrendAnomaly {
  property: string; // e.g. "electron_affinity"
  from: string;     // element symbol with anomalously low value
  to: string;       // element symbol with higher value
  reason: string;   // AnomalyReason id
  direction: 'period' | 'group';
  note?: string;
}

export interface AnomalyReason {
  id: string;
  labels: { ru: string; en: string; pl: string; es: string; [locale: string]: string };
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
