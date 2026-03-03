import { useState, useEffect } from 'react';
import type { SupportedLocale } from '../../types/i18n';
import type { FormulaLookup } from '../../types/formula-lookup';
import { loadFormulaLookup } from '../../lib/data-loader';
import { FormulaLookupProvider } from '../../components/ChemText';
import OxidationCalculator from './OxidationCalculator';
import TheoryModulePanel from '../../components/TheoryModulePanel';
import PracticeSection from './practice/PracticeSection';
import './oxidation-states.css';

export default function OxidationStatesPage({ locale = 'ru' as SupportedLocale }: { locale?: SupportedLocale }) {
  const [formulaLookup, setFormulaLookup] = useState<FormulaLookup | null>(null);

  useEffect(() => {
    loadFormulaLookup().then(setFormulaLookup).catch(() => {});
  }, []);

  return (
    <FormulaLookupProvider value={formulaLookup}>
      <div className="oxidation-page">
        <OxidationCalculator locale={locale} />
        <TheoryModulePanel moduleKey="oxidation_states" pageKey="oxidation-states" locale={locale} />
        <PracticeSection locale={locale} />
      </div>
    </FormulaLookupProvider>
  );
}
