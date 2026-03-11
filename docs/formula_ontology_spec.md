# Semantic Reasoning Layers — Specification v2

**Дата**: 2026-03-11
**Статус**: Draft — для обсуждения
**Ревизия**: v2 — с учётом unified_semantic_formula_task_review_v2

---

## 1. Мотивация

Сейчас формулы и reasoning живут в трёх изолированных местах:

1. **Солверы** (`solvers.ts`) — захардкоженный TypeScript, чёрный ящик без объяснений
2. **Теория** (`periodic_table_theory.json`) — текст `"Z_eff = Z − σ"`, не структура
3. **Механизмы** (`mechanisms.json`) — `"direction": "positive"` задаётся вручную, не обосновано

**Проблемы:**
- Солвер знает ответ, но не может показать путь к нему
- 65 из 68 explanation templates отсутствуют
- Нет связи между величинами (`q:mass`, `q:molar_mass`) — формула `n = m/M` нигде не описана
- Тексты формул не генерируются из структуры, а написаны вручную

**Ключевой принцип** (из ревизии): не всё, что участвует в объяснении, должно быть формулой. Разные виды reasoning — это **разные семантические объекты**.

---

## 2. Пять слоёв reasoning

```
Layer 1 — ComputableFormula
  Числовые уравнения: n = m/M, M = Σ(Ar×n), ω = Ar×n/M, ...
  → вычисление + evaluation trace + объяснение шагов

Layer 2 — QualitativeRelation
  Направленные зависимости: Z_eff ↑ → r ↓, n_level ↑ → r ↑
  → reasoning о трендах без числовых вычислений

Layer 3 — TrendRule
  Базовые тренды с контекстом: «IE растёт в периоде»
  + applicability: same_period, same_group
  → утверждения о свойствах элементов

Layer 4 — ExceptionRule + Reason        ← ЧАСТИЧНО СУЩЕСТВУЕТ
  Коррекции к трендам: Be→B (IE), N→O (IE), F→Cl (EA)
  + причина: filled_s_subshell, half_filled_p_subshell, ...
  → periodic_trend_anomalies.json + reason_vocab.json

Layer 5 — SolverGraph
  Типизированный граф из узлов: lookup → formula → predicate → compare → rule
  → оркестрирует все слои для конкретной задачи
```

### Что уже есть в проекте

| Слой | Существующее | Что нужно |
|------|-------------|-----------|
| ComputableFormula | Нет (хардкод в solvers.ts) | Создать с нуля |
| QualitativeRelation | Частично в mechanisms.json (`direction`) | Отдельный тип с грounding в формулах |
| TrendRule | periodic_table_theory.json (текст) | Структурировать из текста |
| ExceptionRule + Reason | `periodic_trend_anomalies.json` + `reason_vocab.json` | Расширить связями с Layer 2 |
| SolverGraph | Нет (логика в TS-коде солверов) | Создать как runtime, данные — в Layers 1-4 |

---

## 3. Layer 1: ComputableFormula

### Назначение

Числовые уравнения, которые можно:
- **вычислить** (подставить значения → получить результат)
- **обратить** (выразить любую переменную)
- **трассировать** (каждый шаг = формула + подстановка + результат)

Текстовое представление (`n = m/M`, LaTeX, пошаговая подстановка) **генерируется** из структурного описания, а не хранится как строка.

### Схема

```json
{
  "id": "formula:amount_from_mass",
  "kind": "definition",
  "domain": "stoichiometry",
  "school_grade": [8, 9],

  "variables": [
    { "symbol": "n", "quantity": "q:amount",     "unit": "unit:mol",        "role": "result" },
    { "symbol": "m", "quantity": "q:mass",        "unit": "unit:g",          "role": "input" },
    { "symbol": "M", "quantity": "q:molar_mass",  "unit": "unit:g_per_mol",  "role": "input" }
  ],

  "expression": {
    "op": "divide",
    "operands": ["m", "M"]
  },

  "result_variable": "n",
  "invertible_for": ["m", "M"],

  "inversions": {
    "m": { "op": "multiply", "operands": ["n", "M"] },
    "M": { "op": "divide",   "operands": ["m", "n"] }
  },

  "constants_used": [],
  "prerequisite_formulas": ["formula:molar_mass_from_composition"],
  "used_by_solvers": ["solver.amount_calc"]
}
```

### Поля

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | `string` | Namespace `formula:` |
| `kind` | `"definition"` / `"law"` | definition = по определению; law = из эксперимента/теории |
| `domain` | string | `stoichiometry` / `solutions` / `thermochemistry` / `atomic_structure` / `gas_laws` |
| `school_grade` | `number[]` | Классы, в которых изучается |
| `variables` | `Variable[]` | Переменные, привязанные к `q:*` величинам |
| `expression` | `ExprNode` | Дерево выражения |
| `result_variable` | string | Переменная «по умолчанию» |
| `invertible_for` | `string[]` | Для каких переменных есть обратное выражение |
| `inversions` | `Record<string, ExprNode>` | Обратные выражения |
| `constants_used` | `string[]` | Ссылки на `const:*` |
| `prerequisite_formulas` | `string[]` | Формулы-зависимости |
| `used_by_solvers` | `string[]` | Для миграции: какие солверы используют |

### ExprNode (дерево выражения)

```json
// Бинарная операция
{ "op": "divide", "operands": ["m", "M"] }

// n-арная
{ "op": "multiply", "operands": ["n", "M"] }

// Суммирование по индексу (для M = Σ Ar×n)
{
  "op": "sum",
  "over": "i",
  "index_set": "composition_elements",
  "term": { "op": "multiply", "operands": ["Ar_i", "count_i"] }
}

// Разность сумм (закон Гесса)
{
  "op": "subtract",
  "operands": [
    { "op": "sum", "over": "products",  "term": { "op": "multiply", "operands": ["nu_j", "deltaHf_j"] } },
    { "op": "sum", "over": "reactants", "term": { "op": "multiply", "operands": ["nu_i", "deltaHf_i"] } }
  ]
}

// Литерал / константа
{ "op": "literal", "value": 100 }
{ "op": "const", "ref": "const:N_A" }
```

### Пилотный набор: 13 формул

#### Стехиометрия (8)

| ID | Формула | kind |
|----|---------|------|
| `formula:molar_mass_from_composition` | M = Σ(Ar_i × n_i) | definition |
| `formula:amount_from_mass` | n = m / M | definition |
| `formula:particle_count` | N = n × N_A | definition |
| `formula:gas_volume_stp` | V = n × V_m | law |
| `formula:mass_fraction_element` | ω = (Ar × n_atom) / M × 100% | definition |
| `formula:density` | ρ = m / V | definition |
| `formula:yield` | η = m_actual / m_theoretical × 100% | definition |
| `formula:stoichiometry_ratio` | n₁/ν₁ = n₂/ν₂ | law |

#### Растворы (2)

| ID | Формула | kind |
|----|---------|------|
| `formula:mass_fraction_solution` | w = m_solute / m_solution | definition |
| `formula:molar_concentration` | C = n / V | definition |

#### Термохимия (1)

| ID | Формула | kind |
|----|---------|------|
| `formula:hess_law` | ΔH = Σν·ΔHf(prod) − Σν·ΔHf(react) | law |

#### Атомная структура (2)

| ID | Формула | kind |
|----|---------|------|
| `formula:effective_nuclear_charge` | Z_eff = Z − σ | definition |
| `formula:photon_energy` | E = h·ν | law |

**Важно**: `F ∝ Z_eff/r²` (школьный Кулон), `IE ∝ Z_eff/r`, `r ∝ n²/Z_eff` — это **не** ComputableFormula. Это QualitativeRelation (Layer 2).

---

## 4. Layer 2: QualitativeRelation

### Назначение

Направленные зависимости между величинами без числового вычисления. Используются для reasoning о трендах: «если X растёт, то Y уменьшается».

Могут быть обоснованы (`grounded_in`) вычислимой формулой, но сами не вычисляют число.

### Схема

```json
{
  "id": "qrel:coulomb_attraction",
  "kind": "qualitative_relation",
  "domain": "atomic_structure",

  "statement": "F ∝ Z_eff / r²",

  "factors": [
    {
      "variable": "Z_eff",
      "position": "numerator",
      "effect_on_result": "direct"
    },
    {
      "variable": "r",
      "position": "denominator",
      "power": 2,
      "effect_on_result": "inverse"
    }
  ],

  "result_variable": "F",

  "grounded_in": "formula:coulomb_force",

  "predictions": [
    { "if_change": "Z_eff", "direction": "increase", "then": "F", "direction_result": "increase" },
    { "if_change": "r",     "direction": "increase", "then": "F", "direction_result": "decrease" }
  ],

  "school_grade": [8, 11]
}
```

### Поля

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | Namespace `qrel:` |
| `statement` | string | Человекочитаемая запись (для отладки; UI не использует) |
| `factors` | `Factor[]` | Переменные и их позиция (numerator/denominator/exponent) |
| `result_variable` | string | Что зависит от факторов |
| `grounded_in` | `string?` | Опционально: `formula:*`, из которой следует эта зависимость |
| `predictions` | `Prediction[]` | Автовыводимые из factors, но хранятся явно для валидации |
| `school_grade` | `number[]` | |

### Пилотный набор: 5 отношений

| ID | Отношение | grounded_in |
|----|-----------|-------------|
| `qrel:coulomb_attraction` | F ∝ Z_eff / r² | `formula:coulomb_force` |
| `qrel:ionization_energy_factors` | IE ∝ Z_eff / r | derived from `qrel:coulomb_attraction` |
| `qrel:electronegativity_factors` | EN ∝ Z_eff / r | derived from `qrel:coulomb_attraction` |
| `qrel:atomic_radius_factors` | r ∝ n² / Z_eff | — |
| `qrel:zeff_in_period` | Z_eff ≈ Z − σ_inner; в периоде σ ≈ const, Z ↑ → Z_eff ↑ | `formula:effective_nuclear_charge` |

### Связь с mechanisms.json

Механизмы, у которых есть формульное обоснование, получают ссылку:

```json
{
  "id": "temperature_increases_average_kinetic_energy",
  "kind": "mechanism",
  "direction": "positive",
  "grounded_in_relation": "qrel:kinetic_energy_temperature"
}
```

Механизмы **без** формульного обоснования (например, `exchange_stabilization`) остаются как есть.

---

## 5. Layer 3: TrendRule

### Назначение

Утверждения вида «свойство X изменяется так-то в таком-то контексте». Привязаны к QualitativeRelation, содержат applicability context.

### Схема

```json
{
  "id": "trend:ie_across_period",
  "kind": "trend_rule",
  "property": "ionization_energy",
  "direction": "increases",
  "context": "across_period",

  "applicability": {
    "scope": "main_group_elements",
    "same": "period",
    "exclude": ["lanthanide", "actinide"]
  },

  "reasoning_chain": [
    { "step": 1, "relation": "qrel:zeff_in_period",              "conclusion": "Z_eff increases" },
    { "step": 2, "relation": "qrel:atomic_radius_factors",       "conclusion": "r decreases" },
    { "step": 3, "relation": "qrel:ionization_energy_factors",   "conclusion": "IE increases" }
  ],

  "school_note": "Общий тренд; есть исключения (Be→B, N→O)",
  "exception_rule_ids": ["exc:ie_be_b", "exc:ie_n_o"]
}
```

### Поля

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | Namespace `trend:` |
| `property` | string | Какое свойство (IE, EN, radius, metallic_character, EA) |
| `direction` | `"increases"` / `"decreases"` | |
| `context` | `"across_period"` / `"down_group"` | |
| `applicability` | object | Scope + ограничения |
| `reasoning_chain` | `ReasoningStep[]` | Цепочка QualitativeRelation → вывод |
| `exception_rule_ids` | `string[]` | Ссылки на Layer 4 |

### Пилотный набор: 10 трендов

| ID | Свойство | Направление | Контекст |
|----|----------|-------------|----------|
| `trend:ie_across_period` | ionization_energy | increases | across_period |
| `trend:ie_down_group` | ionization_energy | decreases | down_group |
| `trend:en_across_period` | electronegativity | increases | across_period |
| `trend:en_down_group` | electronegativity | decreases | down_group |
| `trend:radius_across_period` | atomic_radius | decreases | across_period |
| `trend:radius_down_group` | atomic_radius | increases | down_group |
| `trend:metallic_across_period` | metallic_character | decreases | across_period |
| `trend:metallic_down_group` | metallic_character | increases | down_group |
| `trend:ea_across_period` | electron_affinity | increases | across_period |
| `trend:ea_down_group` | electron_affinity | decreases | down_group |

---

## 6. Layer 4: ExceptionRule + Reason (расширение существующего)

### Текущее состояние

Уже есть:
- `periodic_trend_anomalies.json` — 5 записей (Be→B, N→O для IE и EA; F→Cl для EA)
- `reason_vocab.json` — 3 причины с labels на 4 локалях

### Расширение: связь с reasoning

```json
{
  "id": "exc:ie_be_b",
  "property": "ionization_energy",
  "from": "Be",
  "to": "B",
  "direction": "period",

  "overrides_trend": "trend:ie_across_period",
  "reason": "filled_s_subshell",

  "reasoning": {
    "base_expectation": "IE(B) > IE(Be) по общему тренду",
    "correction": "Be имеет конфигурацию 2s² — полностью заполненный s-подуровень особенно стабилен",
    "result": "IE(Be) > IE(B)"
  }
}
```

Поле `reasoning` — структурированное, из него генерируется текст объяснения:
1. Общее ожидание (из `overrides_trend`)
2. Почему здесь иначе (из `reason` → `reason_vocab`)
3. Фактический результат

### Расширение reason_vocab

```json
[
  {
    "id": "filled_s_subshell",
    "mechanism_ref": "exchange_stabilization",
    "subshell": "s",
    "fill_state": "full",
    "labels": { "ru": "...", "en": "...", "pl": "...", "es": "..." }
  },
  {
    "id": "half_filled_p_subshell",
    "mechanism_ref": "exchange_stabilization",
    "subshell": "p",
    "fill_state": "half",
    "labels": { "ru": "...", "en": "...", "pl": "...", "es": "..." }
  },
  {
    "id": "small_atomic_radius_repulsion",
    "mechanism_ref": null,
    "factor": "electron_repulsion",
    "labels": { "ru": "...", "en": "...", "pl": "...", "es": "..." }
  }
]
```

`mechanism_ref` → ссылка на `mechanisms.json`, замыкая цикл объяснения.

---

## 7. Layer 5: SolverGraph

### Назначение

Runtime-слой, который оркестрирует Layers 1-4 для конкретной задачи. **Не** хранится в JSON — строится солвером по шаблону задачи.

### Типы узлов

| Тип | Что делает | Пример |
|-----|-----------|--------|
| `lookup` | Берёт значение из онтологии | `Z(Na) = 11`, `period(Na) = 3` |
| `formula` | Вычисляет по ComputableFormula | `M(NaCl) = 23 + 35.5 = 58.5` |
| `predicate` | Проверяет условие | `same_period(Na, Mg) = true` |
| `compare` | Сравнивает через QualitativeRelation | `Z_eff(Mg) > Z_eff(Na)` |
| `trend` | Применяет TrendRule | `IE increases across period` |
| `exception` | Проверяет ExceptionRule | `Be→B: filled_s_subshell` |

### Выход: EvalTrace

Каждый узел записывает шаг:

```typescript
interface EvalStep {
  node_type: 'lookup' | 'formula' | 'predicate' | 'compare' | 'trend' | 'exception';
  source_id: string;       // formula:amount_from_mass, trend:ie_across_period, ...
  inputs: Record<string, string | number>;
  output: string | number | boolean;
  explanation_key?: string; // для локализованного рендеринга
}

type EvalTrace = EvalStep[];
```

### Пример: количественная задача

**Задача**: найти массовую долю кислорода в H₂SO₄

```
Граф:
  [lookup] Ar(H)=1, Ar(S)=32, Ar(O)=16, composition={H:2,S:1,O:4}
      ↓
  [formula] formula:molar_mass_from_composition
      M = 1×2 + 32×1 + 16×4 = 98
      ↓
  [formula] formula:mass_fraction_element (target=O)
      ω = (16 × 4) / 98 × 100% = 65.3%
```

**EvalTrace** → рендер:

> **RU**: «Находим молярную массу: M(H₂SO₄) = Ar(H)×2 + Ar(S)×1 + Ar(O)×4 = 1×2 + 32×1 + 16×4 = 98 г/моль. Массовая доля кислорода: ω(O) = Ar(O)×4 / M × 100% = 16×4 / 98 × 100% = 65.3%»

> **EN**: «Find the molar mass: M(H₂SO₄) = 1×2 + 32×1 + 16×4 = 98 g/mol. Mass fraction of oxygen: ω(O) = 16×4 / 98 × 100% = 65.3%»

### Пример: качественная задача

**Вопрос**: «Почему IE(Na) < IE(Mg)?»

```
Граф:
  [lookup] period(Na)=3, period(Mg)=3
      ↓
  [predicate] same_period(Na, Mg) = true
      ↓
  [trend] trend:ie_across_period → "IE increases across period"
      ↓
  [compare] Z(Mg)=12 > Z(Na)=11 → qrel:zeff_in_period → Z_eff(Mg) > Z_eff(Na)
      ↓
  [compare] qrel:atomic_radius_factors → r(Mg) < r(Na)
      ↓
  [compare] qrel:ionization_energy_factors → IE(Mg) > IE(Na)
```

**EvalTrace** → рендер:

> «Натрий и магний в одном периоде (3-й). По закону Кулона, сила притяжения электрона ∝ Z_eff/r². У магния Z_eff больше (Z=12 vs Z=11 при одинаковом экранировании), а радиус меньше. Оба фактора увеличивают энергию ионизации. Поэтому IE(Mg) > IE(Na).»

### Пример: исключение

**Вопрос**: «Почему IE(Be) > IE(B), хотя бор правее?»

```
Граф:
  [lookup] period(Be)=2, period(B)=2
      ↓
  [predicate] same_period(Be, B) = true
      ↓
  [trend] trend:ie_across_period → "ожидаем IE(B) > IE(Be)"
      ↓
  [exception] exc:ie_be_b → fires!
      reason: filled_s_subshell
      mechanism_ref: exchange_stabilization
      ↓
  result: "IE(Be) > IE(B) — исключение из тренда"
```

**EvalTrace** → рендер:

> «По общему тренду ожидается IE(B) > IE(Be). Однако бериллий имеет конфигурацию 2s² — полностью заполненный s-подуровень особенно стабилен (обменная стабилизация). Для удаления электрона из такой конфигурации нужно больше энергии. Поэтому IE(Be) = 900 кДж/моль > IE(B) = 801 кДж/моль.»

---

## 8. Константы: `data-src/foundations/constants.json`

```json
[
  {
    "id": "const:N_A",
    "symbol": "N_A",
    "value": 6.022e23,
    "unit": "unit:per_mol",
    "labels_key": "const.avogadro"
  },
  {
    "id": "const:V_m_stp",
    "symbol": "V_m",
    "value": 22.4,
    "unit": "unit:L_per_mol",
    "quantity": "q:molar_volume",
    "condition_key": "const.stp_condition",
    "labels_key": "const.molar_volume_stp"
  },
  {
    "id": "const:k_coulomb",
    "symbol": "k",
    "value": 8.988e9,
    "unit": "N·m²/C²",
    "labels_key": "const.coulomb_constant"
  },
  {
    "id": "const:h_planck",
    "symbol": "h",
    "value": 6.626e-34,
    "unit": "J·s",
    "labels_key": "const.planck"
  },
  {
    "id": "const:R",
    "symbol": "R",
    "value": 8.314,
    "unit": "J/(mol·K)",
    "labels_key": "const.gas_constant"
  }
]
```

---

## 9. Рендеринг формулы из структуры

**Вход** (expression tree):
```json
{ "op": "divide", "operands": ["m", "M"] }
```

**Выход** (по формату):

| Формат | Результат |
|--------|-----------|
| Unicode | `n = m / M` |
| LaTeX | `n = \frac{m}{M}` |
| Подстановка | `n = 5 г / 98 г/моль = 0.051 моль` |

Локализация — только в единицах и словах-связках («подставляем», «получаем»), не в самой формуле. Формулы универсальны.

---

## 10. Связь слоёв

```
quantities_units_ontology.json      ← Величины (q:mass, q:amount, ...)
constants.json [NEW]                ← Константы (N_A, V_m, k, h, R)
        │
        │ referenced by variables
        ▼
┌─────────────────────────────────────────────────────┐
│ Layer 1: ComputableFormula (formulas.json)           │
│   n = m/M, M = Σ(Ar×n), ω = Ar×n/M, ΔH = Σ−Σ, ... │
│   → evaluation + trace + explanation                 │
└────────────────────┬────────────────────────────────┘
                     │ grounded_in
                     ▼
┌─────────────────────────────────────────────────────┐
│ Layer 2: QualitativeRelation (qualitative_rels.json) │
│   F ∝ Z_eff/r², IE ∝ Z_eff/r, r ∝ n²/Z_eff        │
│   → directional predictions                         │
└────────────────────┬────────────────────────────────┘
                     │ used in reasoning_chain
                     ▼
┌─────────────────────────────────────────────────────┐
│ Layer 3: TrendRule (trend_rules.json)                │
│   «IE растёт в периоде» + applicability + chain      │
│   → утверждения о свойствах                          │
└────────────────────┬────────────────────────────────┘
                     │ overrides_trend
                     ▼
┌─────────────────────────────────────────────────────┐
│ Layer 4: ExceptionRule + Reason [EXISTING + EXTEND]  │
│   periodic_trend_anomalies.json + reason_vocab.json  │
│   Be→B, N→O, F→Cl + причины + mechanism_ref         │
└────────────────────┬────────────────────────────────┘
                     │
        ALL LAYERS   │ composed by
                     ▼
┌─────────────────────────────────────────────────────┐
│ Layer 5: SolverGraph (runtime, не JSON)              │
│   lookup → formula → predicate → compare → trend →   │
│   exception → EvalTrace → Explanation                │
└─────────────────────────────────────────────────────┘
        │ consumed by
        ▼
mechanisms.json [EXISTING]          ← grounded_in_relation: qrel:*
bridge_explanations.json [EXISTING] ← use TrendRule + ExceptionRule
```

---

## 11. Файлы и размещение

| Файл | Слой | Статус |
|------|------|--------|
| `data-src/foundations/constants.json` | Constants | NEW |
| `data-src/foundations/formulas.json` | Layer 1 | NEW (~13 записей) |
| `data-src/foundations/qualitative_relations.json` | Layer 2 | NEW (~5 записей) |
| `data-src/foundations/trend_rules.json` | Layer 3 | NEW (~10 записей) |
| `data-src/rules/periodic_trend_anomalies.json` | Layer 4 | EXTEND (+ overrides_trend, reasoning) |
| `data-src/rules/reason_vocab.json` | Layer 4 | EXTEND (+ mechanism_ref) |
| `src/types/formula.ts` | Types | NEW |
| `src/types/qualitative-relation.ts` | Types | NEW |
| `src/types/trend-rule.ts` | Types | NEW |
| `src/lib/formula-evaluator.ts` | Layer 5 runtime | NEW |
| `src/lib/trend-reasoner.ts` | Layer 5 runtime | NEW |

---

## 12. Миграция солверов

### Этап 1: Data (этот PR)
- Создать `constants.json`, `formulas.json`, `qualitative_relations.json`, `trend_rules.json`
- Расширить `periodic_trend_anomalies.json` и `reason_vocab.json`
- Типы в `src/types/`
- Валидация в build pipeline
- **Солверы не меняются** — данные готовы, код ещё нет

### Этап 2: Formula Evaluator
- `src/lib/formula-evaluator.ts` — вычисляет ExprNode, возвращает `EvalTrace`
- Юнит-тесты: каждая из 13 формул × набор значений
- Parity-тесты: результаты совпадают с текущими солверами

### Этап 3: Solver Migration (количественные)
- Солверы `molar_mass`, `mass_fraction`, `amount_calc`, `concentration`, `stoichiometry`, `heat_of_reaction` мигрируют на `evaluate(formulaId, bindings)`
- Каждый получает `explanation_trace` бесплатно
- ~6 солверов, ~12 task templates

### Этап 4: Trend Reasoner
- `src/lib/trend-reasoner.ts` — строит граф для качественных задач
- lookup → predicate → trend → exception → trace
- Используется солверами `periodic_trend_order`, `compare_property`
- ~3 солвера, ~8 task templates

### Этап 5: Explanation Renderer
- `EvalTrace[]` → локализованный текст
- Количественный: «Находим M: M(H₂SO₄) = ... = 98 г/моль»
- Качественный: «Na и Mg в одном периоде. Z_eff(Mg) > Z_eff(Na), r(Mg) < r(Na) → IE(Mg) > IE(Na)»
- Исключение: «По тренду ожидается X, но ... → поэтому Y»

---

## 13. Что это даёт

1. **65 missing explanations** → решаются: каждый солвер возвращает EvalTrace, рендерер генерирует текст
2. **Прозрачный солвер** → не чёрный ящик, а trace шагов
3. **Единый источник истины** → формула описана один раз, используется в солвере и объяснении
4. **Текст из структуры** → `n = m/M` генерируется из ExprNode, не хранится как строка
5. **Тренды с обоснованием** → «IE растёт» не потому что так написано, а потому что Z_eff ↑ и r ↓ по Кулону
6. **Исключения с причинами** → «Be→B» не просто аномалия, а filled_s_subshell → exchange_stabilization

---

## 14. Чего НЕ делает этот спек

- **Не заменяет** mechanisms.json и bridge_explanations.json — дополняет их grounding
- **Не вводит** полный symbolic algebra engine — ExprNode достаточно для школьных формул
- **Не пытается** формализовать ВСЮ школьную химию — только 13 формул, 5 отношений, 10 трендов, 5+ исключений
- **Не ломает** существующие солверы — миграция постепенная, parity-тесты

---

## 15. Open Questions

| Вопрос | Рекомендация |
|--------|-------------|
| Inversions: хранить явно или вычислять? | Явно — для 13 формул это проще и надёжнее |
| TrendRule reasoning_chain: хранить в JSON или выводить? | Хранить — цепочка reasoning специфична для школьного уровня |
| SolverGraph: runtime или тоже данные? | Runtime — граф зависит от конкретной задачи |
| Нужен ли `radius_proxy = n²/Z_eff` как ComputableFormula? | Нет — это QualitativeRelation; числовой proxy дал бы ложную точность |
| Layer 3 (TrendRule) vs existing periodic_table_theory: как соотносятся? | TrendRule — структура; periodic_table_theory — текстовая обёртка для UI; постепенно заменяется |
