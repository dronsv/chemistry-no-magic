#!/usr/bin/env node
/**
 * Generates public/llms-full.txt — machine-readable chemistry reference
 * for AI agents (LLMs, RAG systems). Runs at build time.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'public', 'llms-full.txt');
const SITE = 'https://chemistry.svistunov.online';

function read(relPath) {
  return JSON.parse(readFileSync(join(ROOT, relPath), 'utf8'));
}

const lines = [];
const emit = (...args) => lines.push(args.join(''));
const section = (title) => { emit(); emit('## ', title); emit(); };

// ── Header ───────────────────────────────────────────────────────────────────

emit('# Химия без магии — Полный справочник для AI-агентов');
emit();
emit('> Машиночитаемый справочник химических данных сайта chemistry.svistunov.online.');
emit('> Все данные актуальны на момент сборки. Сайт: ', SITE);
emit('> Справочник на английском: ', SITE, '/en/');
emit();

// ── Competencies ─────────────────────────────────────────────────────────────

section('Компетенции (учебные модули)');

const competencies = read('data-src/rules/competencies.json');
for (const c of competencies) {
  emit('### ', c.name_ru);
  emit();
  emit('**Блок:** ', c.block_name_ru, ' | **ID:** `', c.id, '`');
  emit();
  emit(c.description_ru);
  if (c.oge_task_types?.length) {
    emit();
    emit('Задания ОГЭ: ', c.oge_task_types.join(', '));
  }
  if (c.link) {
    emit();
    emit('Страница: ', SITE, c.link);
  }
  emit();
}

// ── Periodic Table Theory ─────────────────────────────────────────────────────

section('Периодический закон — тренды свойств');

const ptTheory = read('data-src/rules/periodic-table-theory.json');

if (ptTheory.general_principle_ru) {
  emit(ptTheory.general_principle_ru);
  emit();
}

for (const trend of ptTheory.property_trends ?? []) {
  emit('### ', trend.name_ru ?? trend.id);
  emit();
  if (trend.description_ru) emit(trend.description_ru);
  if (trend.period_trend_ru) emit('По периоду (→): ', trend.period_trend_ru);
  if (trend.group_trend_ru) emit('По группе (↓): ', trend.group_trend_ru);
  if (trend.note_ru) emit('Примечание: ', trend.note_ru);
  emit();
}

// ── Oxidation Rules ───────────────────────────────────────────────────────────

section('Правила определения степени окисления');

const oxData = read('data-src/rules/oxidation_rules.json');
for (const rule of oxData.rules ?? []) {
  emit('### ', rule.title_ru, ' [', rule.kind, ']');
  emit();
  emit(rule.description_ru);
  if (rule.examples?.length) {
    emit();
    emit('Примеры: ', rule.examples.join(', '));
  }
  if (rule.exceptions?.length) {
    emit('Исключения: ', rule.exceptions.join(', '));
  }
  emit();
}

// ── Bond Theory ───────────────────────────────────────────────────────────────

section('Типы химических связей');

const bondTheory = read('data-src/rules/bond_theory.json');
for (const bt of bondTheory.bond_types ?? []) {
  emit('### ', bt.name_ru, ' [', bt.id, ']');
  emit();
  emit(bt.description_ru);
  if (bt.rule_ru) { emit(); emit('Правило: ', bt.rule_ru); }
  if (bt.properties_ru) { emit(); emit('Свойства: ', bt.properties_ru); }
  if (bt.examples?.length) { emit(); emit('Примеры: ', bt.examples.join(', ')); }
  emit();
}

section('Типы кристаллических решёток');

for (const cs of bondTheory.crystal_structures ?? []) {
  emit('### ', cs.name_ru, ' [', cs.id, ']');
  emit();
  emit(cs.description_ru);
  if (cs.properties_ru) { emit(); emit('Свойства: ', cs.properties_ru); }
  if (cs.examples?.length) { emit(); emit('Примеры: ', cs.examples.join(', ')); }
  emit();
}

// ── Calculations Theory ───────────────────────────────────────────────────────

section('Расчёты по химии');

const calcModule = read('data-src/theory_modules/calculations.json');
for (const sec of calcModule.sections ?? []) {
  emit('### ', sec.title_ru);
  emit();
  for (const block of sec.blocks ?? []) {
    if (block.t === 'paragraph' && block.text_ru) {
      emit(block.text_ru);
      emit();
    } else if (block.t === 'equation' && block.text_ru) {
      emit('Формула: `', block.text_ru, '`');
      emit();
    } else if (block.t === 'rule_card' && block.text_ru) {
      emit('> ', block.text_ru);
      emit();
    } else if (block.t === 'ordered_list' && block.items_ru) {
      for (const item of block.items_ru) {
        emit('- ', item);
      }
      emit();
    } else if (block.t === 'example_block') {
      if (block.title_ru) emit('**Пример:** ', block.title_ru);
      if (block.text_ru) { emit(); emit(block.text_ru); }
      emit();
    }
  }
}

// ── All 118 Elements ──────────────────────────────────────────────────────────

section('Все химические элементы (118)');

emit('| Z | Символ | Название | Период | Группа | Тип | Электроотрицательность | Типичные СО |');
emit('|---|--------|----------|--------|--------|-----|------------------------|-------------|');

const elements = read('data-src/elements.json');
for (const el of elements) {
  const eo = el.electronegativity != null ? el.electronegativity.toFixed(2) : '—';
  const oxStates = el.typical_oxidation_states?.join(', ') ?? '—';
  const metalType = el.metal_type ?? '—';
  emit(
    '| ', el.Z,
    ' | [', el.symbol, '](', SITE, '/periodic-table/', el.symbol, '/) ',
    ' | ', el.name_ru, ' / ', el.name_en,
    ' | ', el.period,
    ' | ', el.group ?? '—',
    ' | ', metalType,
    ' | ', eo,
    ' | ', oxStates,
    ' |'
  );
}

emit();

// ── Element Detail Spotlight (key 14) ─────────────────────────────────────────

section('Детали ключевых элементов');

const KEY_ELEMENTS = ['H','O','C','N','Na','Cl','Fe','Cu','Au','Ca','Al','Si','P','S'];
for (const sym of KEY_ELEMENTS) {
  const el = elements.find(e => e.symbol === sym);
  if (!el) continue;
  emit('### ', el.symbol, ' — ', el.name_ru, ' / ', el.name_en);
  emit();
  emit('- **Атомный номер:** ', el.Z);
  emit('- **Атомная масса:** ', el.atomic_mass);
  emit('- **Период:** ', el.period, ', **Группа:** ', el.group ?? '—');
  emit('- **Тип:** ', el.metal_type ?? '—', ' (', el.element_group ?? '—', ')');
  if (el.electronegativity != null) emit('- **ЭО (Полинг):** ', el.electronegativity);
  if (el.typical_oxidation_states?.length) emit('- **Степени окисления:** ', el.typical_oxidation_states.join(', '));
  if (el.melting_point_C != null) emit('- **Т плавления:** ', el.melting_point_C, ' °C');
  if (el.boiling_point_C != null) emit('- **Т кипения:** ', el.boiling_point_C, ' °C');
  if (el.electron_config) emit('- **Электронная конфигурация:** ', el.electron_config);
  emit('- **Страница:** ', SITE, '/periodic-table/', el.symbol, '/');
  emit();
}

// ── Footer ────────────────────────────────────────────────────────────────────

emit('---');
emit();
emit('Сгенерировано автоматически из data-src/ при сборке сайта.');
emit('Краткий индекс: ', SITE, '/llms.txt');
emit('Sitemap: ', SITE, '/sitemap.xml');

// ── Write ──────────────────────────────────────────────────────────────────────

const content = lines.join('\n');
writeFileSync(OUT, content, 'utf8');
console.log(`✓ llms-full.txt generated: ${(content.length / 1024).toFixed(1)} KB`);
