import { useState, useEffect, useMemo } from 'react';
import type { SubstanceIndexEntry } from '../../types/classification';
import type { Element } from '../../types/element';
import type { FormulaLookup } from '../../types/formula-lookup';
import type { SupportedLocale } from '../../types/i18n';
import { loadSubstancesIndex, loadElements, loadFormulaLookup } from '../../lib/data-loader';
import { FormulaLookupProvider } from '../../components/ChemText';
import FormulaChip from '../../components/FormulaChip';
import { localizeUrl } from '../../lib/i18n';
import * as m from '../../paraglide/messages.js';
import './simple-substances.css';

type FilterKey = 'all' | 'metal' | 'nonmetal' | 'noble_gas';

const FILTER_BUTTONS: Array<{ key: FilterKey; label: () => string }> = [
  { key: 'all', label: m.simple_subst_filter_all },
  { key: 'metal', label: m.simple_subst_filter_metals },
  { key: 'nonmetal', label: m.simple_subst_filter_nonmetals },
  { key: 'noble_gas', label: m.simple_subst_filter_noble_gases },
];

const TAG_LABELS: Record<string, () => string> = {
  metal: m.simple_subst_filter_metals,
  nonmetal: m.simple_subst_filter_nonmetals,
  noble_gas: m.simple_subst_filter_noble_gases,
};

const PHASE_LABELS: Record<string, () => string> = {
  s: m.simple_subst_phase_solid,
  l: m.simple_subst_phase_liquid,
  g: m.simple_subst_phase_gas,
};

/** Known liquids at standard conditions (formulas with Unicode subscripts). */
const KNOWN_LIQUIDS = new Set(['Br\u2082', 'Hg']);

/** Extract element symbol from substance formula (strip Unicode subscripts). */
function formulaToSymbol(formula: string): string {
  return formula.replace(/[\u2080-\u2089]/g, '');
}

/** Infer phase from tags and known exceptions. */
function inferPhase(s: SubstanceIndexEntry): 's' | 'l' | 'g' {
  if (KNOWN_LIQUIDS.has(s.formula)) return 'l';
  if (s.tags?.includes('noble_gas') || s.tags?.includes('gas')) return 'g';
  // Diatomic nonmetals that are gases: F₂, N₂, O₂, H₂, Cl₂
  const sym = formulaToSymbol(s.formula);
  if (['F', 'N', 'O', 'H', 'Cl'].includes(sym) && s.formula !== sym) return 'g';
  return 's';
}

/** Get the primary tag (metal/nonmetal/noble_gas) from tags array. */
function getPrimaryTag(tags?: string[]): string {
  if (!tags) return 'nonmetal';
  if (tags.includes('noble_gas')) return 'noble_gas';
  if (tags.includes('metal')) return 'metal';
  return 'nonmetal';
}

export default function SimpleSubstancesPage({ locale = 'ru' as SupportedLocale }: { locale?: SupportedLocale }) {
  const [substances, setSubstances] = useState<SubstanceIndexEntry[]>([]);
  const [elementMap, setElementMap] = useState<Map<string, Element>>(new Map());
  const [formulaLookup, setFormulaLookup] = useState<FormulaLookup | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.all([
      loadSubstancesIndex(locale),
      loadElements(locale),
      loadFormulaLookup(),
    ])
      .then(([subs, elems, lookup]) => {
        const simple = subs.filter(s => s.subclass === 'simple_substance');
        setSubstances(simple);
        const map = new Map<string, Element>();
        for (const el of elems) {
          map.set(el.symbol, el);
        }
        setElementMap(map);
        setFormulaLookup(lookup);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = substances;

    if (filter !== 'all') {
      list = list.filter(s => s.tags?.includes(filter));
    }

    const raw = search.trim();
    if (raw) {
      const q = raw.toLowerCase();
      const hasUpper = raw !== q;
      list = list.filter(
        s =>
          (hasUpper ? s.formula.includes(raw) : s.formula.toLowerCase().includes(q)) ||
          (s.name && s.name.toLowerCase().includes(q)),
      );
    }

    // Sort by atomic number (Z)
    list = [...list].sort((a, b) => {
      const symA = formulaToSymbol(a.formula);
      const symB = formulaToSymbol(b.formula);
      const zA = elementMap.get(symA)?.Z ?? 999;
      const zB = elementMap.get(symB)?.Z ?? 999;
      return zA - zB;
    });

    return list;
  }, [substances, elementMap, filter, search]);

  if (loading) return <div className="simple-subst__loading">{m.loading_catalog()}</div>;

  return (
    <FormulaLookupProvider value={formulaLookup}>
      <div className="simple-subst-page">
        <h2 className="simple-subst__title">{m.simple_subst_title()}</h2>

        <div className="simple-subst__controls">
          <div className="simple-subst__filters">
            {FILTER_BUTTONS.map(btn => (
              <button
                key={btn.key}
                type="button"
                className={`simple-subst__filter-btn ${filter === btn.key ? 'simple-subst__filter-btn--active' : ''}`}
                onClick={() => setFilter(btn.key)}
              >
                {btn.label()}
              </button>
            ))}
          </div>
          <input
            type="search"
            className="simple-subst__search"
            placeholder={m.subst_search_placeholder()}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="simple-subst__count">
          {m.subst_count({ filtered: String(filtered.length), total: String(substances.length) })}
        </div>

        <div className="simple-subst__grid">
          {filtered.map(s => {
            const symbol = formulaToSymbol(s.formula);
            const tag = getPrimaryTag(s.tags);
            const molarMass = s.characteristics?.['concept:molar_mass']?.value;
            const phase = inferPhase(s);

            return (
              <a
                key={s.id}
                href={localizeUrl(`/periodic-table/${symbol}/`, locale)}
                className="simple-subst-card"
              >
                <span className="simple-subst-card__formula">
                  <FormulaChip formula={s.formula} />
                </span>
                {s.name && <span className="simple-subst-card__name">{s.name}</span>}
                <div className="simple-subst-card__meta">
                  <span className={`simple-subst-card__phase simple-subst-card__phase--${phase}`}>
                    {PHASE_LABELS[phase]()}
                  </span>
                  {molarMass != null && (
                    <span className="simple-subst-card__molar-mass">
                      {Number(molarMass).toFixed(1)} g/mol
                    </span>
                  )}
                </div>
                <span className={`simple-subst-card__tag simple-subst-card__tag--${tag}`}>
                  {TAG_LABELS[tag]?.() ?? tag}
                </span>
              </a>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="simple-subst__empty">{m.nothing_found()}</div>
        )}
      </div>
    </FormulaLookupProvider>
  );
}
