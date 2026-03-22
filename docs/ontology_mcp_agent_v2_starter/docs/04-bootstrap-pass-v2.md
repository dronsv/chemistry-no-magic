# Bootstrap Pass v2

## Goal

Ontologize the existing course pages and explanations before introducing large-scale new authoring.

## Why this comes first

- existing text reveals missing aliases and overlays;
- it tests ontology coverage against real material;
- it produces the first review queue;
- it prevents the authoring agent from working in an empty vacuum.

## Inputs

- current didactic pages
- definitions
- reaction explanations
- exercises and hints
- preview snippets
- glossary texts

## Outputs per document

- `annotation-result.json`
- `unresolved-mentions.json`
- `proposal-drafts.json`
- `coverage-report.json`

## Recommended pass order

1. glossary/definitions
2. concept explanation pages
3. substance pages
4. reaction explanation pages
5. tasks/exercises
6. hints/feedback snippets

## Review strategy

### Automatic acceptance candidates

- obvious existing refs
- strong alias matches
- formula/symbol exact matches

### Human review required

- ambiguous school terminology
- mentions crossing concept/substance boundaries
- possible new core concepts
- didactic decompositions of composite ideas

## Coverage metrics

Track at least:

- mention count
- resolved count
- ambiguous count
- unresolved count
- alias suggestion count
- overlay suggestion count
- proposal count
- top missing concept clusters

## Success criteria for MVP

- 80%+ of high-frequency mentions resolved on definition pages
- stable proposal taxonomy
- no uncontrolled core-entity explosion
