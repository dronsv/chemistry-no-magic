import { useState, useEffect } from 'react';
import type { BondTheory, BondTypeInfo, CrystalStructureInfo } from '../../types/bond';
import type { MatterRef, ContextsData } from '../../types/matter';
import type { SupportedLocale } from '../../types/i18n';
import { loadBondTheory, loadContextsData } from '../../lib/data-loader';
import CollapsibleSection, { useTheoryPanelState } from '../../components/CollapsibleSection';
import FormulaChip from '../../components/FormulaChip';
import * as m from '../../paraglide/messages.js';

function resolveMatterRef(
  ref: MatterRef,
  ctxData: ContextsData,
): { formula: string; name?: string } {
  if (ref.kind === 'substance') {
    return { formula: ref.id.replace('sub:', '') };
  }
  if (ref.kind === 'substance_variant') {
    const variant = ctxData.variants.find(v => v.id === ref.id);
    const termIds = ctxData.reverse_index[ref.id] ?? [];
    const term = ctxData.terms.find(t => termIds.includes(t.id));
    return { formula: variant?.formula ?? '?', name: term?.name_ru };
  }
  if (ref.kind === 'context') {
    const ctx = ctxData.contexts.find(c => c.id === ref.id);
    const substance = (ctx?.spec as Record<string, unknown> & { ref?: { id?: string } })?.ref?.id?.replace('sub:', '') ?? '?';
    const termIds = ctxData.reverse_index[ref.id] ?? [];
    const term = ctxData.terms.find(t => termIds.includes(t.id));
    return { formula: substance, name: term?.name_ru };
  }
  return { formula: '?' };
}

function MatterRefChip({
  ref,
  ctxData,
}: {
  ref: MatterRef;
  ctxData: ContextsData;
}) {
  const { formula, name } = resolveMatterRef(ref, ctxData);
  return (
    <span>
      <FormulaChip formula={formula} />
      {name && <span className="bond-theory__term-name"> ({name})</span>}
    </span>
  );
}

function BondTypeCard({ info }: { info: BondTypeInfo }) {
  return (
    <div className="bond-theory__rule">
      <div className="bond-theory__rule-header">{info.name_ru}</div>
      <p className="bond-theory__rule-text">
        <strong>{m.theory_rule_label()}</strong> {info.rule_ru}
      </p>
      <p className="bond-theory__rule-text">{info.description_ru}</p>
      <p className="bond-theory__rule-text">
        <strong>{m.theory_properties_label()}</strong> {info.properties_ru}
      </p>
      <div className="bond-theory__rule-examples">
        {m.theory_examples_label()}{' '}
        {info.examples.map((f, i) => (
          <span key={f}>
            {i > 0 && ', '}
            <FormulaChip formula={f} />
          </span>
        ))}
      </div>
    </div>
  );
}

function CrystalComparisonTable({
  structures,
  ctxData,
}: {
  structures: CrystalStructureInfo[];
  ctxData: ContextsData | null;
}) {
  return (
    <div className="crystal-table-wrapper">
      <table className="crystal-table">
        <thead>
          <tr>
            <th>{m.theory_table_type()}</th>
            <th>{m.theory_table_nodes()}</th>
            <th>{m.theory_table_melting()}</th>
            <th>{m.theory_table_hardness()}</th>
            <th>{m.theory_table_conductivity()}</th>
            <th>{m.theory_table_solubility()}</th>
            <th>{m.theory_examples_label()}</th>
          </tr>
        </thead>
        <tbody>
          {structures.map(s => (
            <tr key={s.id}>
              <td className="crystal-table__type">{s.name_ru}</td>
              <td>{s.description_ru}</td>
              <td>{s.properties.melting_point_ru}</td>
              <td>{s.properties.hardness_ru}</td>
              <td>{s.properties.conductivity_ru}</td>
              <td>{s.properties.solubility_ru}</td>
              <td>
                {ctxData
                  ? s.examples.map((ref, i) => (
                      <span key={ref.id}>
                        {i > 0 && ', '}
                        <MatterRefChip ref={ref} ctxData={ctxData} />
                      </span>
                    ))
                  : s.examples.map((ref, i) => (
                      <span key={ref.id}>
                        {i > 0 && ', '}
                        <FormulaChip formula={ref.kind === 'substance' ? ref.id.replace('sub:', '') : '?'} />
                      </span>
                    ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function BondTheoryPanel({ locale = 'ru' as SupportedLocale }: { locale?: SupportedLocale }) {
  const [theory, setTheory] = useState<BondTheory | null>(null);
  const [ctxData, setCtxData] = useState<ContextsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, toggleOpen] = useTheoryPanelState('bonds');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || theory) return;
    setLoading(true);
    Promise.all([loadBondTheory(locale), loadContextsData(locale)])
      .then(([bondData, contexts]) => {
        setTheory(bondData);
        setCtxData(contexts);
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : m.error_loading_short());
        setLoading(false);
      });
  }, [open, theory, locale]);

  return (
    <div className="theory-panel">
      <button
        type="button"
        className={`theory-panel__trigger ${open ? 'theory-panel__trigger--active' : ''}`}
        onClick={toggleOpen}
      >
        <span>{m.theory_label()}</span>
        <span className="theory-panel__trigger-arrow">{open ? '\u25BE' : '\u25B8'}</span>
      </button>

      {open && (
        <div className="theory-panel__content">
          {loading && <div className="theory-panel__loading">{m.loading()}</div>}
          {error && <div className="theory-panel__error">{error}</div>}

          {theory && (
            <>
              <h3 className="theory-panel__heading">{m.theory_bond_types_heading()}</h3>
              {theory.bond_types.map(bt => (
                <CollapsibleSection key={bt.id} id={bt.id} pageKey="bonds" title={bt.name_ru}>
                  <BondTypeCard info={bt} />
                </CollapsibleSection>
              ))}

              <h3 className="theory-panel__heading">{m.theory_crystal_comparison_heading()}</h3>
              <CrystalComparisonTable structures={theory.crystal_structures} ctxData={ctxData} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
