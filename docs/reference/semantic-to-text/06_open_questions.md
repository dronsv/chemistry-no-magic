# Open Questions

## 1. Scope of semantic operators

Какой минимальный набор операторов нужен для MVP?

Пример возможного ядра:

- `has_property`
- `reacts_with`
- `forms`
- `decomposes_to`
- `under_condition`
- `causes`
- `not`
- `exists`
- `example_of`

Нужно определить, что входит в обязательный core, а что остаётся domain extension.

## 2. Shape of AST

AST должен быть:

- S-expression-like;
- JSON-tree;
- typed TS representation;
- или комбинацией canonical JSON + typed runtime model?

## 3. Relation to existing ontology artifacts

Как новая модель будет ссылаться на существующие:

- concept IDs;
- reaction/process entities;
- substance classes/groups;
- overlays/localized lexical data?

## 4. Lexical storage model

Где хранить lexicalization data:

- в locale overlays;
- в dedicated lexical dictionaries;
- частично в ontology entries, частично в language packs?

## 5. Intention inventory

Какой минимальный набор intention enums нужен на старте, чтобы не скатиться в overmodeling?

## 6. Construction governance

Кто и как добавляет новые construction families?

Нужны ли:

- registry;
- versioning;
- lint rules;
- coverage reports?

## 7. LLM role

Будет ли LLM использоваться:

- только для authoring assistance;
- для controlled paraphrase over deterministic plan;
- или как полноценный renderer?

На обсуждении более безопасным выглядел hybrid approach, но решение не зафиксировано окончательно.

## 8. Multilingual rollout strategy

Что идёт после RU-first:

- EN second;
- PL/ES later;
- одинаковый semantic core, но locale-specific realization?

## 9. QA strategy

Как именно тестировать:

- correctness of semantics;
- correctness of realization;
- pedagogical appropriateness;
- regression between locales?
