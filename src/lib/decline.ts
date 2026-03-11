/**
 * Rule-based Russian noun declension.
 *
 * Given a lemma (nominative singular) and a declension class,
 * produces all case forms (singular + plural).
 *
 * Multi-word phrases are NOT handled here — they keep explicit forms
 * in the overlay data.
 */

export interface DeclensionForms {
  /** Singular cases */
  nom: string;
  gen: string;
  dat: string;
  ins: string;
  prep: string;
  /** Plural cases */
  pl_nom: string;
  pl_gen: string;
  pl_dat: string;
  pl_ins: string;
  pl_prep: string;
}

interface DeclRule {
  /** Regex to test whether a lemma belongs to this class */
  match: RegExp;
  /** How many chars to strip from end to get the stem */
  strip: number;
  /** Singular endings: gen, dat, ins, prep */
  sg: { gen: string; dat: string; ins: string; prep: string };
  /** Plural endings: nom, gen, dat, ins, prep */
  pl: { nom: string; gen: string; dat: string; ins: string; prep: string };
}

/**
 * Declension classes ordered by specificity (most specific first).
 * The first matching rule wins.
 */
const RU_CLASSES: Record<string, DeclRule> = {
  // === Masculine ===
  'm:-тель': {
    match: /тель$/,
    strip: 4, // strip "тель"
    sg: { gen: 'теля', dat: 'телю', ins: 'телем', prep: 'теле' },
    pl: { nom: 'тели', gen: 'телей', dat: 'телям', ins: 'телями', prep: 'телях' },
  },
  'm:-ец': {
    // марганец → марганца (fleeting vowel)
    match: /ец$/,
    strip: 2, // strip "ец"
    sg: { gen: 'ца', dat: 'цу', ins: 'цом', prep: 'це' },
    pl: { nom: 'цы', gen: 'цов', dat: 'цам', ins: 'цами', prep: 'цах' },
  },
  'm:-ий': {
    match: /ий$/,
    strip: 2, // strip "ий"
    sg: { gen: 'ия', dat: 'ию', ins: 'ием', prep: 'ии' },
    pl: { nom: 'ии', gen: 'иев', dat: 'иям', ins: 'иями', prep: 'иях' },
  },
  'm:-ель': {
    // masculine soft-stem: никель → никеля
    match: /[^т]ель$/,
    strip: 3, // strip "ель"
    sg: { gen: 'еля', dat: 'елю', ins: 'елем', prep: 'еле' },
    pl: { nom: 'ели', gen: 'елей', dat: 'елям', ins: 'елями', prep: 'елях' },
  },
  'm:hard': {
    match: /[бвгджзклмнпрстфхцчшщъ]$/,
    strip: 0,
    sg: { gen: 'а', dat: 'у', ins: 'ом', prep: 'е' },
    pl: { nom: 'ы', gen: 'ов', dat: 'ам', ins: 'ами', prep: 'ах' },
  },
  // === Feminine ===
  'f:-сть': {
    // feminine abstract nouns: плотность, горючесть, устойчивость
    match: /[ое]сть$/,
    strip: 3, // strip "сть"
    sg: { gen: 'сти', dat: 'сти', ins: 'стью', prep: 'сти' },
    pl: { nom: 'сти', gen: 'стей', dat: 'стям', ins: 'стями', prep: 'стях' },
  },
  'f:-а': {
    match: /а$/,
    strip: 1,
    sg: { gen: 'ы', dat: 'е', ins: 'ой', prep: 'е' },
    pl: { nom: 'ы', gen: '', dat: 'ам', ins: 'ами', prep: 'ах' },
  },
  'f:-я': {
    match: /я$/,
    strip: 1,
    sg: { gen: 'и', dat: 'е', ins: 'ей', prep: 'е' },
    pl: { nom: 'и', gen: 'ь', dat: 'ям', ins: 'ями', prep: 'ях' },
  },
  'f:-ь': {
    match: /ь$/,
    strip: 1,
    sg: { gen: 'и', dat: 'и', ins: 'ью', prep: 'и' },
    pl: { nom: 'и', gen: 'ей', dat: 'ям', ins: 'ями', prep: 'ях' },
  },
  // === Neuter ===
  'n:-ие': {
    match: /ие$/,
    strip: 2, // strip "ие"
    sg: { gen: 'ия', dat: 'ию', ins: 'ием', prep: 'ии' },
    pl: { nom: 'ия', gen: 'ий', dat: 'иям', ins: 'иями', prep: 'иях' },
  },
  'n:-о': {
    match: /о$/,
    strip: 1,
    sg: { gen: 'а', dat: 'у', ins: 'ом', prep: 'е' },
    pl: { nom: 'а', gen: '', dat: 'ам', ins: 'ами', prep: 'ах' },
  },
};

/** Order matters — check specific patterns before generic ones */
const RU_CLASS_ORDER: string[] = [
  'm:-тель', 'm:-ель', 'm:-ец', 'm:-ий', 'm:hard',
  'f:-сть', 'f:-а', 'f:-я', 'f:-ь',
  'n:-ие', 'n:-о',
];

const VOWELS = /^[аеёиоуыэюяАЕЁИОУЫЭЮЯ]/;

/** Russian spelling rule: no ы after к, г, х, ж, ч, ш, щ */
function applySpellingRules(stem: string, ending: string): string {
  if (ending.startsWith('ы') && /[кгхжчшщ]$/.test(stem)) {
    return stem + 'и' + ending.slice(1);
  }
  return stem + ending;
}

/**
 * Auto-detect declension class from lemma shape.
 * Returns class key or null if no match.
 */
export function detectDeclClass(lemma: string): string | null {
  for (const cls of RU_CLASS_ORDER) {
    if (RU_CLASSES[cls].match.test(lemma)) return cls;
  }
  return null;
}

/**
 * Decline a Russian noun.
 *
 * @param lemma - Nominative singular form
 * @param declClass - Declension class key (e.g., 'm:hard', 'f:-ость').
 *   If omitted, auto-detected from lemma shape.
 * @param overrides - Explicit form overrides for irregular cases
 * @returns All case forms, or null if class not found
 */
export function decline(
  lemma: string,
  declClass?: string | null,
  overrides?: Partial<DeclensionForms>,
): DeclensionForms | null {
  const cls = declClass ?? detectDeclClass(lemma);
  if (!cls) return null;

  const rule = RU_CLASSES[cls];
  if (!rule) return null;

  const stem = lemma.slice(0, lemma.length - rule.strip);

  const forms: DeclensionForms = {
    nom: lemma,
    gen: applySpellingRules(stem, rule.sg.gen),
    dat: applySpellingRules(stem, rule.sg.dat),
    ins: applySpellingRules(stem, rule.sg.ins),
    prep: applySpellingRules(stem, rule.sg.prep),
    pl_nom: applySpellingRules(stem, rule.pl.nom),
    pl_gen: applySpellingRules(stem, rule.pl.gen),
    pl_dat: applySpellingRules(stem, rule.pl.dat),
    pl_ins: applySpellingRules(stem, rule.pl.ins),
    pl_prep: applySpellingRules(stem, rule.pl.prep),
  };

  // Apply explicit overrides
  if (overrides) {
    for (const [k, v] of Object.entries(overrides)) {
      if (v !== undefined) {
        (forms as Record<string, string>)[k] = v;
      }
    }
  }

  return forms;
}

/**
 * Resolve a single case form, with fallback chain:
 * 1. Explicit override (forms map)
 * 2. Rule-based declension
 * 3. Lemma (nominative)
 */
export function resolveForm(
  lemma: string,
  form: string,
  declClass?: string | null,
  explicitForms?: Record<string, string>,
): string {
  // 1. Explicit override
  if (explicitForms?.[form]) return explicitForms[form];

  // 2. Rule-based
  const declined = decline(lemma, declClass);
  if (declined && form in declined) return (declined as Record<string, string>)[form];

  // 3. Fallback
  return lemma;
}

/**
 * Add preposition "о"/"об" before the prepositional form.
 * "об" before vowel-initial words, "о" otherwise.
 */
export function withPrep(prepForm: string): string {
  return VOWELS.test(prepForm) ? `об ${prepForm}` : `о ${prepForm}`;
}
