import { useState, useEffect } from 'react';
import type { SupportedLocale } from '../../types/i18n';
import type { FormulaLookup } from '../../types/formula-lookup';
import { loadFormulaLookup } from '../../lib/data-loader';
import { FormulaLookupProvider } from '../../components/ChemText';
import TheoryModulePanel from '../../components/TheoryModulePanel';
import PracticeSection from './practice/PracticeSection';
import * as m from '../../paraglide/messages.js';
import './calculations.css';

export default function CalculationsPage({ locale = 'ru' as SupportedLocale }: { locale?: SupportedLocale }) {
  const [formulaLookup, setFormulaLookup] = useState<FormulaLookup | null>(null);

  useEffect(() => {
    loadFormulaLookup().then(setFormulaLookup).catch(() => {});
  }, []);

  return (
    <FormulaLookupProvider value={formulaLookup}>
      <div className="calculations-page">
        <h1 className="calculations-page__title">{m.calc_title()}</h1>
        <p className="calculations-page__intro">
          {m.calc_intro()}
        </p>
        <TheoryModulePanel moduleKey="calculations" pageKey="calculations" locale={locale} />
        <PracticeSection locale={locale} />
      </div>
    </FormulaLookupProvider>
  );
}
