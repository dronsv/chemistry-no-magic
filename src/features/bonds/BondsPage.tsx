import { useState, useEffect } from 'react';
import type { SupportedLocale } from '../../types/i18n';
import type { FormulaLookup } from '../../types/formula-lookup';
import { loadFormulaLookup } from '../../lib/data-loader';
import { FormulaLookupProvider } from '../../components/ChemText';
import TheoryModulePanel from '../../components/TheoryModulePanel';
import BondCalculator from './BondCalculator';
import PracticeSection from './practice/PracticeSection';
import './bonds.css';

export default function BondsPage({ locale = 'ru' as SupportedLocale }: { locale?: SupportedLocale }) {
  const [formulaLookup, setFormulaLookup] = useState<FormulaLookup | null>(null);

  useEffect(() => {
    loadFormulaLookup().then(setFormulaLookup).catch(() => {});
  }, []);

  return (
    <FormulaLookupProvider value={formulaLookup}>
      <div className="bonds-page">
        <BondCalculator locale={locale} />
        <TheoryModulePanel moduleKey="bonds_and_crystals" pageKey="bonds" locale={locale} />
        <PracticeSection locale={locale} />
      </div>
    </FormulaLookupProvider>
  );
}
