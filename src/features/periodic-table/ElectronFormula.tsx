import {
  getElectronFormula,
  getShorthandFormula,
  isException,
  getExpectedConfig,
  getValenceElectrons,
} from '../../lib/electron-config';
import type { OrbitalFilling } from '../../types/electron-config';
import { useState } from 'react';

interface Props {
  Z: number;
  showShorthand?: boolean;
}

function formatConfig(config: OrbitalFilling[]): string {
  const SUPER: Record<string, string> = {
    '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴',
    '5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹',
  };
  const toSup = (n: number) => String(n).split('').map(c => SUPER[c] ?? c).join('');
  return config.map(e => `${e.n}${e.l}${toSup(e.electrons)}`).join('');
}

export default function ElectronFormula({ Z, showShorthand: initialShorthand = true }: Props) {
  const [shorthand, setShorthand] = useState(initialShorthand);
  const formula = shorthand ? getShorthandFormula(Z) : getElectronFormula(Z);
  const valence = getValenceElectrons(Z);
  const valenceKeys = new Set(valence.map(v => `${v.n}${v.l}`));
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
            Ожидаемая: <s>{formatConfig(getExpectedConfig(Z).slice(
              getExpectedConfig(Z).length - 2
            ))}</s>
          </div>
        </div>
      )}
      <div className="electron-formula__valence">
        Валентные: {valence.map(v => `${v.n}${v.l}`).join(', ')} ({valence.reduce((s, v) => s + v.electrons, 0)} эл.)
      </div>
    </div>
  );
}
