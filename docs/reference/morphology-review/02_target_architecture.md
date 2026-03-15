# Предлагаемая целевая архитектура

## 1. Цель архитектуры

Цель — перейти от хранения текстовых формулировок и локальных морфологических таблиц как primary representation к системе, в которой:

- смысл хранится отдельно от текста;
- lexicalization хранится отдельно от ontology core;
- intention управляет подачей материала;
- language-specific realization строится отдельным рендерером.

## 2. Базовые слои

## 2.1. Semantic layer

Этот слой хранит **что именно утверждается**.

Примеры выражений:

```text
reacts_with(acidic(oxide), alkali)
```

```text
exists(reaction_between(acidic(oxide), alkali))
```

```text
decomposes_under(insoluble_base, heating)
```

Здесь не должно быть:

- падежей;
- предлогов;
- порядка слов;
- language-specific agreement;
- готовых текстовых строк.

## 2.2. Ontology-linked lexical layer

Этот слой связывает ontology entities с лексическими единицами конкретного языка.

Для каждой сущности или свойства он может задавать:

- lemma;
- part of speech;
- gender / animacy / countability;
- explicit forms / irregular forms;
- lexical alternatives;
- ограничения по употреблению.

Этот слой уже language-specific, но не должен смешиваться с core ontology.

## 2.3. Intention / communicative framing layer

Этот слой отвечает за вопрос:

> зачем этот факт говорится именно здесь.

Примеры intention:

- introduce_fact;
- introduce_rule;
- highlight_pattern;
- explain_cause;
- state_exception;
- correct_misconception;
- prepare_question;
- summarize.

Дополнительно сюда могут входить:

- focus;
- information_status;
- discourse_relation;
- pedagogical_role.

## 2.4. Construction layer

Этот слой отвечает за выбор способа выражения одного и того же смысла.

Например, один и тот же content может быть выражен как:

- общее правило;
- existential statement;
- contrastive statement;
- cause/result statement;
- reminder;
- question.

Именно здесь должно решаться, что будет ближе:

- «Кислотные оксиды реагируют со щелочами»;
- «Между кислотными оксидами и щелочами возможна реакция»;
- «Для кислотных оксидов типичны реакции со щелочами».

## 2.5. Morphosyntactic realization layer

На этом уровне решаются уже language-specific задачи:

- согласование;
- падежи;
- число;
- article policy;
- порядок слов;
- выбор предлогов;
- surface inflection.

Этот слой не должен принимать решения о semantic truth — он должен только корректно реализовывать уже выбранный construction plan.

## 3. Рекомендуемое разделение ответственности

## 3.1. Что должно жить в ontology core

- сущности;
- классы;
- свойства;
- процессы;
- отношения;
- ограничения предметной области;
- typed semantic constructors.

## 3.2. Что не должно жить в ontology core

- готовые sentence-level strings;
- падежи и предлоги;
- порядок слов;
- language-specific construction choices;
- discourse policy.

## 3.3. Что должно жить в lexical layer

- lemma;
- part of speech;
- grammatical metadata;
- irregular forms;
- lexical alternatives;
- иногда canonical display labels.

## 3.4. Что должно жить в intention layer

- pedagogical role;
- rhetorical focus;
- information status;
- discourse relation;
- emphasis.

## 4. Рекомендуемая модель артефакта

Полезно мыслить не одной строкой и не одной JSON-записью, а структурой из нескольких частей:

```json
{
  "content": "...semantic AST...",
  "intent": {
    "speech_act": "assert",
    "pedagogical_role": "introduce_rule",
    "focus": "relation"
  },
  "render": {
    "register": "school_neutral",
    "length": "short",
    "allow_variation": true
  }
}
```

## 5. Что особенно важно для chemistry domain

Для химии полезно заранее выделить ограниченный набор semantic operators и construction families.

### 5.1. Типичные semantic operators

- has_property
- reacts_with
- forms
- decomposes_to
- under_condition
- causes
- not
- exists
- all
- example_of
- identified_by
- observed_as

### 5.2. Типичные construction families

- generic_statement
- existential_statement
- cause_result_statement
- exception_statement
- comparison_statement
- reminder_statement
- warning_statement
- question_prompt
- hint_statement

## 6. Архитектурный принцип

Наиболее полезный принцип, зафиксированный по итогам обсуждения:

> content отвечает за истинность,
> intention — за педагогическую задачу,
> rendering policy — за форму,
> realization layer — за грамматически корректную поверхность.

## 7. Ограничения раннего этапа

На первом этапе не рекомендуется:

- строить общий универсальный language framework;
- делать свободную генерацию абзацев;
- позволять renderer менять смысл;
- смешивать core ontology и language-specific syntax;
- завязывать систему на LLM как единственный путь verbalization.

## 8. Практический вывод

Целевая архитектура должна быть не «расширенной таблицей морфологических форм», а **многоуровневым semantic-to-text стеком**, построенным поверх ontology-first модели.
