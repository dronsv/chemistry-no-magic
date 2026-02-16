# MoleculeView — универсальный рендерер молекулярных структур

## Цель

Единый React SVG-компонент `<MoleculeView>` для отображения 2D Lewis-структур молекул с переключаемыми информационными слоями. Заменяет разрозненные `FormulaWithOxStates`, `BondDiagramCovalent` и другие ad-hoc SVG-диаграммы.

## Scope

- Неорганика ОГЭ (~50 молекул): кислоты, основания, соли, оксиды, простые вещества
- Базовая органика: метан, этанол, уксусная кислота
- Ионные соединения (NaCl) — как пара ионов с зарядами, без ковалентных связей

## Визуальные слои

4 слоя, каждый с toggle (вкл/выкл) и lock (блокировка переключения для упражнений):

| Слой | Ключ | Что рисует |
|------|------|-----------|
| Связи | `bonds` | Одинарные (—), двойные (=), тройные (≡) черточки между атомами |
| Степени окисления | `oxStates` | +6, −2 над атомами (красный/синий) |
| Формальные заряды | `charges` | δ+, δ− на полярных связях |
| Неподелённые пары | `lonePairs` | Точки вокруг атомов |

Атомы (символы элементов) видны всегда — это не слой, а базовый уровень.

## Данные: `data-src/structures/{id}.json`

Гибридный подход: данные генерируются скриптом (алгоритм Lewis-структур), затем проверяются и корректируются вручную. JSON хранит финальный результат.

```jsonc
{
  "id": "h2so4",
  "atoms": [
    { "id": "S1", "symbol": "S", "x": 0, "y": 0, "ox": 6, "lonePairs": 0 },
    { "id": "O1", "symbol": "O", "x": 0, "y": -1.2, "ox": -2, "lonePairs": 2 },
    { "id": "O2", "symbol": "O", "x": 0, "y": 1.2, "ox": -2, "lonePairs": 2 },
    { "id": "O3", "symbol": "O", "x": -1.2, "y": 0, "ox": -2, "lonePairs": 2 },
    { "id": "O4", "symbol": "O", "x": 1.2, "y": 0, "ox": -2, "lonePairs": 2 },
    { "id": "H1", "symbol": "H", "x": -2.0, "y": 0, "ox": 1, "lonePairs": 0 },
    { "id": "H2", "symbol": "H", "x": 2.0, "y": 0, "ox": 1, "lonePairs": 0 }
  ],
  "bonds": [
    { "from": "S1", "to": "O1", "order": 2 },
    { "from": "S1", "to": "O2", "order": 2 },
    { "from": "S1", "to": "O3", "order": 1 },
    { "from": "S1", "to": "O4", "order": 1 },
    { "from": "O3", "to": "H1", "order": 1 },
    { "from": "O4", "to": "H2", "order": 1 }
  ],
  "polarity": [
    { "from": "O3", "to": "H1", "deltaPlus": "H1", "deltaMinus": "O3" },
    { "from": "O4", "to": "H2", "deltaPlus": "H2", "deltaMinus": "O4" }
  ]
}
```

- Координаты в условных единицах (не пиксели) — компонент масштабирует
- `lonePairs` — число пар; рендерер автоматически размещает точки с учётом занятых связей
- `polarity` — опционально, для слоя charges

## Компонент: API

```tsx
<MoleculeView
  structure={data}
  layers={{ bonds: true, oxStates: true, charges: false, lonePairs: true }}
  locked={{ oxStates: true }}
  size="md"           // "inline" | "sm" | "md" | "lg"
  interactive={true}  // hover tooltip + click → element page
  onAtomClick={(symbol) => navigate(`/periodic-table/${symbol}/`)}
/>
```

## Размеры

| Mode | Высота | Панель toggle | Hover |
|------|--------|--------------|-------|
| `inline` | 1em (в строку текста) | Нет | Нет |
| `sm` | ~120px | Нет | Да |
| `md` | ~240px | Да | Да |
| `lg` | ~400px | Да, с подписями | Да |

## Внутренняя структура SVG

```
<svg viewBox="...">
  <g class="layer-bonds" opacity={layers.bonds ? 1 : 0}>
  <g class="layer-lone-pairs" opacity={layers.lonePairs ? 1 : 0}>
  <g class="layer-atoms">  <!-- всегда видны -->
  <g class="layer-ox-states" opacity={layers.oxStates ? 1 : 0}>
  <g class="layer-charges" opacity={layers.charges ? 1 : 0}>
</svg>
```

CSS transitions на opacity для плавного включения/выключения.

## Панель переключателей

Показывается при `size="md"|"lg"`. Locked слои отображаются серыми и неактивными.

```
[Связи ✓] [С.О. ✓] [Заряды ○] [Пары ✓]
```

## Hover/Click

- Hover на атоме: tooltip с ЭО, степенью окисления, electron config (данные из elements.json)
- Click на атоме: переход на `/periodic-table/{symbol}/`
- Отключается при `interactive={false}` и `size="inline"`

## Data Pipeline

```
data-src/structures/*.json → build-data.mjs → public/data/{hash}/structures/
```

- Manifest: `entrypoints.structures: "structures"` (директория)
- Loader: `loadStructure(id: string): Promise<MoleculeStructure>`

## Что заменяет

| Текущий компонент | Замена |
|-------------------|--------|
| `FormulaWithOxStates` | `<MoleculeView layers={{oxStates: true}} size="sm" />` |
| `BondDiagramCovalent` | `<MoleculeView layers={{bonds: true, charges: true}} />` |
| `BondDiagramIonic` | Остаётся отдельным (ионная связь — другая модель) |
| `BondDiagramMetallic` | Остаётся отдельным (металлическая связь — другая модель) |

## Файлы

| Файл | Действие |
|------|----------|
| `src/types/molecule.ts` | NEW — MoleculeStructure, MoleculeAtom, MoleculeBond, MoleculePolarity |
| `src/components/MoleculeView.tsx` | NEW — основной компонент |
| `src/components/molecule-view.css` | NEW — стили |
| `src/lib/data-loader.ts` | ADD — loadStructure() |
| `src/types/manifest.ts` | ADD — structures в ManifestEntrypoints |
| `scripts/build-data.mjs` | ADD — копирование structures/ |
| `scripts/lib/generate-manifest.mjs` | ADD — structures entrypoint |
| `data-src/structures/*.json` | NEW — ~50 файлов структур молекул |
