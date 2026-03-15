# ADR-004: Domain-Scoped MVP Instead of General Framework

- **Status:** Proposed
- **Decision type:** Delivery / Scope control

## Context

Было отмечено, что проект может быть:

- относительно реалистичным как chemistry-specific verbalizer;
- чрезвычайно сложным как общий semantic-to-text framework.

Основной риск — преждевременно строить слишком общую систему.

## Decision

Ограничить MVP рамками **school chemistry domain verbalization** с упором на:

- компактный AST;
- ограниченный набор concept kinds;
- фиксированный inventory construction families;
- deterministic rendering;
- ограниченный набор pedagogical intentions;
- RU-first implementation.

## Included in MVP

- реакции и взаимодействия;
- свойства и признаки;
- условия и результаты;
- общие правила и исключения;
- короткие theory statements и hints;
- базовая intention-aware verbalization.

## Excluded from MVP

- общий discourse planner для абзацев;
- свободная paraphrase generation;
- общедоменный framework для любых предметных областей;
- глубокая многоязычность с равной полнотой с первого дня;
- полная grammar coverage для open-ended text.

## Consequences

### Positive

- сильное снижение проектного риска;
- возможность быстро получить working vertical slice;
- проще тестировать;
- проще обсуждать с предметными экспертами.

### Negative / Cost

- часть архитектуры изначально будет domain-shaped;
- возможна последующая переработка при generalized expansion.

## Recommendation

Считать расширение до general framework отдельной будущей инициативой, а не implicit goal текущего проекта.
