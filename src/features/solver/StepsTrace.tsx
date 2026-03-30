import { useState } from 'react';
import type { ReasonStep } from '../../types/derivation';
import * as m from '../../paraglide/messages.js';

interface Props {
  steps: ReasonStep[];
  intermediates: Record<string, number>;
}

function formatQRef(step: ReasonStep & { qref?: { quantity: string; context?: { entity_ref?: string } } }): string {
  const qref = step.qref;
  if (!qref) return '';
  const q = qref.quantity.replace('q:', '');
  const entity = qref.context?.entity_ref?.replace('substance:', '') ?? '';
  return entity ? `${q}(${entity})` : q;
}

function formatValue(v: number): string {
  if (Math.abs(v) < 0.0001 && v !== 0) return v.toExponential(4);
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

function stepLabel(type: string): string {
  switch (type) {
    case 'given': return m.solver_given();
    case 'lookup': return m.solver_step_lookup();
    case 'decompose': return m.solver_step_decompose();
    case 'compute': return m.solver_step_compute();
    case 'formula_select': return m.solver_step_formula();
    case 'substitution': return m.solver_step_substitution();
    case 'conclusion': return m.solver_result();
    default: return type;
  }
}

function renderStep(step: ReasonStep, i: number): React.ReactNode {
  const type = step.type;
  const cls = `solver-step-item solver-step-item--${type}`;

  switch (step.type) {
    case 'given':
      return (
        <li key={i} className={cls}>
          <span className="solver-step-item__type">{stepLabel('given')}</span>
          {formatQRef(step)} = {formatValue(step.value)}
        </li>
      );
    case 'lookup':
      return (
        <li key={i} className={cls}>
          <span className="solver-step-item__type">{stepLabel('lookup')}</span>
          {step.source}: {formatQRef(step)} = {formatValue(step.value)}
        </li>
      );
    case 'decompose':
      return (
        <li key={i} className={cls}>
          <span className="solver-step-item__type">{stepLabel('decompose')}</span>
          {step.sourceRef} {'-> '}
          {step.components.map(c => `${c.element}\u00d7${c.count}`).join(', ')}
        </li>
      );
    case 'compute':
      return (
        <li key={i} className={cls}>
          <span className="solver-step-item__type">{stepLabel('compute')}</span>
          {step.formulaId.replace('formula:', '')} = {formatValue(step.result)}
          {step.approximate && ' \u2248'}
        </li>
      );
    case 'formula_select':
      return (
        <li key={i} className={cls}>
          <span className="solver-step-item__type">{stepLabel('formula_select')}</span>
          {step.formulaId.replace('formula:', '')}
        </li>
      );
    case 'substitution':
      return (
        <li key={i} className={cls}>
          <span className="solver-step-item__type">{stepLabel('substitution')}</span>
          {Object.entries(step.bindings)
            .map(([k, v]) => `${k}=${formatValue(v)}`)
            .join(', ')}
        </li>
      );
    case 'conclusion':
      return (
        <li key={i} className={cls}>
          <span className="solver-step-item__type">{stepLabel('conclusion')}</span>
          {formatQRef(step)} = {formatValue(step.value)}
        </li>
      );
    default:
      return null;
  }
}

export default function StepsTrace({ steps, intermediates }: Props) {
  const [stepsOpen, setStepsOpen] = useState(true);

  const numericIntermediates = Object.entries(intermediates).filter(
    ([k, v]) => typeof v === 'number' && k !== 'color' && k !== 'medium',
  );

  return (
    <>
      <div className="solver-steps">
        <div
          className={`solver-steps__title ${stepsOpen ? 'solver-steps__title--open' : ''}`}
          onClick={() => setStepsOpen(o => !o)}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M4 2l5 4-5 4z" />
          </svg>
          {m.solver_steps()}
        </div>
        {stepsOpen && (
          <ul className="solver-steps__list">
            {steps.map((s, i) => renderStep(s, i))}
          </ul>
        )}
      </div>

      {numericIntermediates.length > 0 && (
        <div className="solver-intermediates">
          <div className="solver-intermediates__title">{m.solver_intermediates()}</div>
          <div className="solver-intermediates__grid">
            {numericIntermediates.map(([k, v]) => (
              <React.Fragment key={k}>
                <span className="solver-intermediates__key">{k}</span>
                <span className="solver-intermediates__val">{formatValue(v)}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

import React from 'react';
