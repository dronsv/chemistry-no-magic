import {
  getElectronFormula,
  getShorthandFormula,
  isException,
  getExpectedShorthandValence,
  getValenceElectrons,
} from '../../lib/electron-config';
import { useState } from 'react';

interface Props {
  Z: number;
  showShorthand?: boolean;
}

export default function ElectronFormula({ Z, showShorthand: initialShorthand = true }: Props) {
  const [shorthand, setShorthand] = useState(initialShorthand);
  const formula = shorthand ? getShorthandFormula(Z) : getElectronFormula(Z);
  const valence = getValenceElectrons(Z);
  const exception = isException(Z);

  return (
    <div className="electron-formula">
      <div className="electron-formula__label">
        Электронная формула
        <button
          className="electron-formula__toggle"
          onClick={() => setShorthand(!shorthand)}
          type="button"
        >
          {shorthand ? 'Полная' : 'Краткая'}
        </button>
      </div>
      <div className="electron-formula__value">{formula}</div>
      {exception && (
        <div className="electron-formula__exception">
          <span className="electron-formula__badge">Провал электрона</span>
          <div className="electron-formula__expected">
            Ожидаемая: <span className="electron-formula__struck">{getExpectedShorthandValence(Z)}</span>
          </div>
        </div>
      )}
      <div className="electron-formula__valence">
        Валентные: {valence.map(v => `${v.n}${v.l}`).join(', ')} ({valence.reduce((s, v) => s + v.electrons, 0)} эл.)
      </div>
    </div>
  );
}
