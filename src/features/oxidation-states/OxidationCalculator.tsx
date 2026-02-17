import { useState, useEffect, useRef, useCallback } from 'react';
import type { Element, MetalType } from '../../types/element';
import type { MoleculeStructure } from '../../types/molecule';
import type { ExplainedResult, SolveStep, StepRuleId } from '../../lib/oxidation-state';
import { explainOxidationSteps } from '../../lib/oxidation-state';
import { parseFormula } from '../../lib/formula-parser';
import { loadElements, loadStructure } from '../../lib/data-loader';
import FormulaWithOxStates from './diagrams/FormulaWithOxStates';
import MoleculeView from '../../components/MoleculeView';

interface ElementInfo {
  group: number;
  metal_type: MetalType;
}

const RULE_LABELS: Record<StepRuleId, string> = {
  simple_substance: 'Простое вещество \u2192 СО = 0',
  fluorine: 'Фтор \u2192 всегда \u22121',
  group1: 'Щелочной металл (I группа) \u2192 +1',
  group2: 'Щёлочноземельный металл (II группа) \u2192 +2',
  aluminum: 'Алюминий \u2192 +3',
  oxygen: 'Кислород \u2192 \u22122',
  oxygen_peroxide: 'Кислород в пероксиде \u2192 \u22121',
  hydrogen: 'Водород \u2192 +1',
  hydrogen_hydride: 'Водород в гидриде \u2192 \u22121',
  algebraic: 'Алгебраический расчёт',
};

function formatState(state: number): string {
  if (state === 0) return '0';
  if (state > 0) return `+${state}`;
  return `\u2212${Math.abs(state)}`;
}

function stateColor(state: number): string {
  if (state > 0) return '#dc2626';
  if (state < 0) return '#2563eb';
  return '#6b7280';
}

interface StepCardProps {
  step: SolveStep;
}

function StepCard({ step }: StepCardProps) {
  const borderColor = step.state >= 0 ? '#dc2626' : '#2563eb';

  return (
    <div className="ox-step" style={{ borderLeftColor: borderColor }}>
      <span className="ox-step__badge">{step.symbol}</span>
      <div className="ox-step__content">
        <div className="ox-step__rule">{RULE_LABELS[step.rule_id]}</div>
        <span className="ox-step__state" style={{ color: stateColor(step.state) }}>
          {formatState(step.state)}
        </span>
        {step.rule_id === 'algebraic' && step.equation && (
          <div className="ox-step__equation">{step.equation}</div>
        )}
      </div>
    </div>
  );
}

export default function OxidationCalculator() {
  const [elementInfoMap, setElementInfoMap] = useState<Map<string, ElementInfo>>(new Map());
  const [formulaInput, setFormulaInput] = useState('');
  const [result, setResult] = useState<ExplainedResult | null>(null);
  const [structure, setStructure] = useState<MoleculeStructure | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadElements().then(elems => {
      const map = new Map<string, ElementInfo>();
      for (const el of elems) {
        map.set(el.symbol, { group: el.group, metal_type: el.metal_type });
      }
      setElementInfoMap(map);
    });
  }, []);

  const analyze = useCallback(function analyze(formula: string) {
    if (!formula.trim() || elementInfoMap.size === 0) {
      setResult(null);
      setStructure(null);
      setError(null);
      return;
    }

    const trimmed = formula.trim();
    const parsed = parseFormula(trimmed);

    if (Object.keys(parsed).length === 0) {
      setError('Не удалось распознать формулу. Проверьте написание.');
      setResult(null);
      return;
    }

    // Check all symbols exist in element map
    for (const sym of Object.keys(parsed)) {
      if (!elementInfoMap.has(sym)) {
        setError(`Неизвестный элемент: ${sym}`);
        setResult(null);
        return;
      }
    }

    const explained = explainOxidationSteps(parsed, elementInfoMap, trimmed);

    if (explained.error === 'ambiguous') {
      setError('Невозможно однозначно определить СО: несколько неизвестных.');
      setResult(null);
      return;
    }

    setError(null);
    setResult(explained);
    setShowSteps(false);

    // Try to load molecule structure for known substances
    const substanceId = trimmed.toLowerCase().replace(/\(/g, '_').replace(/\)/g, '');
    loadStructure(substanceId).then(setStructure).catch(() => setStructure(null));
  }, [elementInfoMap]);

  function handleFormulaChange(value: string) {
    setFormulaInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => analyze(value), 400);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      analyze(formulaInput);
    }
  }

  const counts = result
    ? parseFormula(formulaInput.trim())
    : {};

  return (
    <section className="ox-calc">
      <h2 className="ox-calc__title">Степени окисления</h2>

      <div className="ox-calc__formula-input">
        <input
          type="text"
          className="ox-calc__input"
          placeholder="Введите формулу, например KMnO4, H2O, NaH..."
          value={formulaInput}
          onChange={e => handleFormulaChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      {error && <div className="ox-calc__error">{error}</div>}

      {result && !error && (
        <div className="ox-result">
          <div className="ox-result__formula-svg">
            <FormulaWithOxStates
              assignments={result.assignments}
              counts={counts}
            />
          </div>

          {structure && (
            <div className="ox-result__structure">
              <MoleculeView
                structure={structure}
                layers={{ bonds: true, oxStates: true, charges: false, lonePairs: false }}
                size="md"
                interactive
              />
            </div>
          )}

          <button
            type="button"
            className="ox-steps-toggle"
            onClick={() => setShowSteps(!showSteps)}
          >
            {showSteps ? 'Скрыть решение' : 'Показать решение'}
          </button>

          {showSteps && (
            <div className="ox-steps">
              {result.steps.map((step, i) => (
                <StepCard key={`${step.symbol}-${i}`} step={step} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
