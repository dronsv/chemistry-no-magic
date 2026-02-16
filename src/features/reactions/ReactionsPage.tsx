import ReactionCards from './ReactionCards';
import ReactionTheoryPanel from './ReactionTheoryPanel';
import PracticeSection from './practice/PracticeSection';
import './reactions.css';

export default function ReactionsPage() {
  return (
    <div className="reactions-page">
      <ReactionCards />
      <ReactionTheoryPanel />
      <PracticeSection />
    </div>
  );
}
