# Reference Architecture Documents

Long-term architectural reference — not immediate backlog.

## Contents

### semantic-to-text/
ADR package: semantic expression → natural language text generation.
4 ADRs + roadmap + risks. Useful as target horizon vocabulary.

### morphology-review/
Review package: reframes morphology as subcomponent of semantic-to-text pipeline.
5-layer architecture analysis, existing analogues, complexity assessment.

### review-revised/
Third-party review agreeing that architecture is correct but scope is excessive.
Recommends incremental approach via existing pipeline evolution.

## Consensus

All three packages converge on the same conclusion:
1. Principles (separation of concerns, semantic-first, intention ≠ truth) — **accept**
2. Full 5-layer framework as immediate plan — **defer**
3. Incremental improvement via `decline()` + Phase B1 + morph directives — **do now**

Active implementation plans → `docs/superpowers/plans/`
