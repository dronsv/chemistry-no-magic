import { useState } from 'react';
import * as m from '../../paraglide/messages.js';

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`theory-section ${open ? 'theory-section--open' : ''}`}>
      <button
        type="button"
        className="theory-section__toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="theory-section__title">{title}</span>
        <span className="theory-section__arrow">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="theory-section__body">{children}</div>}
    </div>
  );
}

export default function CalculationsTheoryPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="theory-panel">
      <button
        type="button"
        className={`theory-panel__trigger ${open ? 'theory-panel__trigger--active' : ''}`}
        onClick={() => setOpen(!open)}
      >
        <span>📖</span>
        <span>{m.theory_calc_trigger()}</span>
        <span className="theory-panel__trigger-arrow">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="theory-panel__content">
          <CollapsibleSection title={m.calc_molar_mass()} defaultOpen>
            <div className="calc-theory">
              <p>{m.calc_theory_molar_mass_desc()}</p>
              <div className="calc-theory__formula">
                {m.calc_theory_molar_mass_formula()}
              </div>
              <p>{m.calc_theory_molar_mass_note()}</p>
              <div className="calc-theory__examples">
                <div className="calc-theory__example">
                  <strong>{m.calc_theory_example_label()}</strong> {m.calc_theory_molar_mass_ex1()}
                </div>
                <div className="calc-theory__example">
                  <strong>{m.calc_theory_example_label()}</strong> {m.calc_theory_molar_mass_ex2()}
                </div>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title={m.calc_amount()}>
            <div className="calc-theory">
              <p>{m.calc_theory_amount_desc()}</p>
              <div className="calc-theory__formula-group">
                <div className="calc-theory__formula">{m.calc_theory_amount_f1()}</div>
                <div className="calc-theory__formula">{m.calc_theory_amount_f2()}</div>
                <div className="calc-theory__formula">{m.calc_theory_amount_f3()}</div>
                <div className="calc-theory__formula">{m.calc_theory_amount_f4()}</div>
              </div>
              <div className="calc-theory__examples">
                <div className="calc-theory__example">
                  <strong>{m.calc_theory_example_label()}</strong> {m.calc_theory_amount_ex1()}
                </div>
                <div className="calc-theory__example">
                  <strong>{m.calc_theory_example_label()}</strong> {m.calc_theory_amount_ex2()}
                </div>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title={m.calc_mass_fraction()}>
            <div className="calc-theory">
              <p>{m.calc_theory_mass_fraction_desc()}</p>
              <div className="calc-theory__formula">
                {m.calc_theory_mass_fraction_formula()}
              </div>
              <p>{m.calc_theory_mass_fraction_note()}</p>
              <div className="calc-theory__examples">
                <div className="calc-theory__example">
                  <strong>{m.calc_theory_example_label()}</strong> {m.calc_theory_mass_fraction_ex1()}
                </div>
                <div className="calc-theory__example">
                  <strong>{m.calc_theory_example_label()}</strong> {m.calc_theory_mass_fraction_ex2()}
                </div>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title={m.calc_solution_fraction()}>
            <div className="calc-theory">
              <p>{m.calc_theory_solution_desc()}</p>
              <div className="calc-theory__formula-group">
                <div className="calc-theory__formula">{m.calc_theory_solution_f1()}</div>
                <div className="calc-theory__formula">{m.calc_theory_solution_f2()}</div>
                <div className="calc-theory__formula">{m.calc_theory_solution_f3()}</div>
              </div>
              <p>{m.calc_theory_dilution_note()}</p>
              <div className="calc-theory__examples">
                <div className="calc-theory__example">
                  <strong>{m.calc_theory_example_label()}</strong> {m.calc_theory_solution_ex1()}
                </div>
                <div className="calc-theory__example">
                  <strong>{m.calc_theory_example_label()}</strong> {m.calc_theory_solution_ex2()}
                </div>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title={m.calc_equation()}>
            <div className="calc-theory">
              <p>{m.calc_theory_equation_desc()}</p>
              <ol className="calc-theory__steps">
                <li>{m.calc_theory_eq_step1()}</li>
                <li>{m.calc_theory_eq_step2()}</li>
                <li>{m.calc_theory_eq_step3()}</li>
                <li>{m.calc_theory_eq_step4()}</li>
              </ol>
              <div className="calc-theory__examples">
                <div className="calc-theory__example">
                  <strong>{m.calc_theory_example_label()}</strong> {m.calc_theory_equation_ex()}
                  <br />{m.calc_theory_equation_ex_sol()}
                </div>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title={m.calc_yield()}>
            <div className="calc-theory">
              <p>{m.calc_theory_yield_desc()}</p>
              <div className="calc-theory__formula-group">
                <div className="calc-theory__formula">{m.calc_theory_yield_f1()}</div>
                <div className="calc-theory__formula">{m.calc_theory_yield_f2()}</div>
              </div>
              <p>{m.calc_theory_yield_note()}</p>
              <div className="calc-theory__examples">
                <div className="calc-theory__example">
                  <strong>{m.calc_theory_example_label()}</strong> {m.calc_theory_yield_ex()}
                </div>
              </div>
            </div>
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
}
