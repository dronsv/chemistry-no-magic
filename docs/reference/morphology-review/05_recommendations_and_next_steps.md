# Рекомендации и следующие шаги

## 1. Главная рекомендация

Не развивать тему как «расширение morphology tables». Развивать её как **semantic-to-text направление**, в котором morphology — лишь один из нижних слоёв.

## 2. Что лучше зафиксировать отдельно

Рекомендуется выделить отдельные спецификации / ADR по следующим темам.

## 2.1. Semantic Expression Layer

Нужно зафиксировать:

- минимальный набор операторов;
- типы аргументов;
- допустимую вложенность;
- distinction между semantic content и derived presentation.

Итогом должен быть компактный и контролируемый AST, а не произвольный mini-language.

## 2.2. Intention Layer

Нужно отдельно зафиксировать:

- speech acts;
- pedagogical roles;
- focus dimensions;
- information status;
- discourse relations;
- правила влияния intention на construction choice.

Особенно важно не дать intention менять semantic truth.

## 2.3. Lexicalization Layer

Нужно описать:

- entity → lexical entry binding;
- fields типа lemma, pos, gender, countability;
- display label vs lexical head;
- irregular forms;
- locale-specific extensions.

## 2.4. Construction Families

Нужно ввести ограниченный список construction families, а не свободную sentence generation.

Для chemistry domain этого, вероятно, достаточно.

## 3. Что делать в первую очередь

### Шаг 1
Сформулировать минимальный inventory semantic operators.

### Шаг 2
Выделить минимальный inventory intention categories.

### Шаг 3
Определить несколько construction families, покрывающих основные учебные утверждения.

### Шаг 4
Сделать пилотный deterministic renderer для узкого поддомена.

### Шаг 5
Только после этого решать, нужен ли более сложный discourse layer и где оправдан LLM-assisted paraphrase.

## 4. Что не стоит делать на раннем этапе

### 4.1. Не делать универсальный framework

Ранний слой должен быть chemistry-specific.

### 4.2. Не превращать онтологию в grammar database

Core ontology должна оставаться language-neutral насколько это возможно.

### 4.3. Не делать LLM главным source of rendering

LLM может быть полезен как дополнительный paraphrase layer или как authoring aid, но не как единственный semantic interpreter.

### 4.4. Не пытаться сразу покрыть все случаи

Полезнее получить компактный, тестируемый и устойчивый MVP, чем огромную, но нестабильную систему.

## 5. Предлагаемый порядок внедрения

## Этап A. Архитектурная фиксация

- определить semantic AST;
- определить intention schema;
- определить lexical entry schema;
- определить construction families.

## Этап B. Пилотный рендеринг

- взять 1 узкий chemistry domain;
- собрать для него несколько semantic patterns;
- реализовать deterministic RU renderer;
- подключить regression corpus.

## Этап C. Интеграция с текущим контентом

- начать использовать semantic blocks в theory / hints / tasks;
- постепенно заменить ручные surface templates там, где это даёт выигрыш.

## Этап D. Multilingual extension

- перенос lexical layer на EN/PL/ES;
- отдельные language-specific realization rules;
- выравнивание construction families между локалями.

## 6. Минимальный набор будущих документов

По итогам обсуждения особенно полезными выглядят следующие будущие спецификации:

1. **Semantic Expression Layer Spec**
2. **Intention Layer Spec**
3. **Lexicalization / Morphology Schema Spec**
4. **Construction Families Catalog**
5. **Renderer Contract Spec**
6. **QA / Regression Corpus Spec**

## 7. Финальная рекомендация

Рассматривать это направление как отдельную архитектурную инициативу внутри проекта.

Рабочее понимание может быть таким:

> не «добавить морфологию»,
> а «ввести controlled semantic-to-text layer поверх chemistry ontology».

Это делает обсуждение и implementation plan существенно более ясными.
