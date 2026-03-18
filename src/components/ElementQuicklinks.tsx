import { useState, useEffect } from 'react';
import type { SupportedLocale } from '../types/i18n';
import { loadElements } from '../lib/data-loader';
import OntInteractiveRef from './OntInteractiveRef';
import { extractRefId } from '../lib/ont-ref-registry';
import * as m from '../paraglide/messages.js';

interface Props {
  elements: string[];
  locale: string;
}

export default function ElementQuicklinks({ elements, locale }: Props) {
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    loadElements(locale as SupportedLocale)
      .then(els => {
        const map: Record<string, string> = {};
        for (const el of els) {
          if (el.name) map[el.symbol] = el.name;
        }
        setNames(map);
      })
      .catch(() => {});
  }, [locale]);

  return (
    <nav className="pt-quicklinks" aria-label={m.pt_popular_elements?.() ?? 'Popular elements'}>
      <p className="pt-quicklinks__label">{m.pt_popular_elements?.() ?? 'Popular elements'}:</p>
      <div className="pt-quicklinks__links">
        {elements.map(ref => {
          const symbol = extractRefId(ref);
          const name = names[symbol];
          return (
            <OntInteractiveRef
              key={ref}
              entityRef={ref}
              display={
                <span className="pt-quicklinks__item">
                  {name ? `${name} (${symbol})` : symbol}
                </span>
              }
              locale={locale}
            />
          );
        })}
      </div>
    </nav>
  );
}
