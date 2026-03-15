# ADR-003: Ontology ↔ Lexicon ↔ Realization Layering

- **Status:** Proposed
- **Decision type:** Architectural

## Context

Возникла идея “чистого выражения”, которое рендерится моделью языка, имеющей доступ к:

- словарю;
- правилам языка;
- отражению объектов онтологии на словарь.

Это подводит к естественной многослойной архитектуре.

## Decision

Зафиксировать следующую целевую слоистую схему:

1. **Ontology / semantic layer**
   - сущности, классы, процессы, свойства, отношения;
   - language-independent identifiers;
   - semantic constructors / operators.

2. **Lexicalization layer**
   - mapping ontology IDs → lexical entries per locale;
   - lemma, part of speech, grammatical features, irregularities;
   - lexical selection hints.

3. **Construction / realization layer**
   - construction families;
   - argument realization rules;
   - case/preposition/word-order choices;
   - language-specific verbalization strategies.

4. **Surface text layer**
   - final string or token stream;
   - optional style-controlled variants.

## Consequences

### Positive

- чистое разделение ответственности;
- меньшая связность между онтологией и surface syntax;
- локализация становится системной, а не строковой;
- можно развивать morphology отдельно от semantic model.

### Negative / Cost

- требуется дисциплина в boundaries между слоями;
- часть информации будет распределена по нескольким местам;
- нужен чёткий контракт между content AST и realization engine.

## Constraints

- core ontology не должна хранить surface grammar details;
- lexical layer не должен подменять semantic layer;
- construction layer не должен становиться неуправляемым набором ad hoc templates.

## Recommendation

Строить вертикальные slices от одного небольшого набора semantic operators до готового RU rendering, а не проектировать все слои “вширь” заранее.
