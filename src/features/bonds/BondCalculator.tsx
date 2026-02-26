import { useState, useEffect, useRef, useCallback } from 'react';
import type { Element } from '../../types/element';
import type { BondType, CrystalStructure, FormulaAnalysis, BondAnalysis } from '../../lib/bond-calculator';
import { analyzeFormula, determineBondType, determineCrystalStructure } from '../../lib/bond-calculator';
import type { SupportedLocale } from '../../types/i18n';
import { loadElements } from '../../lib/data-loader';
import BondDiagramIonic from './diagrams/BondDiagramIonic';
import BondDiagramCovalent from './diagrams/BondDiagramCovalent';
import BondDiagramMetallic from './diagrams/BondDiagramMetallic';
import ElectronegativityBar from './diagrams/ElectronegativityBar';
import * as m from '../../paraglide/messages.js';

type InputMode = 'formula' | 'pair';

const BOND_TYPE_LABELS: Record<BondType, () => string> = {
  ionic: m.bond_ionic,
  covalent_polar: m.bond_covalent_polar,
  covalent_nonpolar: m.bond_covalent_nonpolar,
  metallic: m.bond_metallic,
};

const CRYSTAL_LABELS: Record<CrystalStructure, () => string> = {
  ionic: m.crystal_ionic,
  molecular: m.crystal_molecular,
  atomic: m.crystal_atomic,
  metallic: m.crystal_metallic,
};

const CRYSTAL_PROPERTIES: Record<CrystalStructure, { melting: () => string; hardness: () => string; conductivity: () => string; solubility: () => string }> = {
  ionic: { melting: m.crystal_ionic_melting, hardness: m.crystal_ionic_hardness, conductivity: m.crystal_ionic_conductivity, solubility: m.crystal_ionic_solubility },
  molecular: { melting: m.crystal_molecular_melting, hardness: m.crystal_molecular_hardness, conductivity: m.crystal_molecular_conductivity, solubility: m.crystal_molecular_solubility },
  atomic: { melting: m.crystal_atomic_melting, hardness: m.crystal_atomic_hardness, conductivity: m.crystal_atomic_conductivity, solubility: m.crystal_atomic_solubility },
  metallic: { melting: m.crystal_metallic_melting, hardness: m.crystal_metallic_hardness, conductivity: m.crystal_metallic_conductivity, solubility: m.crystal_metallic_solubility },
};

interface AnalysisResult {
  formula: string;
  bond: BondAnalysis;
  crystalStructure: CrystalStructure;
}

export default function BondCalculator({ locale = 'ru' as SupportedLocale }: { locale?: SupportedLocale }) {
  const [elements, setElements] = useState<Element[]>([]);
  const [elementMap, setElementMap] = useState<Map<string, Element>>(new Map());
  const [mode, setMode] = useState<InputMode>('formula');
  const [formulaInput, setFormulaInput] = useState('');
  const [symbolA, setSymbolA] = useState('');
  const [symbolB, setSymbolB] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadElements(locale).then(elems => {
      setElements(elems);
      const map = new Map<string, Element>();
      for (const el of elems) {
        map.set(el.symbol, el);
      }
      setElementMap(map);
    });
  }, [locale]);

  const analyzeByFormula = useCallback(function analyzeByFormula(formula: string) {
    if (!formula.trim() || elementMap.size === 0) {
      setResult(null);
      setError(null);
      return;
    }

    const analysis: FormulaAnalysis = analyzeFormula(formula.trim(), elementMap);

    if (analysis.bonds.length === 0) {
      setError(m.formula_parse_error());
      setResult(null);
      return;
    }

    setError(null);
    setResult({
      formula: analysis.formula,
      bond: analysis.bonds[0],
      crystalStructure: analysis.crystalStructure,
    });
  }, [elementMap]);

  function handleFormulaChange(value: string) {
    setFormulaInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => analyzeByFormula(value), 400);
  }

  function handleFormulaKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      analyzeByFormula(formulaInput);
    }
  }

  function handlePairChange(newA: string, newB: string) {
    setSymbolA(newA);
    setSymbolB(newB);

    const elA = elementMap.get(newA);
    const elB = elementMap.get(newB);

    if (!elA || !elB) {
      setResult(null);
      setError(null);
      return;
    }

    const bondType = determineBondType(elA, elB);
    const formula = newA === newB ? newA : `${newA}${newB}`;
    const crystalStructure = determineCrystalStructure(bondType, formula, [newA, newB]);
    const chiA = elA.electronegativity;
    const chiB = elB.electronegativity;
    const deltaChi = chiA !== null && chiB !== null
      ? Math.abs(chiA - chiB)
      : null;

    setError(null);
    setResult({
      formula,
      bond: {
        elementA: newA,
        elementB: newB,
        chiA,
        chiB,
        deltaChi,
        bondType,
        crystalStructure,
      },
      crystalStructure,
    });
  }

  function handleModeChange(newMode: InputMode) {
    setMode(newMode);
    setResult(null);
    setError(null);
  }

  const sortedElements = [...elements].sort((a, b) => a.Z - b.Z);

  return (
    <section className="bond-calc">
      <h2 className="bond-calc__title">{m.bond_title()}</h2>

      <div className="bond-calc__modes">
        <button
          type="button"
          className={`bond-calc__mode-btn ${mode === 'formula' ? 'bond-calc__mode-btn--active' : ''}`}
          onClick={() => handleModeChange('formula')}
        >
          {m.bond_by_formula()}
        </button>
        <button
          type="button"
          className={`bond-calc__mode-btn ${mode === 'pair' ? 'bond-calc__mode-btn--active' : ''}`}
          onClick={() => handleModeChange('pair')}
        >
          {m.bond_by_pair()}
        </button>
      </div>

      {mode === 'formula' && (
        <div className="bond-calc__formula-input">
          <input
            type="text"
            className="bond-calc__input"
            placeholder={m.bond_formula_placeholder()}
            value={formulaInput}
            onChange={e => handleFormulaChange(e.target.value)}
            onKeyDown={handleFormulaKeyDown}
          />
        </div>
      )}

      {mode === 'pair' && (
        <div className="bond-calc__selects">
          <select
            className="bond-calc__select"
            value={symbolA}
            onChange={e => handlePairChange(e.target.value, symbolB)}
          >
            <option value="">{m.bond_element_a()}</option>
            {sortedElements.map(el => (
              <option key={el.symbol} value={el.symbol}>
                {el.symbol} — {el.name_ru}
              </option>
            ))}
          </select>
          <select
            className="bond-calc__select"
            value={symbolB}
            onChange={e => handlePairChange(symbolA, e.target.value)}
          >
            <option value="">{m.bond_element_b()}</option>
            {sortedElements.map(el => (
              <option key={el.symbol} value={el.symbol}>
                {el.symbol} — {el.name_ru}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && <div className="bond-calc__error">{error}</div>}

      {result && <BondResultCard result={result} />}
    </section>
  );
}

interface BondResultCardProps {
  result: AnalysisResult;
}

function BondResultCard({ result }: BondResultCardProps) {
  const { formula, bond, crystalStructure } = result;
  const props = CRYSTAL_PROPERTIES[crystalStructure];

  return (
    <div className="bond-result">
      <div className="bond-result__header">
        <span className="bond-result__formula">{formula}</span>
        <span className={`bond-result__badge bond-result__badge--${bond.bondType}`}>
          {BOND_TYPE_LABELS[bond.bondType]()}
        </span>
      </div>

      {bond.deltaChi !== null && (
        <div className="bond-result__delta">
          {'\u0394\u03C7'} = {bond.deltaChi.toFixed(2)}
        </div>
      )}

      <div className="bond-result__diagram">
        <BondDiagram bond={bond} />
      </div>

      {bond.chiA !== null && bond.chiB !== null && bond.elementA !== bond.elementB && (
        <div className="bond-result__bar">
          <ElectronegativityBar
            symbolA={bond.elementA}
            symbolB={bond.elementB}
            chiA={bond.chiA}
            chiB={bond.chiB}
          />
        </div>
      )}

      <div className="bond-result__crystal">
        <div className="bond-result__crystal-label">
          {CRYSTAL_LABELS[crystalStructure]()}
        </div>
        <dl className="bond-result__props">
          <dt>{m.prop_melting()}</dt>
          <dd>{props.melting()}</dd>
          <dt>{m.prop_hardness()}</dt>
          <dd>{props.hardness()}</dd>
          <dt>{m.prop_conductivity()}</dt>
          <dd>{props.conductivity()}</dd>
          <dt>{m.prop_solubility()}</dt>
          <dd>{props.solubility()}</dd>
        </dl>
      </div>
    </div>
  );
}

interface BondDiagramProps {
  bond: BondAnalysis;
}

function BondDiagram({ bond }: BondDiagramProps) {
  if (bond.bondType === 'ionic') {
    return <BondDiagramIonic symbolA={bond.elementA} symbolB={bond.elementB} />;
  }
  if (bond.bondType === 'metallic') {
    return <BondDiagramMetallic symbol={bond.elementA} />;
  }
  return (
    <BondDiagramCovalent
      symbolA={bond.elementA}
      symbolB={bond.elementB}
      polar={bond.bondType === 'covalent_polar'}
    />
  );
}
