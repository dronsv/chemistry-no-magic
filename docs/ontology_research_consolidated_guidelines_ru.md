# Онтологизация химии, термодинамики и материаловедения
## Консолидированный документ по итогам обсуждений

**Статус:** working draft  
**Назначение:** проектные правила для расширения химической онтологии, authoring, MCP/agent workflow и enrichment существующего контента.  
**Язык документа:** русский.

---

## 1. Цели документа

Этот документ фиксирует согласованные решения по следующим блокам:

1. как расширять химическую онтологию без загрязнения core;
2. как различать canonical ontology, localization overlays, search overlays и didactic layer;
3. как моделировать:
   - энергию;
   - термодинамику;
   - quantities, constants, variables, laws;
   - фазы вещества и кристаллические решётки;
   - механические характеристики материалов и веществ;
4. как ссылаться на характеристики из карточек веществ и учебных текстов;
5. какие сущности и отношения стоит добавить в первую очередь.

---

## 2. Базовые архитектурные принципы

### 2.1. Canonical core отдельно от языков
В canonical ontology должны жить только устойчивые, языконезависимые сущности:

- `concept:*`
- `substance:*`
- `ion:*`
- `element:*`
- `reaction:*`
- `law:*`
- `quantity:*`
- `const:*`
- `math:*`
- `test_method:*`
- relations / typed properties / characteristics

Человеко-читаемый текст не должен жить в core как `name_ru`, `name_en`, `name_es`.

### 2.2. Localization overlays отдельно
Локализованные названия, определения и учебные формулировки должны храниться отдельно:

- `locales/{lang}/...`
- `search-overlays/{lang}/...`
- `didactic/...`

### 2.3. Search overlays отдельно от core
Для reverse lookup и authoring нужны отдельные searchable surfaces:

- labels;
- aliases;
- paraphrases;
- author phrases;
- morphology-aware forms;
- common learner wording;
- typo-friendly variants.

### 2.4. Принцип `material_language + en`
Для онтологизации и reverse search использовать не фиксированное `ru + en`, а:

- `primary = material_language`
- `fallback = en`

Все языковые варианты должны резолвиться в единый canonical ref.

---

## 3. Admission policy: как добавлять новые сущности

### 3.1. Не всякий новый термин = новая core entity
При обнаружении нового термина система должна сначала классифицировать тип добавления.

### 3.2. Типы добавления

1. `alias_addition`  
   Новая core-сущность не нужна; нужен alias/search phrase.

2. `overlay_addition`  
   Нужен новый текст в localization/search/didactic layer.

3. `relation_addition`  
   Сущности уже есть, не хватает связи.

4. `entity_extension`  
   Сущность уже есть, но ей не хватает properties/characteristics/facets.

5. `new_core_entity`  
   Только здесь реально создаётся новая canonical entity.

### 3.3. Rule of preference
Агент и write pipeline должны предпочитать:

1. bind to existing ref  
2. add alias/search phrase  
3. add localized overlay  
4. add relation  
5. extend existing entity  
6. only then propose new core entity

### 3.4. Критерии для `new_core_entity`
Новая сущность добавляется в core, если она:

- семантически самостоятельна;
- повторно используема;
- языконезависима;
- не является просто alias/translation;
- не выражается без потерь комбинацией уже существующих сущностей;
- полезна для solver / authoring / reasoning / preview / navigation.

---

## 4. MCP и агентный слой

### 4.1. MCP нужен
Для работы с онтологией нужен отдельный MCP server, который:

- грузит ontology bundle в память;
- строит lexical index;
- строит adjacency graph;
- при необходимости использует vector/hybrid retrieval;
- отдаёт tools/resources/prompts.

### 4.2. Базовые tools
Минимальный набор tools:

- `search_entities`
- `get_entity`
- `get_neighbors`
- `resolve_mention`
- `suggest_refs_for_text`
- `validate_annotation`
- `propose_new_entities`
- `coverage_report`

### 4.3. Write path
Правильный путь изменения онтологии:

- не редактировать `data-src/*` напрямую;
- использовать controlled write tools;
- валидировать на входе;
- писать в правильный storage format;
- перестраивать индекс;
- логировать warnings/errors/review needs.

### 4.4. Bootstrap-first
Первый реальный use case — не “писать новый идеальный контент”, а:

- прогнать существующие страницы;
- выделить candidate mentions;
- посмотреть unresolved;
- отделить real gaps от false positives;
- собрать proposal queue;
- только потом расширять core и re-annotate контент.

---

## 5. Основные онтологические слои

Для устойчивой модели полезно явно разделять 4 слоя:

### 5.1. Domain concepts
Смысловые сущности химии, термодинамики, материаловедения.

### 5.2. Quantities
Измеряемые / вычисляемые величины:

- температура,
- давление,
- энергия,
- энтропия,
- энтальпия,
- прочность,
- деформация и т.д.

### 5.3. Laws / formulas
Уравнения, соотношения, модели.

### 5.4. Methods / tests / patterns
Испытания, методы оценки, типы зависимостей и аппроксимаций.

---

## 6. Фазы вещества и кристаллические решётки

### 6.1. Это две разные оси
Нельзя смешивать:

- `solid / liquid / gas / plasma`
- `ionic / molecular / atomic / metallic lattice`

### 6.2. Правильная модель

#### Phase of matter
```text
concept:solid_phase
concept:liquid_phase
concept:gaseous_phase
concept:plasma_phase
```

#### Crystal lattice type
```text
concept:crystal_lattice
concept:ionic_crystal_lattice
concept:molecular_crystal_lattice
concept:atomic_crystal_lattice
concept:metallic_crystal_lattice
```

### 6.3. Важное правило
`crystal_lattice_type` имеет смысл только для твёрдой фазы.

### 6.4. Не записывать как универсальную догму
Не стоит утверждать:

> любая субстанция может существовать в любой фазе

Лучше хранить:

- `standard_phase`
- `melting_point`
- `boiling_point`
- `critical_temperature`
- `critical_pressure`
- `decomposes_before_melting`
- `decomposes_before_boiling`
- optional `phase_under_conditions`

### 6.5. Интерпретация отсутствия данных
Если `melting_point` отсутствует, это значит:

- `unknown`
- `not yet populated`

а не:

- “плавления не существует”.

---

## 7. Энергия: общий каркас

### 7.1. Базовые concepts
```text
concept:energy
concept:energy_transfer
concept:work
concept:heat
concept:kinetic_energy
concept:potential_energy
concept:field_energy
concept:electrical_energy
concept:chemical_energy
concept:thermal_energy
concept:radiant_energy
```

### 7.2. Частицы, взаимодействие, поле
```text
concept:particle
concept:interaction
concept:force
concept:field
concept:electric_field
concept:electrostatic_interaction
concept:electron
concept:proton
concept:neutron
concept:charge
```

### 7.3. Микро- и макроуровень
```text
concept:microscopic_state
concept:macroscopic_state
concept:degree_of_freedom
concept:energy_level
concept:ground_state
concept:excited_state
concept:translational_motion
concept:rotational_motion
concept:vibrational_motion
```

### 7.4. Температура и тепловое движение
```text
concept:temperature
concept:thermal_motion
concept:average_kinetic_energy
concept:thermodynamic_equilibrium
concept:thermal_equilibrium
```

---

## 8. Термодинамика

### 8.1. Система и окружение
```text
concept:system
concept:surroundings
concept:boundary
concept:open_system
concept:closed_system
concept:isolated_system
```

### 8.2. Внутренняя энергия
```text
concept:internal_energy
concept:change_in_internal_energy
concept:state_function
concept:first_law_of_thermodynamics
```

### 8.3. Энтропия
```text
concept:entropy
concept:entropy_change
concept:microstate
concept:multiplicity
concept:dispersal_of_energy
concept:second_law_of_thermodynamics
```

### 8.4. Энтальпия
```text
concept:enthalpy
concept:enthalpy_change
concept:enthalpy_of_reaction
concept:enthalpy_of_formation
concept:enthalpy_of_combustion
concept:phase_transition_enthalpy
concept:enthalpy_of_fusion
concept:enthalpy_of_vaporization
concept:enthalpy_of_sublimation
```

### 8.5. Свободные энергии
```text
concept:helmholtz_free_energy
concept:gibbs_free_energy
concept:spontaneous_process
concept:equilibrium
concept:chemical_equilibrium
concept:constant_temperature
concept:constant_pressure
concept:constant_volume
```

### 8.6. Фазовые переходы
```text
concept:phase
concept:phase_transition
concept:phase_equilibrium
concept:phase_diagram
concept:triple_point
concept:critical_point
concept:critical_temperature
concept:critical_pressure
concept:melting
concept:freezing
concept:vaporization
concept:condensation
concept:sublimation
concept:deposition
concept:melting_point
concept:boiling_point
```

---

## 9. Laws / equations, которые стоит иметь как сущности

### 9.1. Термодинамика и статистика
```text
law:first_law_of_thermodynamics
law:gibbs_energy_relation
law:boltzmann_entropy_formula
law:clapeyron_equation
law:clausius_clapeyron_equation
```

### 9.2. Далее по химии
```text
law:van_t_hoff_equation
law:arrhenius_equation
law:nernst_equation
law:ideal_gas_equation
```

### 9.3. Что хранить на law node
Для каждой формулы желательно хранить:

- canonical formula text;
- variable bindings;
- constants;
- assumptions;
- applicability conditions;
- exactness status:
  - `exact`
  - `approximation`
  - `heuristic`

---

## 10. Quantities, constants, variables, math layer

### 10.1. Quantities
```text
quantity:temperature
quantity:pressure
quantity:volume
quantity:amount_of_substance
quantity:energy
quantity:internal_energy
quantity:entropy
quantity:enthalpy
quantity:gibbs_free_energy
quantity:stress
quantity:strain
quantity:fracture_toughness
quantity:impact_energy
...
```

### 10.2. Constants
```text
const:avogadro_constant
const:boltzmann_constant
const:gas_constant
const:faraday_constant
const:elementary_charge
```

### 10.3. Variables
Не путать `quantity` и `variable`.

- `quantity:temperature` — физическая величина
- `var:T` — символ переменной в конкретной формуле

### 10.4. Math entities
```text
math:quantity
math:variable
math:constant
math:parameter
math:function
math:equation
math:inequality
math:proportionality
math:derivative
math:partial_derivative
math:integral
math:scalar
math:vector
math:dimension
math:unit
math:logarithm
math:exponential_function
math:differential
```

### 10.5. Dependency / method layer
```text
method:balance_equation
method:conservation_law
method:equilibrium_condition
method:approximation
method:linearization
method:log_transform
method:differential_relation
method:empirical_fit
method:dimension_analysis

pattern:direct_proportionality
pattern:inverse_proportionality
pattern:exponential_dependence
pattern:logarithmic_dependence
pattern:piecewise_dependence
pattern:threshold_rule
pattern:sigmoidal_transition
```

---

## 11. Мост к химической связи

### 11.1. Что нужно для раздела о химической связи
```text
concept:chemical_bond
concept:ionic_bond
concept:covalent_bond
concept:covalent_polar_bond
concept:covalent_nonpolar_bond
concept:metallic_bond

concept:electronegativity
concept:electron_transfer
concept:shared_electron_pair
concept:partial_charge
concept:delocalized_electron
concept:electron_density

concept:ion
concept:cation
concept:anion
```

### 11.2. Что полезно добавить далее
```text
concept:bond_energy
concept:bond_length
concept:bond_polarity
concept:lattice_energy
concept:hydration_energy
```

### 11.3. Что не стоит делать автоматически
Не все unresolved mentions на странице химической связи нужно превращать в core entities.

Например:
- “или”
- “оба”
- “между”
- “разные”

не должны автоматически становиться core nodes.

---

## 12. Mechanical / deformation properties

### 12.1. Ключевой принцип
Упругость, пластичность, хрупкость, ползучесть, релаксация — это обычно **не абсолютные свойства вещества вообще**, а:

- свойства материала;
- или свойства вещества/материала в заданном состоянии и условиях.

### 12.2. Core concepts
```text
concept:deformation
concept:elastic_deformation
concept:plastic_deformation
concept:reversible_deformation
concept:irreversible_deformation
concept:fracture
concept:brittle_fracture
concept:elasticity
concept:plasticity
concept:brittleness
concept:creep
concept:stress_relaxation
concept:elastic_limit
concept:viscoelasticity
```

### 12.3. Quantities
```text
quantity:stress
quantity:strain
quantity:youngs_modulus
quantity:yield_strength
quantity:ultimate_tensile_strength
quantity:elongation_at_break
quantity:reduction_in_area
quantity:creep_rate
quantity:relaxation_time
quantity:fracture_toughness
quantity:impact_energy
quantity:brittleness_temperature
quantity:temperature
quantity:time
quantity:load
```

### 12.4. Laws and test methods
```text
law:hookes_law

test_method:tensile_test
test_method:impact_test
test_method:fracture_toughness_test
test_method:creep_test
test_method:stress_relaxation_test
```

### 12.5. Characteristics
```text
char:elasticity
char:plasticity
char:brittleness
char:creep_behavior
char:relaxation_behavior
char:deformability
```

### 12.6. Важное различение
Нельзя сливать в одну ось:

- твёрдость;
- прочность;
- упругость;
- пластичность;
- хрупкость.

Это разные характеристики.

### 12.7. Пластичность и хрупкость — не одна ось
Их лучше моделировать как:

- две отдельные, связанные характеристики;
- а не как два конца одной линейки.

Рекомендуемая связь:
```text
char:brittleness --contrasts_with--> char:plasticity
char:plasticity --related_to--> concept:plastic_deformation
char:brittleness --related_to--> concept:fracture
```

### 12.8. Чем они оцениваются

#### Пластичность
Часто через:
- `quantity:elongation_at_break`
- `quantity:reduction_in_area`

Обычно в `%`.

#### Хрупкость
Обычно не имеет одной универсальной единицы. Оценивается через:
- `quantity:impact_energy`
- `quantity:fracture_toughness`
- `quantity:brittleness_temperature`
- низкую пластическую деформацию до разрушения

---

## 13. Температурная зависимость пластичности и хрупкости

### 13.1. Общий принцип
Эта зависимость должна быть в онтологии, но не как один универсальный закон для всех материалов.

### 13.2. Общие trends
```text
trend:plasticity_often_increases_with_temperature
trend:brittleness_often_increases_with_decreasing_temperature
trend:creep_rate_increases_with_temperature
```

### 13.3. Class-specific models

#### Металлы
- ductile-to-brittle transition curves
- fracture toughness vs temperature
- impact energy vs temperature
- `quantity:ductile_to_brittle_transition_temperature`

#### Полимеры
- `quantity:glass_transition_temperature`
- `law:wlf_equation`
- `quantity:shift_factor`
- `curve:relaxation_time_vs_temperature`

#### Ползучесть
- `law:arrhenius_creep_relation`
- `quantity:activation_energy`
- `quantity:stress_exponent`

#### Керамики и хрупкие неорганические материалы
- material-specific empirical curves:
  - fracture toughness vs temperature
  - hardness vs temperature

### 13.4. Правильный ontology pattern
Не одна “формула хрупкости”, а:
- trend
- class-specific law / pattern
- measured curve / fit

---

## 14. На что вешать характеристики: substance, material или state

### 14.1. `substance`
Допустимо, если:
- это химически чистое вещество;
- речь о типичной фазе;
- формулировка учебно-обзорная;
- нет критической зависимости от микроструктуры.

### 14.2. `material`
Лучше, если это:
- сталь;
- стекло;
- чугун;
- бетон;
- полимерный материал;
- битум;
- композит.

### 14.3. `state`
Наиболее корректно, если характеристика зависит от:
- фазы;
- температуры;
- времени;
- типа нагрузки;
- скорости деформации.

### 14.4. Practical rule
Из карточки вещества ссылаться на характеристики можно, если:
- явно подразумевается типичное состояние;
- это didactic-level description.

Но в structured data лучше хранить:

- subject;
- characteristic;
- value;
- conditions.

Пример:
```json
{
  "subject_ref": "sub:sodium_chloride",
  "characteristic_ref": "char:brittleness",
  "value": "high",
  "conditions": {
    "phase": "concept:solid_phase",
    "temperature_context": "near_room_temperature"
  }
}
```

---

## 15. Что держать в core, а что в didactic overlay

### 15.1. В core
- короткие строгие определения;
- quantities;
- laws;
- relations;
- test methods;
- characteristics;
- applicability conditions.

### 15.2. В overlays
- педагогические формулировки;
- упрощённые объяснения;
- метафоры;
- школьные эвристики;
- контекстные пояснения.

Примеры overlay-only phrasing:
- “материал рассыпается под нагрузкой”
- “нельзя придать форму прессованием”
- “при повышении температуры обычно возрастает пластичность”
- “Δχ ≥ 1,7 — школьное правило, а не абсолютный физический закон”

---

## 16. Recommended relation set

### 16.1. Универсальные отношения
```text
depends_on
increases_with
decreases_with
is_defined_as
is_measured_in
has_symbol
has_unit
applies_under_condition
is_special_case_of
is_approximation_of
is_related_to
governs
describes
constrains
uses_variable
uses_quantity
uses_constant
solves_for
has_parameter
assumes_constant
valid_for_process
```

### 16.2. Для mechanical block
```text
manifested_as
associated_with
contrasts_with
measured_by
assessed_by
applicable_in
leads_to
```

---

## 17. Минимальные priority packs

### 17.1. Energy & thermo foundation
```text
concept:energy
concept:kinetic_energy
concept:potential_energy
concept:field
concept:electric_field
concept:charge
concept:temperature
concept:internal_energy
concept:heat
concept:work
concept:entropy
concept:enthalpy
concept:gibbs_free_energy
concept:phase
concept:phase_transition
concept:equilibrium

law:first_law_of_thermodynamics
law:gibbs_energy_relation
law:clapeyron_equation

math:quantity
math:variable
math:function
math:equation
math:derivative
math:unit
```

### 17.2. Bonding package
```text
concept:chemical_bond
concept:ionic_bond
concept:covalent_bond
concept:covalent_polar_bond
concept:covalent_nonpolar_bond
concept:metallic_bond

concept:crystal_lattice
concept:ionic_crystal_lattice
concept:molecular_crystal_lattice
concept:atomic_crystal_lattice
concept:metallic_crystal_lattice

concept:electronegativity
concept:electron_transfer
concept:shared_electron_pair
concept:partial_charge
concept:delocalized_electron
```

### 17.3. Mechanical package
```text
concept:deformation
concept:elastic_deformation
concept:plastic_deformation
concept:fracture
concept:elasticity
concept:plasticity
concept:brittleness
concept:creep
concept:stress_relaxation
concept:elastic_limit

quantity:stress
quantity:strain
quantity:youngs_modulus
quantity:elongation_at_break
quantity:reduction_in_area
quantity:creep_rate
quantity:relaxation_time
quantity:fracture_toughness
quantity:impact_energy
quantity:brittleness_temperature

law:hookes_law

char:elasticity
char:plasticity
char:brittleness
char:creep_behavior
char:relaxation_behavior
```

---

## 18. Practical workflow for enrichment

### 18.1. Step 1 — bootstrap corpus
Прогнать существующие страницы и объяснения через:
- mention extraction;
- deterministic lookup;
- candidate ranking;
- unresolved classification.

### 18.2. Step 2 — classify unresolved
Разделить unresolved на:
- real gap in core;
- alias/search overlay;
- localization overlay;
- ignore/noise;
- later-domain entity.

### 18.3. Step 3 — enrich ontology minimally
Добавлять только то, без чего нельзя корректно разметить страницы.

### 18.4. Step 4 — re-annotate
Повторно прогнать документы после расширения core/overlays.

### 18.5. Step 5 — review
Проверить:
- coverage;
- false positives;
- false unresolved;
- overlinking;
- предметную корректность формулировок.

---

## 19. Основные правила quality control

1. Не путать quantity, concept, law, characteristic, method.
2. Не хранить локализованный human text в core.
3. Не превращать все unresolved tokens в new concept.
4. Не записывать отсутствие данных как отрицание.
5. Не делать абсолютные безусловные утверждения там, где свойство зависит от условий.
6. Не смешивать didactic heuristic с universal law.
7. Не смешивать phase with crystal lattice type.
8. Не смешивать hardness, strength, brittleness, plasticity, elasticity.
9. Пластичность и хрупкость хранить как отдельные связанные характеристики.
10. Для temperatures/curves/laws предпочитать class-specific modelling вместо одной псевдоуниверсальной формулы.

---

## 20. Итоговые рекомендации

### 20.1. Для ontology core
Сделать расширение по волнам:

**Wave 1**
- energy/thermo basics;
- phases;
- bonding package;
- mechanical basics.

**Wave 2**
- constants, laws, math layer;
- class-specific temperature dependence;
- richer material/test modelling.

**Wave 3**
- quantitative curves, fits, solver-facing dependency models.

### 20.2. Для authoring и MCP
- использовать deterministic-first lookup;
- добавить morphology-aware resolution;
- использовать `material_language + en`;
- писать через validated MCP write tools;
- сохранять proposal/review discipline для semantically risky changes.

### 20.3. Для didactic content
- обогащать существующие тексты постепенно;
- ставить RichText refs на действительно смысловые узлы;
- не превращать текст в “море ссылок”;
- отдельно хранить school-level heuristics как overlay.

---

## 21. Рекомендуемые следующие артефакты

1. `ontology-admission-policy-v1.md`
2. `mechanical-properties-package-draft.md`
3. `energy-thermo-package-draft.md`
4. `bonding-and-lattice-package-draft.md`
5. `quantities-constants-laws-schema.md`
6. `bootstrap-annotation-review-checklist.md`

---

## 22. Короткий summary

### Что самое важное
- core должен оставаться чистым и языконезависимым;
- reverse search и authoring должны опираться на overlays;
- new entity — редкий, контролируемый случай;
- энергия/термодинамика требуют отдельного quantity/law/math слоя;
- phase и crystal lattice — разные оси;
- mechanical properties зависят от состояния и условий;
- пластичность и хрупкость — разные, но связанные характеристики;
- temperature dependence надо хранить как trends + class-specific laws + measured curves.

Это и есть рабочая основа для дальнейшего расширения химической онтологии, enrichment существующих материалов и построения authoring/solver infrastructure.
