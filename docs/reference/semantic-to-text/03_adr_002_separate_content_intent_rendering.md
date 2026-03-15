# ADR-002: Separate Content, Intent and Rendering Policy

- **Status:** Proposed
- **Decision type:** Architectural / Modeling

## Context

В обсуждении было зафиксировано, что одного semantic expression недостаточно для учебного материала. Один и тот же факт можно использовать для разных pedagogical goals:

- ввести правило;
- напомнить известное;
- подчеркнуть исключение;
- исправить типичное заблуждение;
- подготовить вопрос;
- объяснить наблюдение.

Если intent не моделировать отдельно, система будет либо слишком плоской, либо начнёт дублировать surface text под каждую риторическую функцию.

## Decision

Разделить модель verbalizable unit на три независимых слоя:

1. **Content** — предметная семантика, что утверждается.
2. **Intent** — communicative / pedagogical purpose.
3. **Rendering policy** — параметры формулировки, не меняющие смысл.

Базовый shape:

```json
{
  "content": "...semantic AST...",
  "intent": {
    "speech_act": "assert",
    "pedagogical_role": "introduce_rule",
    "focus": "relation",
    "information_status": "new",
    "emphasis": ["generality"]
  },
  "render": {
    "register": "school_neutral",
    "length": "short",
    "allow_variation": true
  }
}
```

## Consequences

### Positive

- один факт можно использовать в нескольких didactic roles;
- упрощается генерация theory vs task vs hint;
- intent перестаёт быть скрытым внутри строк;
- можно отдельно контролировать стиль и полноту формулировки.

### Negative / Cost

- появляется ещё один слой данных и правил;
- требуется inventory intent enums и mapping к construction families;
- усложняется API verbalization engine.

## Important constraint

Intent не должен менять истинностное содержание факта. Он может влиять на:

- construction choice;
- focus;
- order of information;
- explicitness;
- discourse framing.

Но не должен произвольно добавлять новые смысловые утверждения.

## Alternatives considered

### A. Intention encoded inside semantic expression

Минус: смешение content и rhetoric.

### B. No explicit intent layer

Минус: flat output, text duplication, poor pedagogical control.

## Recommendation

На первом этапе ввести небольшой intent inventory и жёстко ограничить его фиксированным набором supported behaviors.
