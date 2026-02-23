import { loadBktState } from '../../lib/storage';
import CompetencyBar from './CompetencyBar';
import './profile.css';

interface Props {
  id: string;
  name: string;
}

export default function CompetencyMasteryIsland({ id, name }: Props) {
  const state = loadBktState();
  const pL = state.get(id) ?? 0.25;
  return <CompetencyBar name={name} pL={pL} />;
}
