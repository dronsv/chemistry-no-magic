# ADR-001: Canonical Semantic Expression as Source of Truth

- **Status:** Proposed
- **Decision type:** Architectural

## Context

Существуют два конкурирующих направления:

1. хранить готовые текстовые формулировки и их локализации;
2. хранить язык-независимое формальное представление факта и рендерить текст поверх него.

Для chemistry content первый путь быстро приводит к дублированию, а также плохо масштабируется на:

- разные языки;
- разные формулировки одного факта;
- разные pedagogical roles;
- генерацию theory/tasks/hints/tooltips из общего знания.

## Decision

Принять в качестве целевой архитектуры модель, где **каноническое semantic expression** является primary source of truth для verbalizable knowledge blocks.

Пример принципа:

```text
exists(reaction_between(acidic(oxide), alkali))
```

В этом выражении не должно быть language-specific surface details вроде падежей, предлогов или порядка слов, если они не являются частью самой семантики.

## Consequences

### Positive

- одна семантика может иметь несколько корректных формулировок;
- упрощается мультиязычность;
- уменьшается дублирование content strings;
- проще вводить communicative intentions поверх одного и того же факта;
- появляется единый source of truth для theory, tasks и explanations.

### Negative / Cost

- требуется разработать формальный AST / expression language;
- потребуется слой lexicalization и realization;
- повышается сложность раннего проектирования;
- необходимо отдельно описать типы операторов и аргументов.

### Constraints

- expression language должен оставаться компактным;
- нельзя превращать его в произвольный mini-language без governance;
- semantic layer не должен загрязняться деталями surface syntax.

## Alternatives considered

### A. Template-first architecture

Плюс: быстрее начать.

Минус: быстрое накопление дублирования и трудности с вариативностью.

### B. Pure LLM verbalization from loosely structured data

Плюс: высокий naturalness.

Минус: слабая тестируемость, semantic drift, плохая повторяемость.

## Recommendation

Для MVP применять semantic expression только к тем блокам, где реально требуется compositional rendering, а не пытаться одномоментно перевести весь контент проекта на новую модель.
