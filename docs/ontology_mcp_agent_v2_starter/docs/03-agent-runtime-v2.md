# Agent Runtime v2

## Agent name

`ontology-author`

## Mission

Convert plain didactic text into ontology-bound content with minimal ontology pollution and maximal reuse of existing canonical refs.

## Non-goals

- inventing ontology refs without evidence;
- writing directly into canonical ontology;
- using localized labels as core ontology fields.

## Operating order

1. segment text into candidate mentions;
2. resolve each mention through MCP;
3. prefer existing canonical refs;
4. mark ambiguity when confidence is insufficient;
5. validate global annotation consistency;
6. generate alias/overlay/relation/entity proposals only when needed;
7. emit structured output.

## Priority order

The agent must prefer:

1. bind to existing ref
2. add alias/search phrase
3. add localization overlay
4. add relation
5. extend existing entity
6. only then propose new core entity

## Confidence guidance

- `>= 0.90`: bind automatically if no policy conflict
- `0.70 - 0.89`: bind with warning or human review depending on mode
- `< 0.70`: leave unresolved or emit ambiguity shortlist

## Modes

### `bootstrap`
Used for first-pass annotation of existing pages.
- conservative
- high recall for unresolved mentions
- no automatic core proposals without evidence

### `authoring`
Used for drafting new content.
- can suggest refs inline
- may emit overlay suggestions

### `review`
Used for validating existing annotations.
- focus on broken refs, ambiguity, policy violations

## Expected outputs

- annotation result JSON
- unresolved mentions list
- alias/overlay suggestions
- proposal drafts
- review notes
