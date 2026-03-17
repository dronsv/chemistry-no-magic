import { useState, useEffect } from 'react';
import type { TypedCharacteristic } from '../types/characteristic';
import type { SubstanceIndexEntry } from '../types/classification';
import type { SupportedLocale } from '../types/i18n';
import { loadCharacteristics, loadSubstancesIndex } from '../lib/data-loader';
import FormulaChip from './FormulaChip';
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
        const [chars, substances] = await Promise.all([
          loadCharacteristics(),
          loadSubstancesIndex(locale as SupportedLocale),
        ]);

        // Build lookup map from substance id → index entry
        const subMap = new Map<string, SubstanceIndexEntry>();
        for (const s of substances) {
          subMap.set(s.id, s);
        }

        // Filter for pKa step 1 only
        const pkaStep1: TypedCharacteristic[] = chars.filter(
          (c) =>
            c.characteristic_concept_id === 'concept:pKa' &&
            (c.conditions?.dissociation_step === 1 || c.conditions?.dissociation_step == null),
        );

        // Build scale items, looking up formula/class from substance index
        const scaleItems: AcidScaleItem[] = [];
        for (const c of pkaStep1) {
          const sub = subMap.get(c.subject_id);
          if (!sub) continue;
          if (typeof c.value !== 'number') continue;
          scaleItems.push({
            subjectId: c.subject_id,
            pka: c.value,
            formula: sub.formula,
            substanceClass: sub.class,
            subclass: sub.subclass,
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
          <div className="acid-scale__group-title">Сильные кислоты (pKa &lt; 0)</div>
          {renderGroup(strong)}
        </div>
      )}
      {strong.length > 0 && weak.length > 0 && (
        <div className="acid-scale__divider">pKa = 0 — граница сильных и слабых кислот</div>
      )}
      {weak.length > 0 && (
        <div className="acid-scale__group">
          <div className="acid-scale__group-title">Слабые кислоты (pKa &gt; 0)</div>
          {renderGroup(weak)}
        </div>
      )}
    </div>
  );
}
