import { useState } from 'react';
import * as m from '../../../paraglide/messages.js';
import { getOrbitalBoxes, getElectronConfig } from '../../../lib/electron-config';
import type { OrbitalBox, Spin, SubshellType } from '../../../types/electron-config';
import type { Exercise } from '../../competency/exercise-adapters';

const SUBSHELL_ORBITALS: Record<SubshellType, number> = { s: 1, p: 3, d: 5, f: 7 };

interface Props {
  exercise: Exercise;
  onAnswer: (correct: boolean) => void;
}

type SlotState = 'empty' | 'up' | 'down';

interface UserOrbital {
  n: number;
  l: SubshellType;
  index: number;
  slots: [SlotState, SlotState];
}

function buildEmptyOrbitals(Z: number): UserOrbital[] {
  const config = getElectronConfig(Z);
  const orbitals: UserOrbital[] = [];
  for (const entry of config) {
    const count = SUBSHELL_ORBITALS[entry.l];
    for (let i = 0; i < count; i++) {
      orbitals.push({ n: entry.n, l: entry.l, index: i, slots: ['empty', 'empty'] });
    }
  }
  return orbitals;
}

function cycleSlot(s: SlotState): SlotState {
  if (s === 'empty') return 'up';
  if (s === 'up') return 'down';
  return 'empty';
}

function checkAnswer(user: UserOrbital[], Z: number): boolean {
  const correct = getOrbitalBoxes(Z);
  if (user.length !== correct.length) return false;
  for (let i = 0; i < user.length; i++) {
    const u = user[i];
    const c = correct[i];
    if (u.slots[0] !== c.spins[0] || u.slots[1] !== c.spins[1]) return false;
  }
  return true;
}

const ARROW: Record<SlotState, string> = { empty: '', up: '↑', down: '↓' };

export default function OrbitalFillingExercise({ exercise, onAnswer }: Props) {
  const Z = exercise.targetZ!;
  const [orbitals, setOrbitals] = useState<UserOrbital[]>(() => buildEmptyOrbitals(Z));
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);

  function handleSlotClick(orbIdx: number, slotIdx: 0 | 1) {
    if (submitted) return;
    setOrbitals(prev => {
      const next = prev.map(o => ({ ...o, slots: [...o.slots] as [SlotState, SlotState] }));
      next[orbIdx].slots[slotIdx] = cycleSlot(next[orbIdx].slots[slotIdx]);
      return next;
    });
  }

  function handleSubmit() {
    const isCorrect = checkAnswer(orbitals, Z);
    setCorrect(isCorrect);
    setSubmitted(true);
  }

  // Group orbitals by subshell for display
  const groups: { key: string; orbitals: { orbIdx: number; orbital: UserOrbital }[] }[] = [];
  let currentKey = '';
  for (let i = 0; i < orbitals.length; i++) {
    const o = orbitals[i];
    const key = `${o.n}${o.l}`;
    if (key !== currentKey) {
      groups.push({ key, orbitals: [] });
      currentKey = key;
    }
    groups[groups.length - 1].orbitals.push({ orbIdx: i, orbital: o });
  }

  return (
    <div className="practice-orbital">
      <p className="practice-orbital__question">{exercise.question}</p>
      <p className="practice-orbital__hint">
        {m.practice_orbital_hint()}
      </p>
      <div className="practice-orbital__grid">
        {groups.map(group => (
          <div key={group.key} className="practice-orbital__group">
            <div className="practice-orbital__boxes">
              {group.orbitals.map(({ orbIdx, orbital }) => (
                <div key={orbIdx} className="practice-orbital__box">
                  <button
                    type="button"
                    className="practice-orbital__slot"
                    onClick={() => handleSlotClick(orbIdx, 0)}
                    disabled={submitted}
                  >
                    {ARROW[orbital.slots[0]]}
                  </button>
                  <button
                    type="button"
                    className="practice-orbital__slot"
                    onClick={() => handleSlotClick(orbIdx, 1)}
                    disabled={submitted}
                  >
                    {ARROW[orbital.slots[1]]}
                  </button>
                </div>
              ))}
            </div>
            <span className="practice-orbital__label">{group.key}</span>
          </div>
        ))}
      </div>

      {!submitted && (
        <button type="button" className="btn btn-primary" onClick={handleSubmit}>
          {m.oge_check()}
        </button>
      )}

      {submitted && (
        <>
          <div className={`practice-feedback practice-feedback--${correct ? 'correct' : 'wrong'}`}>
            <span className="practice-feedback__label">
              {correct ? m.correct() : m.wrong()}
            </span>
            {exercise.explanation}
          </div>
          <button
            type="button"
            className="btn btn-primary practice-next"
            onClick={() => onAnswer(correct)}
          >
            {m.practice_next_task()}
          </button>
        </>
      )}
    </div>
  );
}
