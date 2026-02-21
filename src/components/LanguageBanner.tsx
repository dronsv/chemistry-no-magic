import { useState, useEffect } from 'react';
import type { SupportedLocale } from '../types/i18n';
import { detectLocale, saveLocale, getSavedLocale } from '../lib/locale-detect';
import { localizeUrl, SITE_NAME } from '../lib/i18n';

interface Props {
  currentLocale: SupportedLocale;
}

const DISMISS_KEY = 'lang_banner_dismissed';

const LANG_NAMES: Record<SupportedLocale, Record<SupportedLocale, string>> = {
  ru: { ru: 'русский', en: 'English', pl: 'polski', es: 'español' },
  en: { ru: 'Russian', en: 'English', pl: 'Polish', es: 'Spanish' },
  pl: { ru: 'rosyjski', en: 'angielski', pl: 'polski', es: 'hiszpański' },
  es: { ru: 'ruso', en: 'inglés', pl: 'polaco', es: 'español' },
};

const SWITCH_LABELS: Record<SupportedLocale, string> = {
  ru: 'Переключить',
  en: 'Switch',
  pl: 'Przełącz',
  es: 'Cambiar',
};

const DISMISS_LABELS: Record<SupportedLocale, string> = {
  ru: 'Нет, спасибо',
  en: 'No thanks',
  pl: 'Nie, dziękuję',
  es: 'No, gracias',
};

export default function LanguageBanner({ currentLocale }: Props) {
  const [suggestedLocale, setSuggestedLocale] = useState<SupportedLocale | null>(null);

  useEffect(() => {
    // Don't show if user already made a choice
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

  const langName = LANG_NAMES[currentLocale]?.[suggestedLocale] ?? suggestedLocale;
  const switchUrl = localizeUrl('/', suggestedLocale);

  const handleSwitch = () => {
    saveLocale(suggestedLocale);
    window.location.href = switchUrl;
  };

  const handleDismiss = () => {
    saveLocale(currentLocale);
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setSuggestedLocale(null);
  };

  // Show message in detected locale so user can read it
  const message = suggestedLocale === 'ru'
    ? `Этот сайт доступен на русском языке.`
    : suggestedLocale === 'en'
    ? `This site is available in English.`
    : suggestedLocale === 'pl'
    ? `Ta strona jest dostępna po polsku.`
    : `Este sitio está disponible en español.`;

  return (
    <div className="lang-banner" role="alert">
      <span className="lang-banner-text">{message}</span>
      <div className="lang-banner-actions">
        <button className="lang-banner-switch" onClick={handleSwitch}>
          {SWITCH_LABELS[suggestedLocale]}
        </button>
        <button className="lang-banner-dismiss" onClick={handleDismiss}>
          {DISMISS_LABELS[suggestedLocale]}
        </button>
      </div>
    </div>
  );
}
