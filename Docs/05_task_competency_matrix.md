# 🧩 Матрица «тип задания → компетенции» (финальная, ОГЭ)
## Проект: «Химия без магии»
Версия: 2026-02-15

Этот документ синхронизирован с:
- `03_competency_map_final_oge.md` — финальная карта компетенций и зависимостей
- `12_oge_gap_analysis_with_filters.md` — покрытие формата ОГЭ и фильтры
- `07_adaptive_bkt_math_model.md` — матмодель BKT (обновление P(L))

---

# 1. Нотация и метаданные заданий

## 1.1 Роли компетенций в задании
- **P** (Primary) — основная компетенция (обязательна для оценки)
- **S** (Secondary) — вспомогательная (регулярно задействуется)
- **O** (Optional) — может задействоваться, зависит от варианта/формулировки

## 1.2 Фильтры (обязательные теги для UI и индексов)
Каждый шаблон задания в `templates/task_templates.json` должен иметь:
- `exam_block`: `theory | reactions | calculations`
- `topic_tag`: `periodic | trends | bonds | crystal | classification | naming | amphoterism | exchange | precip_gas | redox | chains | qualitative | energy | catalysis | electrolytes | calc | yield`
- `competencies.primary`: массив id
- `competencies.secondary`: массив id (опционально)
- `difficulty`: `easy | medium | hard` (для выбора заданий)
- `seedable`: bool (перемешивание/параметризация)

---

# 2. Таблица покрытий (типы заданий)

| Тип задания | exam_block | topic_tag | P (primary) | S (secondary) |
|---|---|---|---|---|
| 1) Определи группу/период, металл/неметалл | theory | periodic | periodic_table | periodic_trends(O) |
| 2) Сравни свойства элементов по ПСХЭ | theory | trends | periodic_trends | periodic_table(S) |
| 3) Собери электронную конфигурацию | theory | periodic | electron_config | periodic_table(S) |
| 4) Определи валентные/неспаренные электроны | theory | periodic | electron_config | periodic_table(S) |
| 5) Тип химической связи по составу/Δχ | theory | bonds | bond_type | electron_config(S), periodic_table(S) |
| 6) Тип кристаллической решётки | theory | crystal | crystal_structure_type | bond_type(S), classification(O) |
| 7) Классифицируй вещество (оксид/кислота/основание/соль) | theory | classification | classification | periodic_table(S) |
| 8) Дай название по формуле | theory | naming | naming | classification(S) |
| 9) Амфотерность (определи/выбери реакцию) | theory | amphoterism | amphoterism_logic | classification(S) |
| 10) Идёт ли обмен? (осадок/газ/вода) | reactions | precip_gas | gas_precipitate_logic | reactions_exchange(S), classification(S) |
| 11) Нейтрализация: кислота + основание | reactions | exchange | reactions_exchange | classification(S), naming(O) |
| 12) Соль + кислота (газ/осадок/вода) | reactions | exchange | reactions_exchange | gas_precipitate_logic(S) |
| 13) Соль + щёлочь (гидроксид↓) | reactions | exchange | reactions_exchange | gas_precipitate_logic(S) |
| 14) Карбонат + кислота → CO₂ | reactions | precip_gas | gas_precipitate_logic | reactions_exchange(S) |
| 15) Замещение: металл + соль / металл + кислота | reactions | redox | reactions_redox | periodic_table(S), oxidation_states(S) |
| 16) Определи СО в соединении | theory | redox | oxidation_states | electron_config(O), periodic_table(O) |
| 17) Окислитель/восстановитель | reactions | redox | oxidation_states | reactions_redox(S) |
| 18) Балансировка ОВР (электронный баланс) | reactions | redox | reactions_redox | oxidation_states(S) |
| 19) Генетическая цепочка превращений | reactions | chains | genetic_chain_logic | classification(S), reactions_exchange(S), reactions_redox(O) |
| 20) Качественный анализ: чем распознать вещество | reactions | qualitative | qualitative_analysis_logic | gas_precipitate_logic(S), classification(S) |
| 21) Энергетический профиль реакции (Ea, скорость) | theory | energy | reaction_energy_profile | reactions_exchange(O), reactions_redox(O) |
| 22) Роль катализатора (что меняет/не меняет) | theory | catalysis | catalyst_role_understanding | reaction_energy_profile(S) |
| 23) Электролит/неэлектролит, сильный/слабый | theory | electrolytes | electrolyte_logic | classification(S) |
| 24) n=m/M, Mr | calculations | calc | calculations_basic | naming(O) |
| 25) Массовая доля ω, смеси | calculations | calc | calculations_basic | calculations_solutions(S) |
| 26) Растворы (ω, разбавление) | calculations | calc | calculations_solutions | calculations_basic(S) |
| 27) Выход реакции | calculations | yield | reaction_yield_logic | calculations_basic(S), calculations_solutions(O) |

---

# 3. Рекомендации по индексам для быстрых фильтров (CDN-friendly)

Для поддержки UI-фильтров без перебора всех шаблонов на клиенте рекомендуется генерировать:

- `indices/by_exam_block/theory.json`
- `indices/by_exam_block/reactions.json`
- `indices/by_exam_block/calculations.json`
- `indices/by_topic_tag/<topic_tag>.json`
- `indices/by_competency/<competency_id>.json` *(уже предусмотрено в `08_json_bundles_spec.md`)*

Каждый индекс содержит список `task_template_id`.

---

# 4. Минимальный набор диагностики (10–12 типов)

Чтобы уложиться в 15–20 минут и покрыть все ветки графа:

- 1 (periodic_table)
- 2 (periodic_trends)
- 5 (bond_type)
- 6 (crystal_structure_type)
- 7 (classification)
- 10 (gas_precipitate_logic)
- 15 (reactions_redox)
- 19 (genetic_chain_logic)
- 23 (electrolyte_logic)
- 24 (calculations_basic)
- 26 (calculations_solutions)
- 27 (reaction_yield_logic)

---

# 5. Связь с BKT (как обновлять P(L))

Каждая попытка обновляет `P(L)` для компетенций:
- primary: вес 1.0
- secondary: вес 0.5 (реализовать через модификацию параметров S/G или через «меньшую силу» обновления)

Формулы и параметры см. `07_adaptive_bkt_math_model.md`.
