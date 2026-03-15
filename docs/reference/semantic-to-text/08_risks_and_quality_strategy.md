# Risks and Quality Strategy

## Key risks

### 1. Overengineering risk

Опасность: построение слишком общего framework раньше времени.

**Mitigation:** domain-scoped MVP, strict operator inventory, ADR-based scope control.

### 2. Semantic / surface leakage

Опасность: смешение semantic layer с grammatical details.

**Mitigation:** explicit layer boundaries, schema review, lint rules.

### 3. Construction explosion

Опасность: быстрое разрастание набора ad hoc constructions.

**Mitigation:** registry of construction families, naming conventions, reuse-first policy.

### 4. Locale inconsistency

Опасность: одно и то же semantic content рендерится по-разному или некорректно в разных языках.

**Mitigation:** locale-by-locale golden sets, shared semantic tests, separate realization tests.

### 5. Intention drift

Опасность: intent начинает менять смысл факта.

**Mitigation:** explicit rule: intent affects framing, not truth conditions.

### 6. Hidden QA debt

Опасность: визуально хороший текст скрывает semantic or pedagogical errors.

**Mitigation:** corpus of reviewed examples, expert review, regression harness.

## Quality strategy

### A. Golden corpus

Нужен набор эталонных examples для:

- basic facts;
- exceptions;
- properties;
- conditions;
- comparative statements;
- misconception corrections.

### B. Layered testing

1. AST validation tests
2. Lexical lookup tests
3. Construction selection tests
4. Surface realization tests
5. End-to-end approved output tests

### C. Review workflow

Для новых operators, constructions и intents желательно требовать:

- краткое обоснование;
- example set;
- failure modes;
- review of cross-locale implications.

## Exit criteria for MVP

MVP можно считать состоятельным, если:

- semantic core стабилен;
- RU verbalization покрывает пилотный chemistry subset;
- intent layer даёт наблюдаемую педагогическую пользу;
- regressions контролируются автоматически;
- интеграция с реальным контентом не требует массовых ручных исключений.
