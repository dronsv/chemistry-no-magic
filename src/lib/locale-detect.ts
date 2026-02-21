import type { SupportedLocale } from '../types/i18n';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from './i18n';

const STORAGE_KEY = 'preferred_locale';

/** Save user's locale preference to localStorage. */
export function saveLocale(locale: SupportedLocale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // localStorage unavailable (SSR, private browsing, etc.)
  }
}

/** Get saved locale from localStorage, if any. */
export function getSavedLocale(): SupportedLocale | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_LOCALES.includes(saved as SupportedLocale)) {
      return saved as SupportedLocale;
    }
  } catch {
    // localStorage unavailable
  }
  return null;
}

/**
 * Detect the best locale for the user.
 * Priority: localStorage → navigator.languages → fallback 'en'.
 */
export function detectLocale(): SupportedLocale {
  // 1. Check localStorage
  const saved = getSavedLocale();
  if (saved) return saved;

  // 2. Check browser languages
  try {
    const languages = navigator.languages ?? [navigator.language];
    for (const lang of languages) {
      const code = lang.split('-')[0].toLowerCase();
      if (SUPPORTED_LOCALES.includes(code as SupportedLocale)) {
        return code as SupportedLocale;
      }
    }
  } catch {
    // navigator unavailable (SSR)
  }

  // 3. Fallback to English (not Russian, since non-ru users get en as default)
  return 'en';
}
