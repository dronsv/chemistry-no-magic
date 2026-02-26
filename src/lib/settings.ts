import type { SupportedLocale } from '../types/i18n';

export interface UserSettings {
  examSystem: string;
  solubilityVariant: string;
}

const STORAGE_KEY = 'chemistry_settings';

const DEFAULTS: UserSettings = {
  examSystem: 'oge',
  solubilityVariant: 'compact',
};

const LOCALE_EXAM_DEFAULTS: Record<string, string> = {
  ru: 'oge',
  en: 'gcse',
  pl: 'egzamin',
  es: 'ebau',
};

export function getDefaultExamSystem(locale: SupportedLocale): string {
  return LOCALE_EXAM_DEFAULTS[locale] ?? 'oge';
}

export function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      examSystem: parsed.examSystem ?? DEFAULTS.examSystem,
      solubilityVariant: parsed.solubilityVariant ?? DEFAULTS.solubilityVariant,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSetting<K extends keyof UserSettings>(key: K, value: UserSettings[K]): void {
  const current = loadSettings();
  current[key] = value;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // localStorage full or unavailable
  }
}
