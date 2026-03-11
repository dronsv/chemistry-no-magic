import { useState, useEffect } from 'react';
import type { SupportedLocale } from '../../types/i18n';
import { loadSettings, saveSetting, getDefaultExamSystem } from '../../lib/settings';
import { localizeUrl, SUPPORTED_LOCALES } from '../../lib/i18n';
import { saveLocale } from '../../lib/locale-detect';
import * as m from '../../paraglide/messages.js';
import './settings-page.css';

const EXAM_SYSTEMS = [
  { id: 'oge', flag: '🇷🇺', label: 'ОГЭ', locale: 'ru' },
  { id: 'ege', flag: '🇷🇺', label: 'ЕГЭ', locale: 'ru' },
  { id: 'gcse', flag: '🇬🇧', label: 'GCSE', locale: 'en' },
  { id: 'egzamin', flag: '🇵🇱', label: 'Egzamin ósmoklasisty', locale: 'pl' },
  { id: 'ebau', flag: '🇪🇸', label: 'EBAU', locale: 'es' },
];

const LOCALE_LABELS: Record<string, { flag: string; name: string }> = {
  ru: { flag: '🇷🇺', name: 'Русский' },
  en: { flag: '🇬🇧', name: 'English' },
  pl: { flag: '🇵🇱', name: 'Polski' },
  es: { flag: '🇪🇸', name: 'Español' },
};

interface SettingsPageProps {
  locale?: SupportedLocale;
}

export default function SettingsPage({ locale = 'ru' }: SettingsPageProps) {
  const [settings, setSettings] = useState(() => loadSettings());
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const current = loadSettings();
    if (!localStorage.getItem('chemistry_settings')) {
      current.examSystem = getDefaultExamSystem(locale);
      saveSetting('examSystem', current.examSystem);
    }
    setSettings(current);
    setInitialized(true);
  }, [locale]);

  function handleExamChange(systemId: string) {
    saveSetting('examSystem', systemId);
    setSettings(prev => ({ ...prev, examSystem: systemId }));
  }

  function handleSolubilityChange(variant: string) {
    saveSetting('solubilityVariant', variant);
    setSettings(prev => ({ ...prev, solubilityVariant: variant }));
  }

  function handleLocaleChange(newLocale: string) {
    saveLocale(newLocale as SupportedLocale);
    const settingsPath = localizeUrl('/settings/', newLocale as SupportedLocale);
    window.location.href = settingsPath;
  }

  function handleReset() {
    if (!window.confirm(m.settings_reset_confirm())) return;
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch { /* ignore */ }
    window.location.href = '/';
  }

  if (!initialized) return null;

  return (
    <div className="settings-page">
      <h1 className="settings-page__title">{m.settings_title()}</h1>

      <section className="settings-section">
        <h2 className="settings-section__title">{m.settings_exam_section()}</h2>
        <p className="settings-section__desc">{m.settings_exam_description()}</p>
        <div className="settings-options">
          {EXAM_SYSTEMS.map(sys => (
            <button
              key={sys.id}
              type="button"
              className={`settings-option ${settings.examSystem === sys.id ? 'settings-option--active' : ''}`}
              onClick={() => handleExamChange(sys.id)}
            >
              <span className="settings-option__flag">{sys.flag}</span>
              <span className="settings-option__label">{sys.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">{m.settings_language_section()}</h2>
        <div className="settings-options">
          {SUPPORTED_LOCALES.map(loc => {
            const info = LOCALE_LABELS[loc];
            return (
              <button
                key={loc}
                type="button"
                className={`settings-option ${locale === loc ? 'settings-option--active' : ''}`}
                onClick={() => handleLocaleChange(loc)}
              >
                <span className="settings-option__flag">{info.flag}</span>
                <span className="settings-option__label">{info.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">{m.settings_solubility_section()}</h2>
        <p className="settings-section__desc">{m.settings_solubility_description()}</p>
        <div className="settings-options">
          <button
            type="button"
            className={`settings-option ${settings.solubilityVariant === 'compact' ? 'settings-option--active' : ''}`}
            onClick={() => handleSolubilityChange('compact')}
          >
            <span className="settings-option__label">{m.settings_solubility_compact()}</span>
            <span className="settings-option__hint">14 × 8</span>
          </button>
          <button
            type="button"
            className={`settings-option ${settings.solubilityVariant === 'full' ? 'settings-option--active' : ''}`}
            onClick={() => handleSolubilityChange('full')}
          >
            <span className="settings-option__label">{m.settings_solubility_full()}</span>
            <span className="settings-option__hint">23 × 11</span>
          </button>
        </div>
      </section>

      <section className="settings-section settings-section--danger">
        <h2 className="settings-section__title">{m.settings_reset_section()}</h2>
        <p className="settings-section__desc">{m.settings_reset_description()}</p>
        <button
          type="button"
          className="settings-reset-btn"
          onClick={handleReset}
        >
          {m.settings_reset_button()}
        </button>
      </section>
    </div>
  );
}
