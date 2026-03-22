# Ontology Admission Policy v2

## Core principle

A candidate must not be added to canonical ontology until it is shown to be a reusable, language-independent, non-redundant semantic unit that cannot be represented as an alias, overlay, relation, extension, or composition of existing entities.

## Addition types

- `alias_addition`
- `overlay_addition`
- `relation_addition`
- `entity_extension`
- `new_core_entity`

## Admission order

For every candidate, the system must test:

1. existing ref match
2. alias/search overlay fit
3. localization overlay fit
4. relation fit
5. existing entity extension fit
6. new core entity candidacy

## Positive criteria for `new_core_entity`

- semantic independence
- reuse across multiple materials
- stable definition possible
- graph integration possible
- structural value for solver/navigation/explanations
- language independence

## Negative criteria

Do not add to core if the candidate is only:

- a localized label
- an author phrase
- a pedagogical paraphrase
- a typo or colloquial form
- a one-off example
- an import artifact
- a synonym of an existing concept
- a composite phrase that should be decomposed

## Review requirements

### Auto-merge allowed

- alias additions
- search overlay additions
- morphology variants
- localized labels

### Human review required

- new core entities
- taxonomy changes
- new reaction types
- solver-affecting structural changes
- contentious relation additions
