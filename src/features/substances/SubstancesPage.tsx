import { useState, useEffect } from 'react';
import type { SupportedLocale } from '../../types/i18n';
import type { FormulaLookup } from '../../types/formula-lookup';
import { loadFormulaLookup } from '../../lib/data-loader';
import { FormulaLookupProvider } from '../../components/ChemText';
import SubstanceCatalog from './SubstanceCatalog';
import ClassificationTheoryPanel from './ClassificationTheoryPanel';
import PracticeSection from './practice/PracticeSection';
import './substances.css';

export default function SubstancesPage({ locale = 'ru' as SupportedLocale }: { locale?: SupportedLocale }) {
  const [filter, setFilter] = useState('all');
  const [formulaLookup, setFormulaLookup] = useState<FormulaLookup | null>(null);

  useEffect(() => {
    loadFormulaLookup().then(setFormulaLookup).catch(() => {});
  }, []);

  return (
    <FormulaLookupProvider value={formulaLookup}>
      <div className="substances-page">
        <SubstanceCatalog locale={locale} filter={filter} onFilterChange={setFilter} />
        <ClassificationTheoryPanel activeFilter={filter} locale={locale} />
        <PracticeSection locale={locale} />
      </div>
    </FormulaLookupProvider>
  );
}
