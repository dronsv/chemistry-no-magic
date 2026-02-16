import OxidationCalculator from './OxidationCalculator';
import OxidationTheoryPanel from './OxidationTheoryPanel';
import PracticeSection from './practice/PracticeSection';
import './oxidation-states.css';

export default function OxidationStatesPage() {
  return (
    <div className="oxidation-page">
      <OxidationCalculator />
      <OxidationTheoryPanel />
      <PracticeSection />
    </div>
  );
}
