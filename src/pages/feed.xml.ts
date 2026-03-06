import type { APIRoute } from 'astro';

const SITE = 'https://chemistry.svistunov.online';
const SITE_NAME = 'Химия без магии';
const DESCRIPTION = 'Адаптивная платформа подготовки к экзаменам по химии. Интерактивная таблица Менделеева, химические связи, степени окисления, расчёты.';

const PAGES = [
  { slug: '/', title: 'Главная — Химия без магии', description: 'Адаптивная платформа подготовки к ОГЭ, ЕГЭ по химии. Диагностика, практика, справочник.' },
  { slug: '/periodic-table/', title: 'Периодическая таблица Менделеева', description: 'Интерактивная таблица: электронные конфигурации, тренды свойств, орбитальные диаграммы.' },
  { slug: '/bonds/', title: 'Химическая связь', description: 'Определение типа химической связи и кристаллической решётки. Калькулятор с пошаговым объяснением.' },
  { slug: '/oxidation-states/', title: 'Степени окисления', description: 'Определение степеней окисления элементов. Пошаговый калькулятор и теория.' },
  { slug: '/calculations/', title: 'Расчёты по химии', description: 'Молярная масса, стехиометрия, массовая доля, расчёты по уравнениям реакций.' },
  { slug: '/reactions/', title: 'Химические реакции', description: 'Классификация и типы химических реакций. Теория и практика для ОГЭ.' },
  { slug: '/substances/', title: 'Классификация веществ', description: 'Неорганические вещества: оксиды, кислоты, основания, соли. Классификация и номенклатура.' },
  { slug: '/ions/', title: 'Ионы', description: 'Справочник ионов: таблица растворимости, катионы и анионы, качественные реакции.' },
  { slug: '/diagnostics/', title: 'Диагностика знаний', description: 'Адаптивная диагностика: определите пробелы в знаниях по химии и получите персональный план.' },
  { slug: '/exam/', title: 'Подготовка к ОГЭ', description: 'Задания ОГЭ по химии с пошаговыми решениями и объяснениями.' },
  { slug: '/competencies/', title: 'Компетенции', description: 'Все учебные модули платформы: 20 компетенций по химии с теорией и практикой.' },
  { slug: '/profile/', title: 'Профиль', description: 'Ваш прогресс по всем компетенциям. Байесовское отслеживание знаний (BKT).' },
  { slug: '/en/periodic-table/', title: 'Periodic Table', description: 'Interactive periodic table: electron configurations, orbital diagrams, energy levels.' },
  { slug: '/en/bonds/', title: 'Chemical Bonds', description: 'Determine bond types and crystal lattices. Step-by-step calculator and theory.' },
  { slug: '/en/oxidation-states/', title: 'Oxidation States', description: 'Determine oxidation states step by step. Rules and practice.' },
  { slug: '/en/calculations/', title: 'Chemical Calculations', description: 'Molar mass, stoichiometry, mass fraction, reaction yield.' },
  { slug: '/en/diagnostics/', title: 'Chemistry Diagnostics', description: 'Adaptive knowledge diagnostics: find your gaps and get a personalized study plan.' },
  { slug: '/en/exam/', title: 'Exam Practice', description: 'Chemistry exam practice with step-by-step solutions.' },
  { slug: '/about/', title: 'О проекте', description: 'О платформе «Химия без магии» — адаптивное обучение химии без зубрёжки.' },
  { slug: '/search/', title: 'Поиск', description: 'Поиск по всему справочнику химии: элементы, вещества, ионы, реакции, компетенции.' },
];

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const buildDate = new Date().toUTCString();

export const GET: APIRoute = () => {
  const items = PAGES.map(p => `
    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${SITE}${p.slug}</link>
      <description>${escapeXml(p.description)}</description>
      <guid isPermaLink="true">${SITE}${p.slug}</guid>
      <pubDate>${buildDate}</pubDate>
    </item>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${SITE}/</link>
    <description>${escapeXml(DESCRIPTION)}</description>
    <language>ru</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
