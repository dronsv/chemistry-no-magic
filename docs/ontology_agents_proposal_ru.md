# Предложение по набору агентов для онтологизации
## Chemistry Ontology Agent Set — working draft

**Назначение:** зафиксировать рекомендуемый набор специализированных агентов для работы с химической онтологией, enrichment существующего контента, ingestion новых материалов и контроля качества.

---

## 1. Зачем разделять агентов

Один монолитный агент для онтологии быстро начинает смешивать слишком много ролей:

- extraction из экзаменов и текстов;
- ontology architecture;
- enrichment существующих сущностей;
- localization;
- audit / consistency review;
- write operations и pipeline integration.

Это приводит к трём проблемам:

1. **core pollution** — агент слишком легко создаёт новые core entities;
2. **prompt bloat** — один prompt пытается управлять слишком разными режимами;
3. **нечёткие stop-rules** — непонятно, где агент должен предложить решение, а где уже имеет право писать в данные.

Поэтому рекомендуется набор из нескольких узкоспециализированных агентов.

---

## 2. Рекомендуемый минимальный набор

### Обязательные агенты
1. `ontology-architect`
2. `ontology-enrichment`
3. `ontology-localizer`
4. `ontology-auditor`

### Очень полезный дополнительный агент
5. `ontology-extractor`

### Опциональный агент
6. `ontology-write-operator`

---

## 3. Краткая карта ролей

| Агент | Главная роль | Может менять core? | Пишет overlays? | Делает аудит? | Типичный риск |
|---|---|---:|---:|---:|---|
| `ontology-architect` | решает, что и как моделировать | ограниченно, через proposal | нет | частично | structural overreach |
| `ontology-extractor` | извлекает сущности и знания из входного текста | нет | нет | нет | noisy candidate lists |
| `ontology-enrichment` | обогащает уже понятную модель | ограниченно, low/medium risk | да | частично | over-enrichment |
| `ontology-localizer` | делает locale overlays | нет | да | нет | terminology drift |
| `ontology-auditor` | ищет ошибки, дубли, несогласованности | нет | нет | да | false positives in audit |
| `ontology-write-operator` | исполняет утверждённый write plan | нет, только по утверждённому плану | да, если включено в план | нет | mechanical mistakes |

---

## 4. Подробное описание агентов

---

## 4.1. `ontology-architect`

### Миссия
Самый консервативный агент. Его задача — решать:

- что является новой сущностью;
- какого она типа;
- нужно ли добавлять её в core;
- relation vs concept vs quantity vs law vs characteristic vs overlay;
- как встроить это в существующую taxonomy.

### Основные обязанности
- admission analysis;
- entity classification;
- structural proposals;
- schema decisions;
- review risky additions;
- определение, в какой файл и в каком формате должно лечь новое знание.

### Что агент должен уметь различать
- `concept:*`
- `quantity:*`
- `const:*`
- `law:*`
- `math:*`
- `test_method:*`
- `char:*`
- `trend:*`
- `pattern:*`
- `overlay-only text`

### Что агент не должен делать
- массовую локализацию;
- bulk extraction из экзаменов;
- длинные didactic descriptions;
- автоматическое массовое создание сущностей без review;
- прямые архитектурные записи “на автопилоте”.

### Когда его вызывать
- появляется новая тема;
- непонятно, новая ли это core entity;
- нужен новый тип relation / quantity / law / test_method;
- нужно расширить taxonomy;
- есть спор между `entity vs relation vs overlay`.

### Типичный выход
- proposal package;
- entity classification report;
- список recommended refs;
- risk assessment;
- recommended storage targets.

---

## 4.2. `ontology-extractor`

### Миссия
Агент извлечения знаний из входных материалов:

- экзаменов;
- задачников;
- учебных текстов;
- конспектов;
- PDF/HTML материалов.

### Основные обязанности
- выделение сущностей;
- выделение quantities, laws, processes, characteristics;
- mapping на существующие refs;
- candidate relation extraction;
- unresolved candidate generation;
- source metadata extraction.

### Что агент делает хорошо
- находит упоминания веществ, ионов, реакций, понятий;
- собирает candidate list для архитектора;
- готовит structured extraction output.

### Что агент не должен делать
- самостоятельно принимать structural ontology decisions;
- создавать новые core entities без handoff в `ontology-architect`;
- массово писать локализации;
- принимать semantic admission decisions.

### Когда его вызывать
- приходит новый exam paper;
- импортируется новый дидактический блок;
- нужно проанализировать существующую страницу;
- запускается bootstrap-pass по текущему контенту.

### Типичный выход
- `extraction_result.json`
- список matched refs
- список unresolved mentions
- candidate proposals
- source references

---

## 4.3. `ontology-enrichment`

### Миссия
Агент безопасного обогащения существующей онтологии и существующего контента.

### Основные обязанности
- enrichment existing entities;
- добавление typed characteristics;
- добавление relations;
- selective richtext linking;
- annotation existing pages;
- low/medium-risk writes;
- подготовка cross-ontologized descriptions.

### Что агент должен делать
- опираться на уже согласованную модель;
- сначала использовать existing refs;
- предпочитать extension / relation / overlay созданию новой сущности;
- добавлять conditions для state-dependent characteristics.

### Что агент не должен делать
- создавать новые taxonomy branches без handoff;
- придумывать новые entity families;
- менять общие ontology conventions;
- решать архитектурные вопросы вместо `ontology-architect`.

### Когда его вызывать
- сущности уже понятны;
- нужно enrich существующие страницы;
- нужно добавить связи и характеристики;
- нужно доразметить контент RichText refs;
- нужно сделать bootstrap re-annotation после расширения core.

### Типичный выход
- patch plan;
- список затронутых файлов;
- structured annotation output;
- enriched relations/characteristics;
- warnings about missing core support.

---

## 4.4. `ontology-localizer`

### Миссия
Агент, работающий только с языковыми overlays.

### Основные обязанности
- `name`
- `slug`
- `aliases`
- `surface_forms`
- localized short descriptions
- terminology normalization per locale

### Ключевые принципы
- core locale-free;
- русский — не базовый язык, а один из locale overlays;
- chemical nomenclature должна быть корректной для каждой локали;
- morphology-aware forms добавляются только там, где они реально полезны.

### Что агент не должен делать
- создавать новые core entities;
- менять taxonomy;
- решать admission questions;
- подменять ontology design переводом.

### Когда его вызывать
- после появления новых approved refs;
- при массовом добавлении новых locale packs;
- при улучшении multilingual reverse search;
- при исправлении терминологии.

### Типичный выход
- locale overlay patches;
- terminology notes;
- missing-translation report;
- morphology/surface-forms additions.

---

## 4.5. `ontology-auditor`

### Миссия
Агент проверки качества онтологии и обогащённого контента.

### Основные обязанности
- dangling refs detection;
- duplicate detection;
- overlinking detection;
- inconsistent kind detection;
- overlay completeness checks;
- conditionless characteristic detection;
- heuristic-as-law detection;
- phase/lattice confusion detection;
- report generation.

### Что агент должен проверять
- referential integrity;
- ontology hygiene;
- locale completeness;
- schema consistency;
- reasonable use of typed characteristics;
- отсутствие flat anti-pattern fields;
- отсутствие unnecessary core additions.

### Что агент не должен делать
- самовольно переписывать большие части core;
- автоматически создавать новые сущности вместо finding/reporting;
- принимать structural решения без handoff.

### Когда его вызывать
- после bulk enrichment;
- после exam import;
- после добавления новой domain package;
- перед merge;
- после ontology refactor.

### Типичный выход
- audit report;
- coverage report;
- duplicate report;
- risk report;
- recommended fixes.

---

## 4.6. `ontology-write-operator` (опционально)

### Миссия
Технический агент-исполнитель. Он не моделирует предметную область, а исполняет уже утверждённый write plan.

### Основные обязанности
- писать approved changes в нужные файлы;
- вызывать валидаторы;
- rebuild index;
- возвращать structured write result;
- собирать error/warning report.

### Когда полезен
- если нужно строго отделить reasoning и execution;
- если write tools мощные и есть риск опасных автоправок;
- если хочется заставить другие агенты работать через proposal+execution pattern.

### Что агент не должен делать
- самостоятельно принимать semantic решения;
- придумывать новые сущности;
- менять план “по дороге”.

---

## 5. Handoff rules

### 5.1. `extractor -> architect`
Если extractor нашёл:
- unresolved mention;
- потенциально новую сущность;
- новую relation pattern;
- новую law/quantity/test-method candidate;

он передаёт это архитектору.

### 5.2. `architect -> enrichment`
Если архитектор уже решил:
- какие refs использовать;
- что добавляется в core;
- что должно стать relation / characteristic / overlay;

дальше enrichment agent реализует safe enrichment.

### 5.3. `architect -> localizer`
Когда approved refs уже существуют, localizer заполняет locale overlays.

### 5.4. `enrichment -> auditor`
После enrichment нужно запускать аудит:
- dangling refs;
- overlinking;
- invalid conditions;
- schema drift.

### 5.5. `architect/enrichment -> write-operator`
Если используется write-operator, он получает уже утверждённый patch plan и исполняет его.

---

## 6. Risk tiers

### Low-risk
Можно выполнять напрямую:
- translations;
- aliases;
- missing localized names;
- search overlays;
- mechanical ref fixes;
- non-semantic consistency corrections.

### Medium-risk
Нужен proposal + rationale, затем write:
- new concept;
- new quantity;
- new law;
- new characteristic kind;
- new relation predicate;
- new test_method.

### High-risk
Только proposal + review:
- new entity family;
- new storage pattern;
- new data file;
- ontology convention changes;
- solver-affecting semantic changes;
- large taxonomy refactors.

### Кто работает с какими рисками
| Агент | Low | Medium | High |
|---|---:|---:|---:|
| `ontology-architect` | yes | yes | yes, but proposal-only |
| `ontology-extractor` | no | no | no |
| `ontology-enrichment` | yes | limited | no |
| `ontology-localizer` | yes | no | no |
| `ontology-auditor` | report only | report only | report only |
| `ontology-write-operator` | yes, if approved | yes, if approved | yes, only as executor of approved plan |

---

## 7. Recommended execution modes

### Сценарий A — новый экзамен
1. `ontology-extractor`
2. `ontology-architect`
3. `ontology-enrichment`
4. `ontology-localizer`
5. `ontology-auditor`

### Сценарий B — новая тема (например, thermodynamics)
1. `ontology-architect`
2. `ontology-enrichment`
3. `ontology-localizer`
4. `ontology-auditor`

### Сценарий C — улучшение существующей страницы
1. `ontology-extractor` или bootstrap scan
2. `ontology-architect` для gaps
3. `ontology-enrichment`
4. `ontology-auditor`

### Сценарий D — только локализация
1. `ontology-localizer`
2. `ontology-auditor`

### Сценарий E — только quality review
1. `ontology-auditor`

---

## 8. Что особенно важно закрепить в промптах

### Для `ontology-architect`
- explicit entity taxonomy;
- admission gate;
- heuristic vs law distinction;
- phase vs lattice distinction;
- concept vs quantity vs law vs char vs test_method distinction.

### Для `ontology-enrichment`
- use existing refs first;
- do not create new core entity if relation/overlay/extension is enough;
- do not overlink descriptions;
- state-dependent characteristics must include conditions.

### Для `ontology-localizer`
- locale-free core;
- locale-specific correct terminology;
- no structural decisions;
- no silent semantic reinterpretation.

### Для `ontology-auditor`
- duplicate detection;
- anti-pattern detection;
- missing conditions;
- heuristic encoded as universal law;
- phase/lattice confusion;
- over-enrichment.

---

## 9. Minimal recommended rollout

### Phase 1
Запустить 4 основных агента:
- `ontology-architect`
- `ontology-enrichment`
- `ontology-localizer`
- `ontology-auditor`

### Phase 2
Добавить:
- `ontology-extractor`

### Phase 3
При необходимости:
- `ontology-write-operator`

---

## 10. Рекомендуемая naming схема

```text
ontology-architect
ontology-extractor
ontology-enrichment
ontology-localizer
ontology-auditor
ontology-write-operator
```

Если захочется короче:

```text
ont-architect
ont-extractor
ont-enrichment
ont-localizer
ont-auditor
ont-write-operator
```

Но полные имена обычно понятнее.

---

## 11. Итоговая рекомендация

Для проекта химической онтологии не стоит полагаться на одного универсального агента.

Наиболее устойчивый набор:

- `ontology-architect`
- `ontology-enrichment`
- `ontology-localizer`
- `ontology-auditor`

И очень желательно добавить:

- `ontology-extractor`

Это даст:

- лучшую дисциплину core;
- более короткие и точные prompts;
- меньше core pollution;
- более понятный handoff;
- более предсказуемый workflow.

---

## 12. Следующие артефакты

После утверждения списка агентов стоит подготовить отдельные prompt/spec файлы:

1. `agents/ontology-architect.md`
2. `agents/ontology-extractor.md`
3. `agents/ontology-enrichment.md`
4. `agents/ontology-localizer.md`
5. `agents/ontology-auditor.md`
6. `agents/ontology-write-operator.md`

И один координирующий документ:

7. `docs/ontology-agent-orchestration.md`
