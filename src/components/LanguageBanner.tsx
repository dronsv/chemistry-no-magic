import { useState, useEffect } from 'react';
import type { SupportedLocale } from '../types/i18n';
import { detectLocale, saveLocale, getSavedLocale } from '../lib/locale-detect';
import { localizeUrl } from '../lib/i18n';
import * as m from '../paraglide/messages.js';

interface Props {
  currentLocale: SupportedLocale;
}

const DISMISS_KEY = 'lang_banner_dismissed';

const LANG_NAME_KEYS: Record<SupportedLocale, (opts?: { locale?: SupportedLocale }) => string> = {
  ru: (opts) => m.lang_ru({}, opts),
  en: (opts) => m.lang_en({}, opts),
  pl: (opts) => m.lang_pl({}, opts),
  es: (opts) => m.lang_es({}, opts),
};

export default function LanguageBanner({ currentLocale }: Props) {
  const [suggestedLocale, setSuggestedLocale] = useState<SupportedLocale | null>(null);

  useEffect(() => {
    if (getSavedLocale()) return;

    try {
      const dismissed = sessionStorage.getItem(DISMISS_KEY);
      if (dismissed) return;
    } catch { /* ignore */ }

    const detected = detectLocale();
    if (detected !== currentLocale) {
      setSuggestedLocale(detected);
    }
  }, [currentLocale]);

  if (!suggestedLocale) return null;

  const localeOpts = { locale: suggestedLocale };
  const langName = LANG_NAME_KEYS[suggestedLocale]?.(localeOpts) ?? suggestedLocale;
  const switchUrl = localizeUrl('/', suggestedLocale);

  function handleSwitch(): void {
    saveLocale(suggestedLocale!);
    window.location.href = switchUrl;
  }

  function handleDismiss(): void {
    saveLocale(currentLocale);
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setSuggestedLocale(null);
  }

  const message = m.language_banner_suggest({ language: langName }, localeOpts);

  return (
    <div className="lang-banner" role="alert">
      <span className="lang-banner-text">{message}</span>
      <div className="lang-banner-actions">
        <button className="lang-banner-switch" onClick={handleSwitch}>
          {m.language_banner_switch({}, localeOpts)}
        </button>
        <button className="lang-banner-dismiss" onClick={handleDismiss}>
          {m.language_banner_dismiss({}, localeOpts)}
        </button>
      </div>
    </div>
  );
}
