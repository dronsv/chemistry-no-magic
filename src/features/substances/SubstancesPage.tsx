import SubstanceCatalog from './SubstanceCatalog';
import ClassificationTheoryPanel from './ClassificationTheoryPanel';
import PracticeSection from './practice/PracticeSection';
import './substances.css';

export default function SubstancesPage() {
  return (
    <div className="substances-page">
      <SubstanceCatalog />
      <ClassificationTheoryPanel />
      <PracticeSection />
    </div>
  );
}
