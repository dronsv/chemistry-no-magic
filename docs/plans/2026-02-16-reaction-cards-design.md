# Дизайн: Карточки реакций с ионными уравнениями (Этап 4)

Дата: 2026-02-16

## Цель

Дать ученику ответ на вопрос "почему реакция идёт" через ионные уравнения, движущие силы и наблюдения. Покрытие ОГЭ заданий 10-14, 20-22.

## Решения

- **Два слоя данных**: `reaction_templates.json` (схемы типов, без изменений) + новый `reactions.json` (конкретные реакции с полными данными)
- **ReactionCards заменяет ReactionCatalog** на странице `/reactions/`
- **3 новых типа упражнений**: ионные уравнения, ионы-наблюдатели, наблюдения
- **V2 (энергии связей) и V3 (резонанс) — отложены**: для ОГЭ избыточно, риск некорректных объяснений

## Данные

### Источник

`data-src/reactions_bundle.v1.json` → преобразуется в `data-src/reactions/reactions.json` (массив из 22 реакций).

### Исправления в данных

1. **skills → competencies**: маппинг на существующие ID
   - `K_EXCHANGE_TYPES`, `K_IONIC_EQUATIONS`, `K_ACID_BASE` → `reactions_exchange`
   - `K_SOLUBILITY_RULES`, `K_DRIVING_FORCES_GAS_PRECIP` → `gas_precipitate_logic`
   - `K_REACTION_RATE` → `reaction_energy_profile`
   - `K_AMPHOTERIC` → `amphoterism_logic`
   - `K_ACIDIC_OXIDES` → `classification`
   - `K_LAB_SAFETY` → убрать (нет компетенции)

2. **heat_effect: "mixed" → точные значения**: `"exo"`, `"endo"`, `"negligible"`, `"unknown"`

3. **Дозаполнить ionic.full** для ~10 реакций где есть только net

4. **Убрать поля V2**: `bond_energy_view`, `energy_profile` — не используются

5. **Добавить template_id** — ссылка на шаблон из reaction_templates.json (необязательное поле)

### Тип Reaction (src/types/reaction.ts)

```typescript
export interface ReactionMolecularItem {
  formula: string;
  name?: string;
  coeff: number;
}

export interface Reaction {
  reaction_id: string;
  title: string;
  equation: string;
  template_id?: string;
  phase: { medium: 'aq' | 's' | 'l' | 'g' | 'mixed'; notes?: string };
  conditions?: { temperature?: string; catalyst?: string; pressure?: string; excess?: string };
  type_tags: string[];
  driving_forces: string[];
  molecular: {
    reactants: ReactionMolecularItem[];
    products: ReactionMolecularItem[];
  };
  ionic: { full?: string; net?: string; notes?: string };
  observations: {
    gas?: string[];
    precipitate?: string[];
    heat?: string;
    color_change?: string;
    smell?: string;
    other?: string[];
  };
  rate_tips: {
    how_to_speed_up: string[];
    what_slows_down?: string[];
  };
  heat_effect: 'exo' | 'endo' | 'negligible' | 'unknown';
  safety_notes?: string[];
  competencies: Record<string, 'P' | 'S'>;
  oge?: { topics?: string[]; typical_tasks?: string[] };
}
```

### Интеграция в pipeline

- `scripts/build-data.mjs`: копирует `data-src/reactions/reactions.json` → бандл
- `scripts/lib/generate-manifest.mjs`: добавляет `reactions` в манифест
- `src/types/manifest.ts`: добавляет `reactions` поле
- `src/lib/data-loader.ts`: новая функция `loadReactions()`

## UI: Карточки реакций

### Компонент ReactionCards

Заменяет `ReactionCatalog`. Размещается в `src/features/reactions/ReactionCards.tsx`.

**Фильтры вверху:**
- По type_tags: Все | Нейтрализация | Осадок | Газ | Амфотерность | Оксиды
- Поиск по формуле/названию (опционально, если время позволит)

**Каждая карточка — раскрывающаяся, с 4 вкладками:**

| Вкладка | Содержимое |
|---------|-----------|
| Молекулярное | equation, molecular (реагенты/продукты с названиями и коэффициентами), phase, conditions |
| Ионное | ionic.full с подсветкой ионов-наблюдателей → ionic.net. ionic.notes |
| Почему идёт | driving_forces (иконки ↓/↑/H₂O), observations, heat_effect |
| Как ускорить | rate_tips.how_to_speed_up, what_slows_down, safety_notes |

**Стиль:** CSS модуль `reaction-cards.css`. Бейджи driving forces с иконками. Вкладки как кнопки-табы внутри карточки.

### Изменения в ReactionsPage

```
ReactionsPage
├── ReactionCards (новый, заменяет ReactionCatalog)
├── ReactionTheoryPanel (без изменений)
└── PracticeSection (расширяется новыми типами упражнений)
```

## Упражнения

### 1. match_ionic_equation

- **Вопрос**: "Сокращённое ионное уравнение для: {equation}?"
- **Правильный ответ**: reaction.ionic.net
- **Дистракторы**: ionic.net от 2-3 других реакций из reactions.json
- **Компетенция**: `reactions_exchange: 'P'`

### 2. identify_spectator_ions

- **Вопрос**: "Ионы-наблюдатели в реакции: {equation}?"
- **Правильный ответ**: вычисляется из ionic.full — ионы, которые есть и слева, и справа
- **Дистракторы**: другие комбинации ионов из того же уравнения
- **Компетенция**: `reactions_exchange: 'P'`, `electrolyte_logic: 'S'`

### 3. predict_observation

- **Вопрос**: "Что наблюдается при смешивании {reactant1} и {reactant2}?"
- **Правильный ответ**: краткое описание из observations (осадок/газ/цвет/запах)
- **Дистракторы**: наблюдения от других реакций + "Ничего не происходит"
- **Компетенция**: `gas_precipitate_logic: 'P'`, `qualitative_analysis_logic: 'S'`

### Интеграция

Новые генераторы добавляются в `generate-exercises.ts`. Сигнатура `GeneratorFn` расширяется параметром `reactions: Reaction[]`. `PracticeSection` загружает `loadReactions()` и передаёт в `generateExercise()`.

## Что НЕ входит

- Энергии связей / bond_energy_view (V2, Этап 5)
- Резонансные структуры / орбитали (V3, далёкое будущее)
- SVG-диаграмма энергетического профиля (Этап 5)
- Числовые значения ΔH (не в ОГЭ)
- Отдельные страницы для каждой реакции (можно добавить позже)
