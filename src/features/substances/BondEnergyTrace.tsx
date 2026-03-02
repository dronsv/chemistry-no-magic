import type { CalcTrace } from '../../types/calculator';
import * as m from '../../paraglide/messages.js';

/** Format bond key "C-H:1" → "C—H", "C-O:2" → "C═O", "N-N:3" → "N≡N". */
function formatBond(key: string): string {
  const [pair, orderStr] = key.split(':');
  const order = Number(orderStr) || 1;
  const sep = order === 3 ? '\u2261' : order === 2 ? '\u2550' : '\u2014';
  return pair.replace('-', sep);
}

export default function BondEnergyTrace({ trace }: { trace: CalcTrace }) {
  const isPartial = trace.quality === 'partial';

  return (
    <div className="bond-energy-trace">
      <table className="bond-energy-trace__table">
        <thead>
          <tr>
            <th>{m.bond_energy_bond()}</th>
            <th>{m.bond_energy_count()}</th>
            <th>{m.bond_energy_energy()}</th>
            <th>{m.bond_energy_subtotal()}</th>
          </tr>
        </thead>
        <tbody>
          {trace.lines.map((line) => (
            <tr key={line.bond}>
              <td className="bond-energy-trace__bond">{formatBond(line.bond)}</td>
              <td>{line.count}</td>
              <td>{line.E}</td>
              <td>{line.subtotal}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bond-energy-trace__total">
            <td colSpan={3}>{m.bond_energy_total()}</td>
            <td>{trace.total}</td>
          </tr>
        </tfoot>
      </table>

      <span className={`bond-energy-trace__badge ${isPartial ? 'bond-energy-trace__badge--partial' : 'bond-energy-trace__badge--estimated'}`}>
        {isPartial ? m.bond_energy_partial() : m.bond_energy_estimated()}
      </span>

      {trace.notes.length > 0 && (
        <p className="bond-energy-trace__note">{trace.notes[0]}</p>
      )}
    </div>
  );
}
