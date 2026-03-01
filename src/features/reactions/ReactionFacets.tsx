import { useState, useEffect, useMemo } from 'react';
import type { Reaction, FacetState } from '../../types/reaction';
import type { SubstanceIndexEntry } from '../../types/classification';
import type { CompetencyNode } from '../../types/competency';
import type { SupportedLocale } from '../../types/i18n';
import { loadCompetencies } from '../../lib/data-loader';
import {
  createEmptyFacetState,
  isFacetEmpty,
  countForOption,
  applyPreset,
  type PresetId,
} from './facet-filter';
import * as m from '../../paraglide/messages.js';

const DRIVING_FORCE_OPTIONS = [
  'precipitation', 'gas_evolution', 'water_formation',
  'weak_electrolyte_formation', 'complexation',
] as const;

const DRIVING_FORCE_LABELS: Record<string, () => string> = {
  precipitation: m.rxn_force_precipitation,
  gas_evolution: m.rxn_force_gas_evolution,
  water_formation: m.rxn_force_water_formation,
  weak_electrolyte_formation: m.rxn_force_weak_electrolyte_formation,
  complexation: m.rxn_force_complexation,
};

const SUBSTANCE_CLASS_OPTIONS = ['acid', 'base', 'salt', 'oxide', 'simple'] as const;

const SUBSTANCE_CLASS_LABELS: Record<string, () => string> = {
  acid: m.class_acids,
  base: m.class_bases,
  salt: m.class_salts,
  oxide: m.class_oxides,
  simple: m.class_simples,
};

const PRESETS: { id: PresetId; label: () => string }[] = [
  { id: 'neutralization', label: m.rxn_facet_preset_neutralization },
  { id: 'precipitation_gas', label: m.rxn_facet_preset_precipitate_gas },
  { id: 'redox_only', label: m.rxn_facet_preset_redox },
  { id: 'qualitative', label: m.rxn_facet_preset_qualitative },
];

interface Props {
  facets: FacetState;
  onFacetsChange: (state: FacetState) => void;
  reactions: Reaction[];
  substanceMap: Map<string, SubstanceIndexEntry>;
  locale?: SupportedLocale;
}

export default function ReactionFacets({ facets, onFacetsChange, reactions, substanceMap, locale }: Props) {
  const [collapsed, setCollapsed] = useState(true);
  const [competencyMap, setCompetencyMap] = useState<Map<string, string>>(new Map());

  // Collect competency IDs actually used in reactions
  const usedCompetencyIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of reactions) {
      for (const c of Object.keys(r.competencies)) ids.add(c);
    }
    return [...ids].sort();
  }, [reactions]);

  // Load competency names
  useEffect(() => {
    loadCompetencies(locale).then(comps => {
      const map = new Map<string, string>();
      for (const c of comps) map.set(c.id, c.name_ru);
      setCompetencyMap(map);
    });
  }, [locale]);

  const toggleSet = (current: Set<string>, value: string): Set<string> => {
    const next = new Set(current);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const handlePreset = (id: PresetId) => {
    onFacetsChange(applyPreset(id));
  };

  const handleReset = () => {
    onFacetsChange(createEmptyFacetState());
  };

  const empty = isFacetEmpty(facets);

  return (
    <div className="rxn-facets">
      <button
        type="button"
        className="rxn-facets__toggle"
        onClick={() => setCollapsed(!collapsed)}
      >
        <span>{m.rxn_facet_mechanism()}</span>
        <span className="rxn-facets__toggle-arrow">{collapsed ? '▸' : '▾'}</span>
        {!empty && <span className="rxn-facets__active-dot" />}
      </button>

      {!collapsed && (
        <div className="rxn-facets__body">
          {/* Presets */}
          <div className="rxn-facets__presets">
            {PRESETS.map(p => (
              <button
                key={p.id}
                type="button"
                className="rxn-facets__preset-btn"
                onClick={() => handlePreset(p.id)}
              >
                {p.label()}
              </button>
            ))}
            {!empty && (
              <button
                type="button"
                className="rxn-facets__reset-btn"
                onClick={handleReset}
              >
                {m.rxn_facet_reset()}
              </button>
            )}
          </div>

          {/* Mechanism (radio) */}
          <div className="rxn-facets__group">
            <span className="rxn-facets__label">{m.rxn_facet_mechanism()}</span>
            <div className="rxn-facets__radio-group">
              {(['all', 'exchange', 'substitution', 'decomposition'] as const).map(value => {
                const labelFn: Record<string, () => string> = {
                  all: m.rxn_facet_all,
                  exchange: m.rxn_facet_mechanism_exchange,
                  substitution: m.rxn_facet_mechanism_substitution,
                  decomposition: m.rxn_facet_mechanism_decomposition,
                };
                return (
                  <button
                    key={value}
                    type="button"
                    className={`rxn-facets__radio ${facets.mechanism === value ? 'rxn-facets__radio--active' : ''}`}
                    onClick={() => onFacetsChange({ ...facets, mechanism: value })}
                  >
                    {labelFn[value]()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Redox (radio) */}
          <div className="rxn-facets__group">
            <span className="rxn-facets__label">{m.rxn_facet_redox()}</span>
            <div className="rxn-facets__radio-group">
              {(['all', 'redox', 'non_redox'] as const).map(value => {
                const labelFn: Record<string, () => string> = {
                  all: m.rxn_facet_all,
                  redox: m.rxn_facet_redox_yes,
                  non_redox: m.rxn_facet_redox_no,
                };
                return (
                  <button
                    key={value}
                    type="button"
                    className={`rxn-facets__radio ${facets.redox === value ? 'rxn-facets__radio--active' : ''}`}
                    onClick={() => onFacetsChange({ ...facets, redox: value })}
                  >
                    {labelFn[value]()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Driving Force (checkboxes) */}
          <div className="rxn-facets__group">
            <span className="rxn-facets__label">{m.rxn_facet_driving()}</span>
            <div className="rxn-facets__checkbox-group">
              {DRIVING_FORCE_OPTIONS.map(value => {
                const count = countForOption(reactions, 'drivingForces', value, facets, substanceMap);
                return (
                  <button
                    key={value}
                    type="button"
                    className={`rxn-facets__chip ${facets.drivingForces.has(value) ? 'rxn-facets__chip--active' : ''}`}
                    onClick={() => onFacetsChange({
                      ...facets,
                      drivingForces: toggleSet(facets.drivingForces, value),
                    })}
                  >
                    {DRIVING_FORCE_LABELS[value]?.() ?? value}
                    <span className="rxn-facets__badge">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Substance Class (checkboxes) */}
          <div className="rxn-facets__group">
            <span className="rxn-facets__label">{m.rxn_facet_substance()}</span>
            <div className="rxn-facets__checkbox-group">
              {SUBSTANCE_CLASS_OPTIONS.map(value => {
                const count = countForOption(reactions, 'substanceClasses', value, facets, substanceMap);
                return (
                  <button
                    key={value}
                    type="button"
                    className={`rxn-facets__chip ${facets.substanceClasses.has(value) ? 'rxn-facets__chip--active' : ''}`}
                    onClick={() => onFacetsChange({
                      ...facets,
                      substanceClasses: toggleSet(facets.substanceClasses, value),
                    })}
                  >
                    {SUBSTANCE_CLASS_LABELS[value]?.() ?? value}
                    <span className="rxn-facets__badge">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Educational Goal (checkboxes) */}
          <div className="rxn-facets__group">
            <span className="rxn-facets__label">{m.rxn_facet_goal()}</span>
            <div className="rxn-facets__checkbox-group">
              {usedCompetencyIds.map(id => {
                const count = countForOption(reactions, 'educationalGoals', id, facets, substanceMap);
                return (
                  <button
                    key={id}
                    type="button"
                    className={`rxn-facets__chip ${facets.educationalGoals.has(id) ? 'rxn-facets__chip--active' : ''}`}
                    onClick={() => onFacetsChange({
                      ...facets,
                      educationalGoals: toggleSet(facets.educationalGoals, id),
                    })}
                  >
                    {competencyMap.get(id) ?? id}
                    <span className="rxn-facets__badge">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
