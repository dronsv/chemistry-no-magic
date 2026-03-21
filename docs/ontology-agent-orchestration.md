# Ontology Agent Orchestration

## Purpose
This document defines how the ontology agents should hand work to one another.

---

## Agent set
- `ontology-architect`
- `ontology-extractor`
- `ontology-enrichment`
- `ontology-localizer`
- `ontology-auditor`
- `ontology-write-operator` (optional)

---

## Canonical flow patterns

### 1. New exam or imported educational content
1. `ontology-extractor`
2. `ontology-architect`
3. `ontology-enrichment`
4. `ontology-localizer`
5. `ontology-auditor`

### 2. New domain/theme package
1. `ontology-architect`
2. `ontology-enrichment`
3. `ontology-localizer`
4. `ontology-auditor`

### 3. Improve an existing theory page
1. `ontology-extractor` or bootstrap scan
2. `ontology-architect` for gaps
3. `ontology-enrichment`
4. `ontology-auditor`

### 4. Translation-only work
1. `ontology-localizer`
2. `ontology-auditor`

### 5. Approved execution-only write plan
1. `ontology-write-operator`
2. `ontology-auditor`

---

## Handoff rules

### extractor -> architect
Use when there are:
- unresolved mentions
- candidate new entities
- candidate laws/quantities/test methods
- ambiguity about ontology kind

### architect -> enrichment
Use when:
- structural decision is made
- approved refs are known
- safe enrichment can proceed

### architect -> localizer
Use when:
- new or updated approved refs need locale overlays

### enrichment -> auditor
Use after:
- page enrichment
- relation additions
- characteristic additions
- ref-rich description updates

### any -> write-operator
Use when:
- a clear approved write plan exists
- execution should be separated from reasoning

---

## Risk tiers

### Low-risk
- translations
- aliases
- search overlays
- ref repairs
- overlay completeness fixes

### Medium-risk
- new concept
- new quantity
- new law
- new characteristic kind
- new relation predicate
- new test method

### High-risk
- new entity family
- new storage pattern
- new data file
- taxonomy refactor
- solver-affecting semantic change

---

## MCP discipline
All agents should treat ontology MCP as the primary operational interface whenever available.

### Required MCP use
- lookup/search before proposing new refs
- validation of existing refs
- bootstrap/resolve/annotate flows
- write tools for supported writes
- coverage/audit tools when auditing or verifying changes

### Allowed fallback
Direct file editing is a fallback, not the default.

---

## Shared non-negotiable rules
1. Locale-free core.
2. Existing refs first.
3. No new core entity if relation/overlay/extension is enough.
4. Distinguish concept vs quantity vs law vs characteristic vs test_method.
5. Distinguish phase vs lattice.
6. Do not encode heuristics as universal laws.
7. Use conditioned characteristics for state-dependent behavior.
8. Avoid overlinking.

---

## Recommended rollout
### Phase 1
- architect
- enrichment
- localizer
- auditor

### Phase 2
- extractor

### Phase 3
- write-operator
