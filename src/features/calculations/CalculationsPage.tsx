import CalculationsTheoryPanel from './CalculationsTheoryPanel';
import PracticeSection from './practice/PracticeSection';
import * as m from '../../paraglide/messages.js';
import './calculations.css';

export default function CalculationsPage() {
  return (
    <div className="calculations-page">
      <h1 className="calculations-page__title">{m.calc_title()}</h1>
      <p className="calculations-page__intro">
        {m.calc_intro()}
      </p>
      <CalculationsTheoryPanel />
      <PracticeSection />
    </div>
  );
}
