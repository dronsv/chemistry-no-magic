import { useState, useEffect, useRef, useCallback } from 'react';
import type { Element } from '../../types/element';
import type { BondType, CrystalStructure, FormulaAnalysis, BondAnalysis } from '../../lib/bond-calculator';
import { analyzeFormula, determineBondType, determineCrystalStructure } from '../../lib/bond-calculator';
import { loadElements } from '../../lib/data-loader';
import BondDiagramIonic from './diagrams/BondDiagramIonic';
import BondDiagramCovalent from './diagrams/BondDiagramCovalent';
import BondDiagramMetallic from './diagrams/BondDiagramMetallic';
import ElectronegativityBar from './diagrams/ElectronegativityBar';

type InputMode = 'formula' | 'pair';

const BOND_TYPE_LABELS: Record<BondType, string> = {
  ionic: 'Ионная',
  covalent_polar: 'Ковалентная полярная',
  covalent_nonpolar: 'Ковалентная неполярная',
  metallic: 'Металлическая',
};

const CRYSTAL_LABELS: Record<CrystalStructure, string> = {
  ionic: 'Ионная решётка',
  molecular: 'Молекулярная решётка',
  atomic: 'Атомная решётка',
  metallic: 'Металлическая решётка',
};

const CRYSTAL_PROPERTIES: Record<CrystalStructure, { melting: string; hardness: string; conductivity: string; solubility: string }> = {
  ionic: { melting: 'Высокая (800-3000 \u00B0C)', hardness: 'Твёрдые, хрупкие', conductivity: 'В расплаве и растворе', solubility: 'Часто растворимы' },
  molecular: { melting: 'Низкая (< 300 \u00B0C)', hardness: 'Мягкие', conductivity: 'Не проводят', solubility: 'По-разному' },
  atomic: { melting: 'Очень высокая (> 1500 \u00B0C)', hardness: 'Очень твёрдые', conductivity: 'Не проводят (кроме графита)', solubility: 'Нерастворимы' },
  metallic: { melting: 'Разная (\u221239 \u00B0C Hg \u2026 3422 \u00B0C W)', hardness: 'Разная', conductivity: 'Высокая', solubility: 'Нерастворимы' },
};

interface AnalysisResult {
  formula: string;
  bond: BondAnalysis;
  crystalStructure: CrystalStructure;
}

export default function BondCalculator() {
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
    loadElements().then(elems => {
      setElements(elems);
      const map = new Map<string, Element>();
      for (const el of elems) {
        map.set(el.symbol, el);
      }
      setElementMap(map);
    });
  }, []);

  const analyzeByFormula = useCallback(function analyzeByFormula(formula: string) {
    if (!formula.trim() || elementMap.size === 0) {
      setResult(null);
      setError(null);
      return;
    }

    const analysis: FormulaAnalysis = analyzeFormula(formula.trim(), elementMap);

    if (analysis.bonds.length === 0) {
      setError('Не удалось распознать формулу. Проверьте написание.');
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
      <h2 className="bond-calc__title">Определение типа связи</h2>

      <div className="bond-calc__modes">
        <button
          type="button"
          className={`bond-calc__mode-btn ${mode === 'formula' ? 'bond-calc__mode-btn--active' : ''}`}
          onClick={() => handleModeChange('formula')}
        >
          По формуле
        </button>
        <button
          type="button"
          className={`bond-calc__mode-btn ${mode === 'pair' ? 'bond-calc__mode-btn--active' : ''}`}
          onClick={() => handleModeChange('pair')}
        >
          По паре элементов
        </button>
      </div>

      {mode === 'formula' && (
        <div className="bond-calc__formula-input">
          <input
            type="text"
            className="bond-calc__input"
            placeholder="Введите формулу, например NaCl, H2O, Fe..."
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
            <option value="">Элемент A</option>
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
            <option value="">Элемент B</option>
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
          {BOND_TYPE_LABELS[bond.bondType]}
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
          {CRYSTAL_LABELS[crystalStructure]}
        </div>
        <dl className="bond-result__props">
          <dt>Т. плавления</dt>
          <dd>{props.melting}</dd>
          <dt>Твёрдость</dt>
          <dd>{props.hardness}</dd>
          <dt>Электропроводность</dt>
          <dd>{props.conductivity}</dd>
          <dt>Растворимость</dt>
          <dd>{props.solubility}</dd>
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
