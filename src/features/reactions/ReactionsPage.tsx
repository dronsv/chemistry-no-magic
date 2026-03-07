import { useState, useEffect } from 'react';
import type { FacetState } from '../../types/reaction';
import type { SupportedLocale } from '../../types/i18n';
import type { FormulaLookup } from '../../types/formula-lookup';
import { loadFormulaLookup } from '../../lib/data-loader';
import { FormulaLookupProvider } from '../../components/ChemText';
import { createEmptyFacetState } from './facet-filter';
import ReactionFacets from './ReactionFacets';
import ReactionCards from './ReactionCards';
import ReactionTheoryPanel from './ReactionTheoryPanel';
import KineticsRulesPanel from '../../components/KineticsRulesPanel';
import PracticeSection from './practice/PracticeSection';
import './reactions.css';

export default function ReactionsPage({ locale = 'ru' as SupportedLocale }: { locale?: SupportedLocale }) {
  const [facets, setFacets] = useState<FacetState>(createEmptyFacetState);
  const [formulaLookup, setFormulaLookup] = useState<FormulaLookup | null>(null);

  useEffect(() => {
    loadFormulaLookup().then(setFormulaLookup).catch(() => {});
  }, []);

  return (
    <FormulaLookupProvider value={formulaLookup}>
      <div className="reactions-page">
        <ReactionCards locale={locale} facets={facets} onFacetsChange={setFacets} />
        <ReactionTheoryPanel facets={facets} locale={locale} />
        <KineticsRulesPanel locale={locale} />
        <PracticeSection locale={locale} />
      </div>
    </FormulaLookupProvider>
  );
}
