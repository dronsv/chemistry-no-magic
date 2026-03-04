import { useMemo } from 'react';
import type { ReactNode } from 'react';
import FormulaChip from './FormulaChip';
import ConceptRef from './ConceptRef';
import { useFormulaLookup } from './ChemText';
import { useConcepts } from './ConceptProvider';
import type { FormulaLookupEntry } from '../types/formula-lookup';
import type { SupportedLocale } from '../types/i18n';

interface SmartTextProps {
  text: string;
  locale?: SupportedLocale;
}

type Match = {
  type: 'formula';
  entry: FormulaLookupEntry;
  matched: string;
} | {
  type: 'concept';
  conceptId: string;
  matched: string;
};

export default function SmartText({ text, locale }: SmartTextProps) {
  const formulaLookup = useFormulaLookup();
  const concepts = useConcepts();

  // Build combined lookup: surface form -> Match
  // Formula matches have priority over concept matches
  const combinedLookup = useMemo(() => {
    const map = new Map<string, Match>();

    // Concepts first (lower priority -- formulas override)
    if (concepts?.lookup) {
      for (const [form, conceptId] of Object.entries(concepts.lookup)) {
        map.set(form.toLowerCase(), { type: 'concept', conceptId, matched: form });
      }
    }

    // Formulas override (higher priority)
    if (formulaLookup) {
      for (const [formula, entry] of Object.entries(formulaLookup)) {
        map.set(formula.toLowerCase(), { type: 'formula', entry, matched: formula });
      }
    }

    return map;
  }, [formulaLookup, concepts?.lookup]);

  // Build regex from all keys, sorted longest first
  const regex = useMemo(() => {
    if (combinedLookup.size === 0) return null;
    const keys = Array.from(combinedLookup.keys());
    keys.sort((a, b) => b.length - a.length);
    const escaped = keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(`(${escaped.join('|')})(?![a-zа-яё])`, 'gi');
  }, [combinedLookup]);

  if (!regex) return <>{text}</>;

  // Parse text into segments
  const result: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset regex
  regex.lastIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    const matchedText = match[0];
    const start = match.index;

    // Lookbehind check: skip if preceded by a letter
    if (start > 0) {
      const prev = text[start - 1];
      if (/[a-zA-Zа-яёА-ЯЁ]/.test(prev)) continue;
    }

    // Add text before match
    if (start > lastIndex) {
      result.push(text.slice(lastIndex, start));
    }

    const info = combinedLookup.get(matchedText.toLowerCase());
    if (info?.type === 'formula') {
      const e = info.entry;
      result.push(
        <FormulaChip
          key={`f-${start}`}
          formula={matchedText}
          substanceId={e.type === 'substance' ? e.id : undefined}
          substanceClass={e.type === 'substance' ? e.cls : e.type === 'element' ? 'simple' : undefined}
          ionId={e.type === 'ion' ? e.id : undefined}
          ionType={e.type === 'ion' ? e.ionType : undefined}
          locale={locale}
        />
      );
    } else if (info?.type === 'concept') {
      result.push(
        <ConceptRef
          key={`c-${start}`}
          id={info.conceptId}
          surface={matchedText}
          locale={locale}
        />
      );
    }

    lastIndex = start + matchedText.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return <>{result}</>;
}
