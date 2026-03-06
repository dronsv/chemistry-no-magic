/**
 * Canonical page → source file dependencies map.
 *
 * Used by:
 *   - scripts/generate-feed.mjs  (change-aware RSS pubDate)
 *   - (future) selective IndexNow, sitemap lastmod
 *
 * Rules:
 *   - List the files whose changes meaningfully affect page content.
 *   - Prefer data-src/ files over src/ templates (data changes more often).
 *   - For shared deps (e.g. BaseLayout), omit — they affect everything equally.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');

const elements = JSON.parse(readFileSync(join(ROOT, 'data-src/elements.json'), 'utf8'));

// ── Shared dep sets ────────────────────────────────────────────────────────

const ELEMENT_PAGE_DEPS = [
  'data-src/elements.json',
  'src/pages/periodic-table/[symbol].astro',
];

const BONDS_DEPS = [
  'src/pages/bonds/index.astro',
  'data-src/rules/bond_theory.json',
  'data-src/theory_modules/bonds_and_crystals.json',
  'data-src/rules/bond_examples.json',
];

const OX_DEPS = [
  'src/pages/oxidation-states/index.astro',
  'data-src/rules/oxidation_rules.json',
  'data-src/theory_modules/oxidation_states.json',
  'data-src/rules/oxidation_examples.json',
];

const CALC_DEPS = [
  'src/pages/calculations/index.astro',
  'data-src/theory_modules/calculations.json',
  'data-src/rules/calculations_data.json',
];

const REACTIONS_DEPS = [
  'src/pages/reactions/index.astro',
  'data-src/reactions/reactions.json',
  'data-src/rules/classification_rules.json',
];

const PT_DEPS = [
  'src/pages/periodic-table/index.astro',
  'data-src/elements.json',
  'data-src/rules/periodic-table-theory.json',
  'data-src/rules/periodic_trend_anomalies.json',
];

const SUBSTANCES_DEPS = [
  'data-src/rules/classification_rules.json',
  'data-src/rules/naming_rules.json',
];

const IONS_DEPS = [
  'src/pages/ions.astro',
  'data-src/ions.json',
  'data-src/rules/solubility_rules_full.json',
];

const DIAGNOSTICS_DEPS = [
  'data-src/rules/competencies.json',
  'data-src/diagnostic/questions.json',
];

const EXAM_DEPS = [
  'data-src/exam/oge/',
];

const COMPETENCIES_DEPS = [
  'src/pages/competencies.astro',
  'data-src/rules/competencies.json',
];

// ── Section pages ─────────────────────────────────────────────────────────

const SECTION_PAGES = [
  // Russian (default)
  { slug: '/', title: 'Главная — Химия без магии', description: 'Адаптивная платформа подготовки к ОГЭ по химии.', lang: 'ru', deps: ['src/pages/index.astro'] },
  { slug: '/periodic-table/', title: 'Периодическая таблица Менделеева', description: 'Интерактивная периодическая таблица с электронными конфигурациями.', lang: 'ru', deps: PT_DEPS },
  { slug: '/bonds/', title: 'Химическая связь', description: 'Определение типа химической связи и кристаллической решётки.', lang: 'ru', deps: BONDS_DEPS },
  { slug: '/oxidation-states/', title: 'Степени окисления', description: 'Пошаговое определение степеней окисления в соединениях.', lang: 'ru', deps: OX_DEPS },
  { slug: '/calculations/', title: 'Расчёты по химии', description: 'Молярная масса, стехиометрия, массовая доля, выход продукта.', lang: 'ru', deps: CALC_DEPS },
  { slug: '/reactions/', title: 'Химические реакции', description: 'Классификация химических реакций. Теория и практика для ОГЭ.', lang: 'ru', deps: REACTIONS_DEPS },
  { slug: '/substances/', title: 'Классификация веществ', description: 'Оксиды, кислоты, основания, соли — классификация и номенклатура.', lang: 'ru', deps: SUBSTANCES_DEPS },
  { slug: '/ions/', title: 'Ионы', description: 'Справочник ионов: таблица растворимости, катионы и анионы.', lang: 'ru', deps: IONS_DEPS },
  { slug: '/diagnostics/', title: 'Диагностика знаний', description: 'Адаптивная диагностика: определите пробелы в знаниях по химии.', lang: 'ru', deps: DIAGNOSTICS_DEPS },
  { slug: '/exam/', title: 'Подготовка к ОГЭ', description: 'Задания ОГЭ по химии с пошаговыми решениями.', lang: 'ru', deps: EXAM_DEPS },
  { slug: '/competencies/', title: 'Компетенции', description: '20 учебных модулей платформы с теорией и практикой.', lang: 'ru', deps: COMPETENCIES_DEPS },

  // English
  { slug: '/en/', title: 'Chemistry Without Magic', description: 'Adaptive chemistry learning platform.', lang: 'en', deps: ['src/pages/en/index.astro'] },
  { slug: '/en/periodic-table/', title: 'Periodic Table', description: 'Interactive periodic table: electron configurations, orbital diagrams.', lang: 'en', deps: PT_DEPS },
  { slug: '/en/bonds/', title: 'Chemical Bonds', description: 'Determine bond types and crystal lattices.', lang: 'en', deps: BONDS_DEPS },
  { slug: '/en/oxidation-states/', title: 'Oxidation States', description: 'Determine oxidation states step by step.', lang: 'en', deps: OX_DEPS },
  { slug: '/en/calculations/', title: 'Chemical Calculations', description: 'Molar mass, stoichiometry, mass fraction, reaction yield.', lang: 'en', deps: CALC_DEPS },
  { slug: '/en/diagnostics/', title: 'Chemistry Diagnostics', description: 'Adaptive knowledge diagnostics for chemistry.', lang: 'en', deps: DIAGNOSTICS_DEPS },
  { slug: '/en/exam/', title: 'Exam Practice', description: 'Chemistry exam practice with step-by-step solutions.', lang: 'en', deps: EXAM_DEPS },

  // Polish
  { slug: '/pl/', title: 'Chemia bez magii', description: 'Platforma do adaptacyjnej nauki chemii.', lang: 'pl', deps: ['src/pages/pl/index.astro'] },
  { slug: '/pl/tablica-okresowa/', title: 'Układ okresowy', description: 'Interaktywny układ okresowy pierwiastków.', lang: 'pl', deps: PT_DEPS },
  { slug: '/pl/wiazania/', title: 'Wiązania chemiczne', description: 'Określanie typów wiązań chemicznych i sieci krystalicznych.', lang: 'pl', deps: BONDS_DEPS },
  { slug: '/pl/stopnie-utlenienia/', title: 'Stopnie utlenienia', description: 'Określanie stopni utlenienia krok po kroku.', lang: 'pl', deps: OX_DEPS },
  { slug: '/pl/obliczenia/', title: 'Obliczenia chemiczne', description: 'Masa molowa, stechiometria, ułamek masowy.', lang: 'pl', deps: CALC_DEPS },
  { slug: '/pl/diagnostyka/', title: 'Diagnostyka wiedzy', description: 'Adaptacyjna diagnostyka wiedzy chemicznej.', lang: 'pl', deps: DIAGNOSTICS_DEPS },
  { slug: '/pl/egzamin/', title: 'Przygotowanie do egzaminu', description: 'Zadania egzaminacyjne z chemii z rozwiązaniami.', lang: 'pl', deps: EXAM_DEPS },

  // Spanish
  { slug: '/es/', title: 'Química sin magia', description: 'Plataforma de aprendizaje adaptativo de química.', lang: 'es', deps: ['src/pages/es/index.astro'] },
  { slug: '/es/tabla-periodica/', title: 'Tabla periódica', description: 'Tabla periódica interactiva de elementos.', lang: 'es', deps: PT_DEPS },
  { slug: '/es/enlaces/', title: 'Enlaces químicos', description: 'Determinación de tipos de enlaces y redes cristalinas.', lang: 'es', deps: BONDS_DEPS },
  { slug: '/es/estados-oxidacion/', title: 'Estados de oxidación', description: 'Determinación de estados de oxidación paso a paso.', lang: 'es', deps: OX_DEPS },
  { slug: '/es/calculos/', title: 'Cálculos químicos', description: 'Masa molar, estequiometría, fracción de masa.', lang: 'es', deps: CALC_DEPS },
  { slug: '/es/diagnostico/', title: 'Diagnóstico de conocimientos', description: 'Diagnóstico adaptativo de conocimientos químicos.', lang: 'es', deps: DIAGNOSTICS_DEPS },
  { slug: '/es/examen/', title: 'Práctica de examen', description: 'Ejercicios de examen de química con soluciones.', lang: 'es', deps: EXAM_DEPS },
];

// ── Key element pages ─────────────────────────────────────────────────────

const KEY_ELEMENT_SYMBOLS = ['H', 'O', 'C', 'N', 'Na', 'Cl', 'Fe', 'Cu', 'Au', 'Ca', 'Al', 'Si', 'P', 'S'];

const ELEMENT_PAGES = KEY_ELEMENT_SYMBOLS.map(sym => {
  const el = elements.find(e => e.symbol === sym);
  return {
    slug: `/periodic-table/${sym}/`,
    title: `${sym} — ${el?.name_ru ?? sym} / ${el?.name_en ?? sym}`,
    description: `Химический элемент ${el?.name_ru ?? sym}: электронная конфигурация, свойства, степени окисления.`,
    lang: 'ru',
    deps: ELEMENT_PAGE_DEPS,
  };
});

export const PAGE_DEPS = [...SECTION_PAGES, ...ELEMENT_PAGES];
