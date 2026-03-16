import { useState, useEffect, type ComponentType } from 'react';
import { getCanonicalPath } from '../../lib/i18n';
import { ROUTES } from './route-map';
import type { SupportedLocale } from '../../types/i18n';
import './offline-router.css';

export default function OfflineRouter() {
  const [Component, setComponent] = useState<ComponentType<{ locale?: SupportedLocale }> | null>(null);
  const [locale, setLocale] = useState<SupportedLocale>('ru');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pathname = window.location.pathname;
    const { canonical, locale: detectedLocale } = getCanonicalPath(pathname);
    setLocale(detectedLocale);

    const route = ROUTES.find(r =>
      r.exact ? canonical === r.canonical : canonical.startsWith(r.canonical)
    );

    if (!route) {
      setError(true);
      setLoading(false);
      return;
    }

    route.load()
      .then(mod => {
        setComponent(() => mod.default);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="offline-router-loading">
        <div className="offline-router-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if (error || !Component) {
    return (
      <div className="offline-router-error">
        <h2>Page not available offline</h2>
        <p>This page hasn&apos;t been cached yet. Please connect to the internet.</p>
        <button onClick={() => window.history.back()} style={{ marginTop: '1rem', cursor: 'pointer' }}>
          &larr; Go back
        </button>
      </div>
    );
  }

  return <Component locale={locale} />;
}
