import { useState, useEffect } from 'react';
import type { ClassificationRule, NamingRule } from '../../types/classification';
import { loadClassificationRules, loadNamingRules } from '../../lib/data-loader';

const CLASS_LABELS: Record<string, string> = {
  oxide: 'Оксиды',
  acid: 'Кислоты',
  base: 'Основания',
  salt: 'Соли',
};

const SUBCLASS_LABELS: Record<string, string> = {
  basic: 'Основные',
  acidic: 'Кислотные',
  amphoteric: 'Амфотерные',
  indifferent: 'Несолеобразующие',
  oxygen_containing: 'Кислородсодержащие',
  oxygen_free: 'Бескислородные',
  soluble: 'Растворимые (щёлочи)',
  insoluble: 'Нерастворимые',
  normal: 'Средние (нормальные)',
  acidic_salt: 'Кислые',
  basic_salt: 'Основные',
};

const CLASS_ORDER = ['oxide', 'acid', 'base', 'salt'];

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

function ClassificationRuleCard({ rule }: { rule: ClassificationRule }) {
  return (
    <div className="subst-theory__rule">
      <div className="subst-theory__rule-header">
        {SUBCLASS_LABELS[rule.subclass] ?? rule.subclass}
      </div>
      <p className="subst-theory__rule-desc">{rule.description_ru}</p>
      <div className="subst-theory__rule-examples">
        {rule.examples.join(', ')}
      </div>
    </div>
  );
}

function NamingRuleCard({ rule }: { rule: NamingRule }) {
  return (
    <div className="subst-theory__rule">
      <div className="subst-theory__rule-header">
        {rule.template_ru}
      </div>
      <div className="subst-theory__naming-examples">
        {rule.examples.map((ex, i) => (
          <span key={i} className="subst-theory__naming-pair">
            {ex.formula} — {ex.name_ru}
            {i < rule.examples.length - 1 ? '; ' : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ClassificationTheoryPanel() {
  const [classRules, setClassRules] = useState<ClassificationRule[] | null>(null);
  const [namingRules, setNamingRules] = useState<NamingRule[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || classRules) return;
    setLoading(true);
    Promise.all([loadClassificationRules(), loadNamingRules()])
      .then(([cRules, nRules]) => {
        setClassRules(cRules);
        setNamingRules(nRules);
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки');
        setLoading(false);
      });
  }, [open, classRules]);

  // Group rules by class
  const classGroups = classRules
    ? CLASS_ORDER.map(cls => ({
        cls,
        label: CLASS_LABELS[cls],
        rules: classRules.filter(r => r.class === cls),
      }))
    : [];

  const namingGroups = namingRules
    ? CLASS_ORDER.map(cls => ({
        cls,
        label: CLASS_LABELS[cls],
        rules: namingRules.filter(r => r.class === cls),
      }))
    : [];

  return (
    <div className="theory-panel">
      <button
        type="button"
        className={`theory-panel__trigger ${open ? 'theory-panel__trigger--active' : ''}`}
        onClick={() => setOpen(!open)}
      >
        <span>📖</span>
        <span>Теория: классификация и номенклатура</span>
        <span className="theory-panel__trigger-arrow">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="theory-panel__content">
          {loading && <div className="theory-panel__loading">Загрузка...</div>}
          {error && <div className="theory-panel__error">{error}</div>}

          {classRules && namingRules && (
            <>
              <h3 className="theory-panel__heading">Классификация неорганических веществ</h3>
              {classGroups.map(group => (
                <CollapsibleSection key={group.cls} title={group.label}>
                  {group.rules.map(rule => (
                    <ClassificationRuleCard key={rule.id} rule={rule} />
                  ))}
                </CollapsibleSection>
              ))}

              <h3 className="theory-panel__heading">Амфотерность</h3>
              <CollapsibleSection title="Что такое амфотерность?">
                <div className="subst-theory__rule">
                  <p className="subst-theory__rule-desc">
                    <strong>Амфотерные</strong> вещества проявляют двойственные свойства: реагируют и с кислотами (как основания), и с щелочами (как кислоты).
                  </p>
                  <p className="subst-theory__rule-desc">
                    Типичные амфотерные металлы: <strong>Al, Zn, Be, Cr(III), Fe(III), Pb(II), Sn(II)</strong>.
                  </p>
                </div>
              </CollapsibleSection>
              <CollapsibleSection title="Амфотерные оксиды">
                <div className="subst-theory__rule">
                  <p className="subst-theory__rule-desc">
                    Примеры: Al₂O₃, ZnO, BeO, Cr₂O₃, Fe₂O₃
                  </p>
                  <p className="subst-theory__rule-desc">
                    Реакция с кислотой: Al₂O₃ + 6HCl → 2AlCl₃ + 3H₂O
                  </p>
                  <p className="subst-theory__rule-desc">
                    Реакция с щёлочью: Al₂O₃ + 2NaOH → 2NaAlO₂ + H₂O
                  </p>
                </div>
              </CollapsibleSection>
              <CollapsibleSection title="Амфотерные гидроксиды">
                <div className="subst-theory__rule">
                  <p className="subst-theory__rule-desc">
                    Примеры: Al(OH)₃, Zn(OH)₂, Be(OH)₂, Cr(OH)₃
                  </p>
                  <p className="subst-theory__rule-desc">
                    Реакция с кислотой: Al(OH)₃ + 3HCl → AlCl₃ + 3H₂O
                  </p>
                  <p className="subst-theory__rule-desc">
                    Реакция с щёлочью: Al(OH)₃ + NaOH → NaAlO₂ + 2H₂O
                  </p>
                </div>
              </CollapsibleSection>

              <h3 className="theory-panel__heading">Номенклатура</h3>
              {namingGroups.map(group => (
                <CollapsibleSection key={group.cls} title={group.label}>
                  {group.rules.map(rule => (
                    <NamingRuleCard key={rule.id} rule={rule} />
                  ))}
                </CollapsibleSection>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
