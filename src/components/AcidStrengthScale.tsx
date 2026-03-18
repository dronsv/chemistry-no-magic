import { useState, useEffect } from 'react';
import type { SubstanceIndexEntry } from '../types/classification';
import type { SupportedLocale } from '../types/i18n';
import { loadSubstancesIndex } from '../lib/data-loader';
import { getEntityCharValue } from '../lib/characteristics-utils';
import FormulaChip from './FormulaChip';
import * as m from '../paraglide/messages.js';
import './acid-strength-scale.css';

interface AcidScaleItem {
  subjectId: string;
  pka: number;
  formula: string;
  substanceClass: string;
  subclass?: string;
}

interface Props {
  locale: string;
}

/** Format pKa value compactly for display */
function formatPka(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return parseFloat(v.toPrecision(4)).toString();
}

export default function AcidStrengthScale({ locale }: Props) {
  const [items, setItems] = useState<AcidScaleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const substances = await loadSubstancesIndex(locale as SupportedLocale);

        // Filter substances that have pKa characteristic (step 1 or no step)
        const scaleItems: AcidScaleItem[] = [];
        for (const s of substances) {
          if (!s.characteristics) continue;
          const pka = getEntityCharValue(s.characteristics, 'concept:pKa', 1)
            ?? getEntityCharValue(s.characteristics, 'concept:pKa');
          if (typeof pka !== 'number') continue;
          scaleItems.push({
            subjectId: s.id,
            pka,
            formula: s.formula,
            substanceClass: s.class,
            subclass: s.subclass,
          });
        }

        // Sort ascending by pKa (strongest first, most negative)
        scaleItems.sort((a, b) => a.pka - b.pka);

        setItems(scaleItems);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load acid data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [locale]);

  if (loading) return <div className="acid-scale">…</div>;
  if (error) return <div className="acid-scale">{error}</div>;
  if (items.length === 0) return null;

  const strong = items.filter((it) => it.pka < 0);
  const weak = items.filter((it) => it.pka >= 0);

  const renderGroup = (group: AcidScaleItem[]) => (
    <div className="acid-scale__items">
      {group.map((it) => (
        <div key={it.subjectId} className="acid-scale__item">
          <FormulaChip
            formula={it.formula}
            substanceClass={it.substanceClass}
            subclass={it.subclass}
            substanceId={it.subjectId}
            locale={locale as SupportedLocale}
          />
          <span className="acid-scale__pka">pKa {formatPka(it.pka)}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="acid-scale">
      {strong.length > 0 && (
        <div className="acid-scale__group">
          <div className="acid-scale__group-title">{m.acid_scale_strong()}</div>
          {renderGroup(strong)}
        </div>
      )}
      {strong.length > 0 && weak.length > 0 && (
        <div className="acid-scale__divider">{m.acid_scale_boundary()}</div>
      )}
      {weak.length > 0 && (
        <div className="acid-scale__group">
          <div className="acid-scale__group-title">{m.acid_scale_weak()}</div>
          {renderGroup(weak)}
        </div>
      )}
    </div>
  );
}
