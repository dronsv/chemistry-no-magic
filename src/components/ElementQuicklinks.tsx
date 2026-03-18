import { useState, useEffect } from 'react';
import type { SupportedLocale } from '../types/i18n';
import { loadElements } from '../lib/data-loader';
import FormulaChip from './FormulaChip';
import { extractRefId } from '../lib/ont-ref-registry';
import * as m from '../paraglide/messages.js';

interface Props {
  /** List of element ontology refs, e.g. ["el:H", "el:O", "el:Na"] */
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
          return (
            <FormulaChip
              key={ref}
              formula={symbol}
              name={names[symbol]}
              elementId={symbol}
              locale={locale as SupportedLocale}
            />
          );
        })}
      </div>
    </nav>
  );
}
