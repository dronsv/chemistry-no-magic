# Roadmap and Work Packages

## Phase 0. Scoping and architecture freeze

### Deliverables

- glossary of layers;
- initial operator inventory;
- draft AST contract;
- draft intent inventory;
- ADR approval.

### Outcome

Единое понимание того, что именно строится, а что не строится.

## Phase 1. RU vertical slice

### Work package 1 — Semantic core

- выбрать 10–20 базовых operators;
- описать типы аргументов;
- сделать canonical serialization.

### Work package 2 — Lexical binding

- создать RU lexical layer для пилотного подмножества ontology concepts;
- определить grammar metadata contract.

### Work package 3 — Realization engine

- реализовать 10–20 construction families;
- покрыть noun phrases, adjective modifiers, simple relations, conditions;
- сделать deterministic rendering.

### Work package 4 — Intention layer

- поддержать небольшой набор intents;
- связать intents с construction selection.

### Work package 5 — QA corpus

- golden examples;
- morphology regression tests;
- semantic equivalence checks.

## Phase 2. Content integration

- интеграция с theory blocks;
- интеграция с hint generation;
- ограниченное использование в tasks.

## Phase 3. Multilingual extension

- reusable semantic core;
- locale-specific lexical layers;
- locale-specific realization logic.

## Quick wins

1. Запустить pilot only for RU.
2. Ограничить пилот 2–3 семействами конструкций.
3. Не генерировать абзацы, а только отдельные propositions.
4. Ввести 5–8 intents вместо полной риторической модели.
5. Сделать corpus-driven regression suite как можно раньше.
