/**
 * Generate search_index.json from all data sources.
 * Each entry has a pre-computed `search` field for fast client-side matching.
 */

/** Normalize formula subscripts (₂→2, ₃→3 etc.) for ASCII matching. */
function normalizeFormula(formula) {
  if (!formula) return '';
  const subscriptMap = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };
  return formula.replace(/[₀-₉]/g, ch => subscriptMap[ch] || ch);
}

/** Build lowercase search string from an array of fields. */
function buildSearch(fields) {
  return fields.filter(Boolean).join(' ').toLowerCase();
}

/**
 * @param {object} data
 * @param {any[]} data.elements
 * @param {Array<{filename: string, data: any}>} data.substances
 * @param {any[]} data.reactions
 * @param {any[]} data.competencies
 * @returns {any[]} SearchIndexEntry[]
 */
export function generateSearchIndex({ elements, substances, reactions, competencies }) {
  const entries = [];

  // Elements
  for (const el of elements) {
    entries.push({
      id: `element_${el.symbol}`,
      category: 'element',
      title: el.symbol,
      subtitle: el.name_ru,
      search: buildSearch([
        el.symbol,
        el.name_ru,
        el.name_en,
        el.name_latin,
        String(el.Z),
        el.element_group,
      ]),
      url: `/periodic-table/${el.symbol}/`,
      meta: {
        Z: String(el.Z),
        group: el.element_group,
      },
    });
  }

  // Substances
  for (const { data: sub } of substances) {
    const normalized = normalizeFormula(sub.formula);
    entries.push({
      id: `substance_${sub.id}`,
      category: 'substance',
      title: sub.formula,
      subtitle: sub.name_ru,
      search: buildSearch([
        sub.formula,
        normalized,
        sub.name_ru,
        sub.class,
        sub.subclass,
      ]),
      url: `/substances/${sub.id}/`,
      meta: {
        class: sub.class,
      },
    });
  }

  // Reactions
  for (const rx of reactions) {
    const formulaFields = [];
    if (rx.molecular) {
      for (const r of rx.molecular.reactants || []) {
        formulaFields.push(r.formula, r.name);
      }
      for (const p of rx.molecular.products || []) {
        formulaFields.push(p.formula, p.name);
      }
    }
    entries.push({
      id: `reaction_${rx.reaction_id}`,
      category: 'reaction',
      title: rx.title,
      subtitle: rx.equation,
      search: buildSearch([
        rx.title,
        rx.equation,
        normalizeFormula(rx.equation),
        ...(rx.type_tags || []),
        ...formulaFields,
      ]),
      url: '/reactions/',
      meta: {
        tags: (rx.type_tags || []).join(','),
      },
    });
  }

  // Competencies
  for (const comp of competencies) {
    entries.push({
      id: `competency_${comp.id}`,
      category: 'competency',
      title: comp.name_ru,
      subtitle: comp.description_ru,
      search: buildSearch([
        comp.name_ru,
        comp.description_ru,
        comp.block_name_ru,
      ]),
      url: comp.link || '/profile/',
      meta: {
        block: comp.block_name_ru,
      },
    });
  }

  // Static pages
  const pages = [
    { id: 'page_home', title: 'Главная', subtitle: 'Химия без магии — подготовка к ОГЭ', keywords: 'главная химия огэ подготовка адаптивная платформа', url: '/' },
    { id: 'page_diagnostics', title: 'Диагностика', subtitle: 'Определение уровня знаний', keywords: 'диагностика тест уровень знания проверка', url: '/diagnostics/' },
    { id: 'page_periodic_table', title: 'Периодическая таблица', subtitle: 'Интерактивная таблица Менделеева', keywords: 'периодическая таблица менделеев элементы псхэ', url: '/periodic-table/' },
    { id: 'page_substances', title: 'Вещества', subtitle: 'Классификация и номенклатура', keywords: 'вещества классификация номенклатура оксиды кислоты соли основания', url: '/substances/' },
    { id: 'page_bonds', title: 'Химическая связь', subtitle: 'Типы связей и кристаллические решётки', keywords: 'связь ковалентная ионная металлическая кристаллическая решётка', url: '/bonds/' },
    { id: 'page_oxidation', title: 'Степени окисления', subtitle: 'Определение и расчёт степеней окисления', keywords: 'степени окисления со определение расчёт', url: '/oxidation-states/' },
    { id: 'page_reactions', title: 'Реакции', subtitle: 'Типы реакций, ОВР, качественные реакции', keywords: 'реакции обмен овр окислительно-восстановительные качественные генетические цепочки', url: '/reactions/' },
    { id: 'page_calculations', title: 'Расчёты', subtitle: 'Химические расчёты и задачи', keywords: 'расчёты молярная масса доля концентрация раствор стехиометрия выход', url: '/calculations/' },
    { id: 'page_exam', title: 'Экзамен ОГЭ', subtitle: 'Задания и пробный экзамен', keywords: 'экзамен огэ задания пробный тренировка', url: '/exam/' },
    { id: 'page_profile', title: 'Профиль', subtitle: 'Прогресс и результаты обучения', keywords: 'профиль прогресс результаты компетенции статистика', url: '/profile/' },
    { id: 'page_about', title: 'О проекте', subtitle: 'Информация о платформе', keywords: 'о проекте информация автор методика', url: '/about/' },
  ];

  for (const page of pages) {
    entries.push({
      id: page.id,
      category: 'page',
      title: page.title,
      subtitle: page.subtitle,
      search: buildSearch([page.title, page.subtitle, page.keywords]),
      url: page.url,
    });
  }

  return entries;
}
