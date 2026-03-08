/**
 * patch-remaining-substance-names.mjs
 *
 * One-shot: patches EN/PL/ES substance overlays with names for
 * oxides, acids, basic salts, and hydrides that cannot be derived
 * from ion morphology (≠2 ions, or class=acid, or 0 ions).
 *
 * Only adds missing names — never overwrites existing ones.
 * Usage: node scripts/patch-remaining-substance-names.mjs [--dry-run]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_SRC = join(__dirname, '..', 'data-src');
const DRY_RUN = process.argv.includes('--dry-run');

const NAMES = {
  en: {
    // Oxides
    bao:    'Barium oxide',
    beo:    'Beryllium oxide',
    co:     'Carbon monoxide',
    cr2o3:  'Chromium(III) oxide',
    cro3:   'Chromium(VI) oxide',
    cu2o:   'Copper(I) oxide',
    k2o:    'Potassium oxide',
    li2o:   'Lithium oxide',
    mn2o7:  'Manganese(VII) oxide',
    n2o:    'Dinitrogen monoxide',
    n2o5:   'Dinitrogen pentoxide',
    no:     'Nitrogen monoxide',
    p2o5:   'Phosphorus(V) oxide',
    pbo:    'Lead(II) oxide',
    sno:    'Tin(II) oxide',
    // Hydride
    nah:    'Sodium hydride',
    // Acids
    h2cr2o7: 'Dichromic acid',
    h2cro4:  'Chromic acid',
    h2sio3:  'Silicic acid',
    h2so3:   'Sulfurous acid',
    hbr:     'Hydrobromic acid',
    hf:      'Hydrofluoric acid',
    hi:      'Hydroiodic acid',
    hmno4:   'Permanganic acid',
    hno2:    'Nitrous acid',
    // Basic salts
    _cuoh_2co3: 'Basic copper(II) carbonate',
    aloh_no3_2: 'Aluminum hydroxynitrate',
    cuohcl:     'Copper(II) hydroxychloride',
    feohcl:     'Iron(II) hydroxychloride',
  },
  pl: {
    // Oxides
    bao:    'Tlenek baru',
    beo:    'Tlenek berylu',
    co:     'Tlenek węgla(II)',
    cr2o3:  'Tlenek chromu(III)',
    cro3:   'Tlenek chromu(VI)',
    cu2o:   'Tlenek miedzi(I)',
    k2o:    'Tlenek potasu',
    li2o:   'Tlenek litu',
    mn2o7:  'Tlenek manganu(VII)',
    n2o:    'Tlenek azotu(I)',
    n2o5:   'Tlenek azotu(V)',
    no:     'Tlenek azotu(II)',
    p2o5:   'Tlenek fosforu(V)',
    pbo:    'Tlenek ołowiu(II)',
    sno:    'Tlenek cyny(II)',
    // Hydride
    nah:    'Wodorek sodu',
    // Acids
    h2cr2o7: 'Kwas dichromowy(VI)',
    h2cro4:  'Kwas chromowy(VI)',
    h2sio3:  'Kwas krzemowy(IV)',
    h2so3:   'Kwas siarkowy(IV)',
    hbr:     'Kwas bromowodorowy',
    hf:      'Kwas fluorowodorowy',
    hi:      'Kwas jodowodorowy',
    hmno4:   'Kwas manganowy(VII)',
    hno2:    'Kwas azotowy(III)',
    // Basic salts (already has _cuoh_2co3, aloh_no3_2 from previous work)
    cuohcl:  'Zasadowy chlorek miedzi(II)',
    feohcl:  'Zasadowy chlorek żelaza(II)',
  },
  es: {
    // Oxides
    bao:    'Óxido de bario',
    beo:    'Óxido de berilio',
    co:     'Monóxido de carbono',
    cr2o3:  'Óxido de cromo(III)',
    cro3:   'Óxido de cromo(VI)',
    cu2o:   'Óxido de cobre(I)',
    k2o:    'Óxido de potasio',
    li2o:   'Óxido de litio',
    mn2o7:  'Óxido de manganeso(VII)',
    n2o:    'Óxido de nitrógeno(I)',
    n2o5:   'Óxido de nitrógeno(V)',
    no:     'Óxido de nitrógeno(II)',
    p2o5:   'Óxido de fósforo(V)',
    pbo:    'Óxido de plomo(II)',
    sno:    'Óxido de estaño(II)',
    // Hydride
    nah:    'Hidruro de sodio',
    // Acids
    h2cr2o7: 'Ácido dicromo',
    h2cro4:  'Ácido crómico',
    h2sio3:  'Ácido silícico',
    h2so3:   'Ácido sulfuroso',
    hbr:     'Ácido bromhídrico',
    hf:      'Ácido fluorhídrico',
    hi:      'Ácido yodhídrico',
    hmno4:   'Ácido permangánico',
    hno2:    'Ácido nitroso',
    // Basic salts
    _cuoh_2co3: 'Carbonato básico de cobre(II)',
    aloh_no3_2: 'Nitrato básico de aluminio',
    cuohcl:     'Cloruro básico de cobre(II)',
    feohcl:     'Cloruro básico de hierro(II)',
  },
};

for (const [locale, names] of Object.entries(NAMES)) {
  const overlayPath = join(DATA_SRC, 'translations', locale, 'substances.json');
  const overlay = JSON.parse(readFileSync(overlayPath, 'utf-8'));

  let added = 0;
  for (const [id, name] of Object.entries(names)) {
    if (!overlay[id]) {
      overlay[id] = { name };
      added++;
    } else if (!overlay[id].name) {
      overlay[id].name = name;
      added++;
    }
    // already has a name → skip
  }

  console.log(`${locale.toUpperCase()}: +${added} names`);

  if (!DRY_RUN) {
    writeFileSync(overlayPath, JSON.stringify(overlay, null, 2) + '\n', 'utf-8');
  }
}

if (DRY_RUN) console.log('\n[dry-run] No files written.');
