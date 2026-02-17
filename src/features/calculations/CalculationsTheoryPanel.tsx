import { useState } from 'react';

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
        <span>Теория: расчёты по химии</span>
        <span className="theory-panel__trigger-arrow">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="theory-panel__content">
          <CollapsibleSection title="Молярная масса" defaultOpen>
            <div className="calc-theory">
              <p><strong>Молярная масса (M)</strong> — масса одного моля вещества, измеряется в г/моль.</p>
              <div className="calc-theory__formula">
                M = Σ(A<sub>r</sub> × число атомов)
              </div>
              <p>Где A<sub>r</sub> — относительная атомная масса элемента (из таблицы Менделеева).</p>
              <div className="calc-theory__examples">
                <div className="calc-theory__example">
                  <strong>Пример:</strong> M(H₂SO₄) = 2×1 + 32 + 4×16 = <strong>98 г/моль</strong>
                </div>
                <div className="calc-theory__example">
                  <strong>Пример:</strong> M(Ca(OH)₂) = 40 + 2×(16+1) = <strong>74 г/моль</strong>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Количество вещества">
            <div className="calc-theory">
              <p><strong>Количество вещества (n)</strong> — число молей, связывает массу с молярной массой.</p>
              <div className="calc-theory__formula-group">
                <div className="calc-theory__formula">n = m / M</div>
                <div className="calc-theory__formula">m = n × M</div>
                <div className="calc-theory__formula">V = n × V<sub>m</sub> (для газов, V<sub>m</sub> = 22,4 л/моль при н.у.)</div>
                <div className="calc-theory__formula">N = n × N<sub>A</sub> (N<sub>A</sub> = 6,02 × 10²³)</div>
              </div>
              <div className="calc-theory__examples">
                <div className="calc-theory__example">
                  <strong>Пример:</strong> Сколько моль в 49 г H₂SO₄? → n = 49/98 = <strong>0,5 моль</strong>
                </div>
                <div className="calc-theory__example">
                  <strong>Пример:</strong> Масса 3 моль NaCl? → m = 3 × 58,5 = <strong>175,5 г</strong>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Массовая доля элемента">
            <div className="calc-theory">
              <p><strong>Массовая доля элемента (ω)</strong> — доля массы данного элемента в общей массе вещества.</p>
              <div className="calc-theory__formula">
                ω(E) = n × A<sub>r</sub>(E) / M(вещества) × 100%
              </div>
              <p>Где n — число атомов элемента в формуле.</p>
              <div className="calc-theory__examples">
                <div className="calc-theory__example">
                  <strong>Пример:</strong> ω(O) в H₂O = 16/18 × 100% = <strong>88,9%</strong>
                </div>
                <div className="calc-theory__example">
                  <strong>Пример:</strong> ω(N) в NH₃ = 14/17 × 100% = <strong>82,4%</strong>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Массовая доля растворённого вещества">
            <div className="calc-theory">
              <p><strong>Массовая доля растворённого вещества (ω)</strong> — отношение массы растворённого вещества к массе раствора.</p>
              <div className="calc-theory__formula-group">
                <div className="calc-theory__formula">ω = m(р.в.) / m(р-ра) × 100%</div>
                <div className="calc-theory__formula">m(р-ра) = m(р.в.) + m(воды)</div>
                <div className="calc-theory__formula">m(р.в.) = ω × m(р-ра) / 100%</div>
              </div>
              <p><strong>При разбавлении:</strong> масса растворённого вещества не меняется, а масса раствора увеличивается.</p>
              <div className="calc-theory__examples">
                <div className="calc-theory__example">
                  <strong>Пример:</strong> 20 г соли в 200 г раствора → ω = 20/200 × 100% = <strong>10%</strong>
                </div>
                <div className="calc-theory__example">
                  <strong>Пример:</strong> К 200 г 10%-ного раствора добавили 300 г воды → m(р.в.) = 20 г, m(р-ра) = 500 г → ω = 20/500 × 100% = <strong>4%</strong>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Расчёты по уравнению реакции">
            <div className="calc-theory">
              <p><strong>Алгоритм расчёта по уравнению реакции:</strong></p>
              <ol className="calc-theory__steps">
                <li>Записать уравнение реакции, расставить коэффициенты.</li>
                <li>Найти количество вещества (n) данного вещества: n = m / M.</li>
                <li>По коэффициентам уравнения найти n искомого вещества.</li>
                <li>Найти массу (или объём) искомого вещества: m = n × M.</li>
              </ol>
              <div className="calc-theory__examples">
                <div className="calc-theory__example">
                  <strong>Пример:</strong> CaCO₃ → CaO + CO₂. Сколько CaO из 200 г CaCO₃?
                  <br />n(CaCO₃) = 200/100 = 2 моль → n(CaO) = 2 моль → m(CaO) = 2 × 56 = <strong>112 г</strong>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Выход продукта реакции">
            <div className="calc-theory">
              <p><strong>Выход продукта (η)</strong> — отношение практически полученной массы продукта к теоретически возможной.</p>
              <div className="calc-theory__formula-group">
                <div className="calc-theory__formula">η = m(практ.) / m(теорет.) × 100%</div>
                <div className="calc-theory__formula">m(практ.) = m(теорет.) × η / 100%</div>
              </div>
              <p>Теоретическая масса — рассчитанная по уравнению реакции (η = 100%). На практике выход всегда меньше 100% из-за потерь и побочных реакций.</p>
              <div className="calc-theory__examples">
                <div className="calc-theory__example">
                  <strong>Пример:</strong> По расчёту должно получиться 112 г CaO, а получено 89,6 г → η = 89,6/112 × 100% = <strong>80%</strong>
                </div>
              </div>
            </div>
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
}
