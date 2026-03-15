# Наиболее близкие существующие направления и аналоги

## 1. Общий вывод

Наиболее близким единичным архитектурным аналогом была признана линия, идущая от **abstract syntax / concrete syntax** к многоязычному рендерингу.

Если смотреть не на один инструмент, а на семейство идей, то обсуждаемая архитектура ближе всего к комбинации:

- formal grammar / abstract syntax;
- ontology ↔ lexicon binding;
- classic NLG pipeline;
- surface realization.

## 2. Что является наиболее близким по духу

## 2.1. Grammatical Framework-like подход

Наиболее близкая идея:

- существует language-neutral abstract representation;
- для каждого языка существует concrete realization;
- grammar layer строит корректную поверхность на основе структуры, а не на основе готовых строк.

Именно этот подход ближе всего к обсуждаемой модели:

```text
semantic expression → language-specific realization
```

Он особенно близок потому, что соответствует следующим требованиям:

- один смысл — много языков;
- semantic representation отделена от surface form;
- grammar rules рассматриваются как отдельный слой;
- одинаковая content model может иметь разные realized outputs.

## 2.2. Ontology ↔ Lexicon models

Следующее близкое направление — модели, где ontology entities и lexical entries явно связаны.

Для обсуждаемой архитектуры это важно, потому что проблема формулируется не как «сгенерировать текст из воздуха», а как:

- взять объект онтологии;
- найти его lexicalization в конкретном языке;
- затем встроить его в construction.

Именно эта линия наиболее полезна для слоя ontology-linked lexicon.

## 2.3. Classic NLG pipeline

В обсуждении было отмечено, что требование intention делает задачу особенно близкой к классической NLG-архитектуре:

- document planning;
- microplanning;
- surface realization.

Когда появляется вопрос «что автор хочет подчеркнуть», речь уже идёт не просто о grammar, а о **communicative planning**.

## 2.4. Ontology verbalization / controlled language

Есть отдельная линия, связанная с verbalization formal knowledge в controlled natural language.

Она близка по идее:

- формальное representation;
- систематическое отображение в человечески читаемую фразу.

Но она обычно слабее совпадает с вашим кейсом, потому что ориентирована на читаемость формальной модели как таковой, а не на pedagogical chemistry prose.

## 2.5. Surface realization engines

Отдельный близкий класс систем — surface realization engines, которые строят sentence surface из структурированного представления.

Они близки по роли, но обычно:

- не являются ontology-first;
- не задают собственный semantic core;
- слабее покрывают intention layer.

## 3. Что делает ваш кейс особенным

Хотя у идеи есть близкие аналоги, обсуждаемый вариант имеет специфическую комбинацию признаков:

- chemistry ontology-first basis;
- school / exam educational domain;
- multilingual target;
- intention-driven pedagogical rendering;
- ограниченный, но не тривиальный домен;
- потребность в controlled variability, а не в свободной генерации.

Именно сочетание этих факторов делает проект не просто copy of existing approach, а собственный domain-specific architecture problem.

## 4. Практическая интерпретация аналогий

Полезно понимать существующие наработки не как готовое решение, а как источники разных слоёв архитектуры:

### Formal grammar family
Источник идей для:

- abstract syntax;
- concrete syntax;
- typed constructors;
- language-specific realization.

### Ontology-lexicon family
Источник идей для:

- lexical bindings;
- concept-to-word mapping;
- multilingual lexical metadata.

### NLG family
Источник идей для:

- intention;
- communicative goals;
- discourse structure;
- framing.

### Surface realization family
Источник идей для:

- agreement;
- inflection;
- sentence assembly;
- morphosyntax.

## 5. Итоговая оценка близости

Если отвечать коротко и по существу:

### Наиболее близкий единичный аналог
Подход abstract syntax → concrete syntax.

### Наиболее близкая архитектурная комбинация
Formal grammar + ontology-linked lexicon + classic NLG framing + surface realization.

### Наиболее важное отличие вашего случая
У вас не только verbalization of knowledge, но и **pedagogical intention-driven domain text generation**.

То есть проект ближе не к одному инструменту, а к сборке из нескольких традиций language engineering.
