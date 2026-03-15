# Semantic-to-Text / Morphology / Intention — ADR Package

Этот пакет оформляет результаты обсуждения в более проектном формате.

## Состав

- `01_context_and_problem_statement.md` — контекст, проблема и границы задачи
- `02_adr_001_semantic_expression_as_source_of_truth.md` — базовое решение о каноническом semantic expression
- `03_adr_002_separate_content_intent_rendering.md` — разделение content / intent / rendering
- `04_adr_003_ontology_lexicon_realization_layers.md` — слоистая архитектура ontology ↔ lexicon ↔ realization
- `05_adr_004_domain_scoped_mvp.md` — решение о domain-scoped MVP вместо общего framework
- `06_open_questions.md` — незакрытые вопросы
- `07_roadmap_and_work_packages.md` — этапы, work packages, quick wins
- `08_risks_and_quality_strategy.md` — риски, QA и regression strategy

## Назначение

Пакет предназначен для обсуждения архитектуры внутри проекта без преждевременной фиксации деталей реализации.

## Краткий вывод

Основная идея обсуждения:

1. Не хранить готовые surface-строки как primary source of truth.
2. Представлять знания в виде language-independent semantic expressions.
3. Отдельно моделировать communicative intention / pedagogical role.
4. Выполнять рендер через словарь, правила языка и construction families.
5. Начинать с chemistry-specific deterministic verbalizer, а не с общего language framework.
