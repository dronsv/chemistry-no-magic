import { useState } from 'react';
import type { IonNomenclatureRules } from '../../types/ion-nomenclature';
import * as m from '../../paraglide/messages.js';

interface Props {
  rules: IonNomenclatureRules;
}

export default function IonNomenclatureTheory({ rules }: Props) {
  const [expanded, setExpanded] = useState(false);
  const comp = rules.multilingual_comparison;

  return (
    <section className="ion-theory">
      <h2
        className="ion-theory__title"
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: 'pointer' }}
      >
        {m.ion_theory_title()} {expanded ? '\u25BE' : '\u25B8'}
      </h2>
      {expanded && (
        <div className="ion-theory__content">
          <ul className="ion-theory__rules">
            <li>{m.ion_theory_rule_ide()}</li>
            <li>{m.ion_theory_rule_ate()}</li>
            <li>{m.ion_theory_rule_ite()}</li>
            <li>{m.ion_theory_rule_per()}</li>
            <li>{m.ion_theory_rule_hypo()}</li>
          </ul>

          <div className="ion-theory__mnemonic">
            <strong>{m.ion_theory_mnemonic()}: </strong>
            {rules.mnemonic_ru}
          </div>

          <h3>{m.ion_theory_comparison()}</h3>
          <table className="ion-theory__table">
            <thead>
              <tr>
                <th></th>
                {comp.columns.map(c => <th key={c}>{c.toUpperCase()}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>-ид / -ide</td>
                {comp.binary.map((s, i) => <td key={i}>{s}</td>)}
              </tr>
              <tr>
                <td>-ат / -ate</td>
                {comp.oxy_max.map((s, i) => <td key={i}>{s}</td>)}
              </tr>
              <tr>
                <td>-ит / -ite</td>
                {comp.oxy_lower.map((s, i) => <td key={i}>{s}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
