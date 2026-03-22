# Руководство по онтологизации: энергия, термодинамика, фазы и математический слой

## 1. Назначение документа

Этот документ фиксирует практические правила расширения химической онтологии в части:

- энергии и взаимодействий;
- температуры, внутренней энергии, энтропии, энтальпии, энергии Гиббса;
- фаз вещества и фазовых переходов;
- кристаллических решёток;
- физических величин, констант, переменных, законов и зависимостей;
- admission policy для добавления новых сущностей.

Цель — расширять онтологию без semantic pollution, без смешения языковых слоёв с canonical core и без смешения domain concepts, quantities, laws и didactic overlays.

---

## 2. Базовые принципы моделирования

### 2.1. Canonical core отдельно от локализаций

В canonical ontology не должны храниться локализованные поля вроде `name_ru`, `name_en`, `name_es`.

Canonical core содержит только:

- стабильные сущности;
- их типы;
- relations;
- структурные характеристики;
- machine-usable semantics.

Человеческий текст живёт отдельно:

- в `translations/`;
- в localization overlays;
- в search overlays;
- в didactic layers.

### 2.2. Не смешивать разные оси классификации

Нельзя класть в один список сущности разной природы.

Пример плохой модели:

- ионная
- кристаллическая
- жидкость
- газ

Здесь смешаны:

- тип кристаллической решётки;
- общее свойство «кристаллический»;
- агрегатные состояния.

Правильная практика: каждая ось классификации должна быть отдельным concept set / vocabulary.

### 2.3. Domain concepts, quantities, laws, methods — разные слои

Необходимо развести как минимум 4 слоя:

1. **Domain concepts** — сущности химии и физической химии.
2. **Quantities** — измеряемые или вычисляемые величины.
3. **Laws / equations** — формулы и законы.
4. **Methods / dependency patterns** — способы рассуждения, типы зависимостей, приближения.

Без этого solver и authoring начинают смешивать смысловую сущность, обозначение, формулу и метод решения.

---

## 3. Admission policy: правило добавления сущностей

### 3.1. Главное правило

Новая сущность добавляется в canonical ontology только тогда, когда доказано, что она:

- самостоятельна семантически;
- повторно используема;
- языконезависима;
- не сводится к alias, overlay, relation или extension существующей сущности.

### 3.2. Порядок предпочтения для агента

При встрече нового фрагмента агент обязан предпочитать:

1. bind to existing ref;
2. add alias / search phrase;
3. add localization overlay;
4. add relation;
5. extend existing entity;
6. only then propose new core entity.

### 3.3. Типы additions

- `alias_addition`
- `overlay_addition`
- `relation_addition`
- `entity_extension`
- `new_core_entity`

### 3.4. Что не добавлять в core автоматически

Не добавлять автоматически:

- логические слова (`или`, `оба`);
- грамматические формы;
- частные didactic phrases;
- неоднозначные популяризаторские метафоры;
- дубли существующих substance class / property refs.

---

## 4. Фазы вещества и кристаллические решётки

### 4.1. Это разные оси

Нужно разделять:

#### A. `phase_of_matter`

- `concept:solid_phase`
- `concept:liquid_phase`
- `concept:gaseous_phase`
- `concept:plasma_phase`

#### B. `crystal_lattice_type`

- `concept:ionic_crystal_lattice`
- `concept:molecular_crystal_lattice`
- `concept:atomic_crystal_lattice`
- `concept:metallic_crystal_lattice`

### 4.2. Правило совместимости

`crystal_lattice_type` применим только к твёрдой фазе.

То есть:

- жидкость не имеет кристаллической решётки в этом смысле;
- газ не имеет кристаллической решётки;
- тип решётки — характеристика строения твёрдого вещества.

### 4.3. Не утверждать безусловно, что любая субстанция существует во всех фазах

Лучше хранить:

- `standard_phase`
- `melting_point`
- `boiling_point`
- `critical_temperature`
- `critical_pressure`
- `decomposes_before_melting`
- `decomposes_before_boiling`

Если `melting_point` отсутствует, это должно трактоваться как **unknown**, а не как отрицание возможности жидкой фазы.

### 4.4. Рекомендуемый policy

- есть `melting_point` → переход solid ↔ liquid известен;
- нет `melting_point` → unknown;
- явная невозможность нормального перехода кодируется отдельно, например `decomposes_before_melting`.

---

## 5. Энергия: верхний уровень

### 5.1. Базовые concepts

- `concept:energy`
- `concept:energy_transfer`
- `concept:work`
- `concept:heat`

### 5.2. Формы энергии

- `concept:kinetic_energy`
- `concept:potential_energy`
- `concept:field_energy`
- `concept:electrical_energy`
- `concept:chemical_energy`
- `concept:thermal_energy`
- `concept:radiant_energy`

### 5.3. Важное дидактическое различение

- **теплота** — не запас, а способ передачи энергии;
- **работа** — не запас, а способ передачи энергии;
- **энергия** — более общий объект, чем heat/work.

---

## 6. Частицы, поле, взаимодействие

Чтобы объяснения энергии не были «магией», нужен микрофизический слой.

### 6.1. Рекомендуемые concepts

- `concept:particle`
- `concept:interaction`
- `concept:force`
- `concept:field`
- `concept:electric_field`
- `concept:electrostatic_interaction`
- `concept:electrostatic_attraction`
- `concept:electrostatic_repulsion`
- `concept:charge`
- `concept:electron`
- `concept:proton`
- `concept:neutron`
- `concept:nucleus`

### 6.2. Для химии особенно важны

- `electron`
- `charge`
- `electric_field`
- `electrostatic_attraction`
- `electrostatic_repulsion`

Они нужны для немагического объяснения:

- ионной связи;
- полярности;
- энергии связи;
- электронной плотности.

---

## 7. Температура и тепловое движение

### 7.1. Concepts

- `concept:temperature`
- `concept:thermal_motion`
- `concept:average_kinetic_energy`
- `concept:thermal_equilibrium`
- `concept:thermodynamic_equilibrium`

### 7.2. Методическое правило

Температуру лучше объяснять не как «количество тепла», а как величину, связанную с:

- распределением энергии;
- средним кинетическим вкладом теплового движения частиц;
- направлением теплообмена.

---

## 8. Внутренняя энергия

### 8.1. Concepts

- `concept:internal_energy`
- `concept:change_in_internal_energy`
- `concept:state_function`

### 8.2. Системный слой

- `concept:system`
- `concept:surroundings`
- `concept:boundary`
- `concept:closed_system`
- `concept:open_system`
- `concept:isolated_system`

### 8.3. Закон

- `law:first_law_of_thermodynamics`

### 8.4. Смысл

Внутренняя энергия включает:

- микроскопические кинетические вклады;
- потенциальные вклады взаимодействий;
- энергии связей;
- электронные, вращательные и колебательные вклады.

---

## 9. Энтропия

### 9.1. Concepts

- `concept:entropy`
- `concept:entropy_change`
- `concept:microstate`
- `concept:multiplicity`
- `concept:dispersal_of_energy`
- `law:second_law_of_thermodynamics`

### 9.2. Методическое правило

В canonical definition не использовать «беспорядок» как основное определение.

Лучше опираться на:

- число доступных микросостояний;
- распределение энергии;
- термодинамический критерий самопроизвольности.

---

## 10. Энтальпия

### 10.1. Concepts

- `concept:enthalpy`
- `concept:enthalpy_change`
- `concept:standard_enthalpy_change`
- `concept:enthalpy_of_reaction`
- `concept:enthalpy_of_formation`
- `concept:enthalpy_of_combustion`
- `concept:phase_transition_enthalpy`
- `concept:enthalpy_of_fusion`
- `concept:enthalpy_of_vaporization`
- `concept:enthalpy_of_sublimation`

### 10.2. Дидактический смысл

Энтальпия — удобная функция состояния для процессов при постоянном давлении.

---

## 11. Свободные энергии и критерии самопроизвольности

### 11.1. Concepts

- `concept:helmholtz_free_energy`
- `concept:gibbs_free_energy`
- `concept:spontaneous_process`
- `concept:equilibrium`
- `concept:chemical_equilibrium`

### 11.2. Conditions

- `concept:constant_temperature`
- `concept:constant_pressure`
- `concept:constant_volume`

### 11.3. Методическое правило

- Гиббс — критерий для `T, p = const`;
- Гельмгольц — критерий для `T, V = const`;
- наиболее общий принцип — рост энтропии полной изолированной системы.

---

## 12. Фазовые переходы и фазовое равновесие

### 12.1. Concepts

- `concept:phase`
- `concept:phase_transition`
- `concept:phase_equilibrium`
- `concept:phase_diagram`
- `concept:triple_point`
- `concept:critical_point`
- `concept:critical_temperature`
- `concept:critical_pressure`

### 12.2. Виды переходов

- `concept:melting`
- `concept:freezing`
- `concept:vaporization`
- `concept:condensation`
- `concept:sublimation`
- `concept:deposition`

### 12.3. Связанные quantities

- `quantity:melting_point`
- `quantity:boiling_point`

---

## 13. Связь энергии с химической связью

### 13.1. Concepts

- `concept:chemical_bond`
- `concept:ionic_bond`
- `concept:covalent_bond`
- `concept:covalent_polar_bond`
- `concept:covalent_nonpolar_bond`
- `concept:metallic_bond`
- `concept:bond_energy`
- `concept:bond_length`
- `concept:bond_polarity`
- `concept:electronegativity`
- `concept:electron_density`
- `concept:electron_transfer`
- `concept:shared_electron_pair`
- `concept:partial_charge`
- `concept:delocalized_electron`
- `concept:lattice_energy`
- `concept:hydration_energy`

### 13.2. Методическое замечание

Для metallic bond лучше не вводить автоматически `concept:electron_cloud` как canonical core entity, если речь идёт о didactic metaphor. Предпочтительнее моделировать:

- metallic bond;
- delocalized electron;
- metal cation;
- crystal lattice.

А выражение «электронное облако» хранить в overlay при необходимости.

---

## 14. Quantities: слой физических величин

Это отдельный слой, отличный от concept layer.

### 14.1. Минимальные quantities

- `quantity:temperature`
- `quantity:pressure`
- `quantity:volume`
- `quantity:amount_of_substance`
- `quantity:energy`
- `quantity:internal_energy`
- `quantity:entropy`
- `quantity:enthalpy`
- `quantity:gibbs_free_energy`
- `quantity:helmholtz_free_energy`
- `quantity:charge`
- `quantity:electrical_conductivity`
- `quantity:thermal_conductivity`
- `quantity:melting_point`
- `quantity:boiling_point`

### 14.2. Полезные метаданные для quantity

- dimension;
- SI unit;
- intensive/extensive;
- scalar/vector;
- typical symbol.

---

## 15. Constants: физические и химические константы

### 15.1. Обязательный стартовый пакет

- `const:avogadro_constant`
- `const:boltzmann_constant`
- `const:gas_constant`
- `const:faraday_constant`
- `const:elementary_charge`

### 15.2. Полезные далее

- `const:planck_constant`
- `const:speed_of_light`
- `const:vacuum_permittivity`

### 15.3. Что хранить у constant

- symbol;
- dimension;
- SI unit;
- value;
- exactness status.

### 15.4. Связи между константами

Пример важной связи:

- `const:gas_constant` related to `const:avogadro_constant`
- `const:gas_constant` related to `const:boltzmann_constant`
- law node for relation `R = N_A k_B`

---

## 16. Variables: символы в формулах

Нужно различать:

- `quantity:temperature` — физическая величина;
- `var:T` — её символ в формуле.

### 16.1. Рекомендуемые variable entities

- `var:T`
- `var:P`
- `var:V`
- `var:n`
- `var:S`
- `var:H`
- `var:G`
- `var:U`
- `var:k_B`
- `var:N_A`
- `var:R`

### 16.2. Обязательная связь

Каждая variable должна иметь:

- `denotes_quantity`
- и, при необходимости, `uses_constant_ref` для константных символов.

---

## 17. Laws / equations

Формулы и законы нужно моделировать как отдельные сущности, а не просто как строки текста.

### 17.1. Минимальный пакет laws

- `law:first_law_of_thermodynamics`
- `law:boltzmann_entropy_formula`
- `law:gibbs_energy_relation`
- `law:clapeyron_equation`
- `law:clausius_clapeyron_equation`
- `law:ideal_gas_equation`

### 17.2. Полезные далее

- `law:van_t_hoff_equation`
- `law:arrhenius_equation`
- `law:nernst_equation`

### 17.3. Что хранить у law

- formula_text;
- variable refs;
- quantity refs;
- constant refs;
- applicability conditions;
- assumptions;
- exactness status: `exact | approximation | heuristic`.

### 17.4. Методическое правило

Школьные границы типа `Δχ ≥ 1.7` не должны кодироваться как абсолютные universal laws. Это didactic heuristics.

---

## 18. Dependency patterns и mathematical methods

### 18.1. Dependency patterns

- `pattern:direct_proportionality`
- `pattern:inverse_proportionality`
- `pattern:linear_dependence`
- `pattern:logarithmic_dependence`
- `pattern:exponential_dependence`
- `pattern:piecewise_dependence`
- `pattern:threshold_rule`
- `pattern:differential_relation`

### 18.2. Methods

- `method:balance_equation`
- `method:conservation_law`
- `method:equilibrium_condition`
- `method:approximation`
- `method:linearization`
- `method:log_transform`
- `method:differential_relation`
- `method:empirical_fit`
- `method:dimension_analysis`

---

## 19. Math layer

Математические сущности нужно отделять от domain entities.

### 19.1. Минимальные math entities

- `math:quantity`
- `math:variable`
- `math:constant`
- `math:function`
- `math:equation`
- `math:inequality`
- `math:proportionality`
- `math:derivative`
- `math:partial_derivative`
- `math:integral`
- `math:unit`
- `math:dimension`
- `math:scalar`
- `math:vector`
- `math:parameter`
- `math:differential`
- `math:logarithm`
- `math:exponential_function`

---

## 20. Recommended relations

### 20.1. Общие relations

- `depends_on`
- `is_defined_as`
- `has_symbol`
- `has_unit`
- `has_dimension`
- `applies_under_condition`
- `is_special_case_of`
- `is_approximation_of`
- `describes`
- `governs`
- `constrains`
- `is_related_to`

### 20.2. Между laws и variables/quantities/constants

- `uses_variable`
- `uses_quantity`
- `uses_constant`
- `has_parameter`
- `solves_for`
- `assumes_constant`
- `valid_for_process`
- `has_dependency_pattern`

### 20.3. Между variable и quantity

- `denotes_quantity`
- `represented_by`

### 20.4. Между quantities

- `directly_proportional_to`
- `inversely_proportional_to`
- `logarithmically_depends_on`
- `exponentially_depends_on`

---

## 21. Что добавлять в первую волну

### 21.1. Foundation

- `concept:energy`
- `concept:work`
- `concept:heat`
- `concept:particle`
- `concept:interaction`
- `concept:charge`
- `concept:field`
- `concept:electric_field`
- `concept:temperature`
- `concept:internal_energy`

### 21.2. Thermodynamics core

- `concept:system`
- `concept:surroundings`
- `law:first_law_of_thermodynamics`
- `concept:entropy`
- `concept:enthalpy`
- `concept:gibbs_free_energy`
- `concept:phase`
- `concept:phase_transition`
- `quantity:melting_point`
- `quantity:boiling_point`

### 21.3. Bond / structure bridge

- `concept:chemical_bond`
- `concept:ionic_bond`
- `concept:covalent_bond`
- `concept:covalent_polar_bond`
- `concept:covalent_nonpolar_bond`
- `concept:metallic_bond`
- `concept:ionic_crystal_lattice`
- `concept:molecular_crystal_lattice`
- `concept:atomic_crystal_lattice`
- `concept:metallic_crystal_lattice`
- `concept:shared_electron_pair`
- `concept:partial_charge`
- `concept:delocalized_electron`
- `quantity:electrical_conductivity`

### 21.4. Constants / math / laws

- `const:avogadro_constant`
- `const:boltzmann_constant`
- `const:gas_constant`
- `const:faraday_constant`
- `const:elementary_charge`
- `law:ideal_gas_equation`
- `law:gibbs_energy_relation`
- `law:clapeyron_equation`
- `math:quantity`
- `math:variable`
- `math:function`
- `math:equation`
- `math:unit`
- `math:dimension`

---

## 22. Что не делать сразу

Не стоит сразу тащить в canonical core:

- все школьные метафоры;
- все редкие физические поля;
- все формулы подряд;
- все частные словесные варианты;
- literal unresolved tokens из bootstrap pass.

Сначала нужны reusable, structurally valuable сущности.

---

## 23. Применение к текущим задачам автора

### 23.1. Для bond pages

Нужно использовать whitelist-подход:

#### Add to core
- bond types;
- crystal lattice types;
- conductivity-related quantity;
- key mechanism concepts.

#### Reuse existing
- substances;
- elements;
- existing classes metal/nonmetal, если уже есть;
- existing quantities like melting point.

#### Overlay only
- didactic thresholds типа `Δχ ≥ 1.7`;
- метафоры вроде `электронное облако`, если нет уверенности в необходимости canonical ref.

### 23.2. Для phase modeling

- `phase_of_matter` и `crystal_lattice_type` должны жить отдельно;
- отсутствие `melting_point` трактуется как unknown;
- decomposition and applicability constraints задаются явно.

---

## 24. Финальная рекомендация

Для дальнейшей работы проекту нужен следующий устойчивый каркас:

1. canonical ontology без локализованных полей;
2. overlays для language/search/didactic text;
3. admission policy с conservative ordering;
4. отдельные vocabularies для фаз и решёток;
5. отдельные слои для concepts, quantities, constants, variables, laws, methods;
6. explicit modelling of applicability conditions and approximation status.

Именно такой подход даст:

- устойчивый solver;
- качественную RichText-онтологизацию;
- управляемый рост ontology core;
- возможность строить didactic explanations без «магии».
