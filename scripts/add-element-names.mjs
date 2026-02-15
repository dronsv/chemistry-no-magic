/**
 * Adds name_en (English) and name_latin (Latin/scientific) fields
 * to every element in data-src/elements.json, matched by Z number.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const elementsPath = resolve(__dirname, '..', 'data-src', 'elements.json');

// Map of Z -> [name_en, name_latin] for all 118 elements
const namesByZ = new Map([
  [1, ['Hydrogen', 'Hydrogenium']],
  [2, ['Helium', 'Helium']],
  [3, ['Lithium', 'Lithium']],
  [4, ['Beryllium', 'Beryllium']],
  [5, ['Boron', 'Borum']],
  [6, ['Carbon', 'Carboneum']],
  [7, ['Nitrogen', 'Nitrogenium']],
  [8, ['Oxygen', 'Oxygenium']],
  [9, ['Fluorine', 'Fluorum']],
  [10, ['Neon', 'Neon']],
  [11, ['Sodium', 'Natrium']],
  [12, ['Magnesium', 'Magnesium']],
  [13, ['Aluminium', 'Aluminium']],
  [14, ['Silicon', 'Silicium']],
  [15, ['Phosphorus', 'Phosphorus']],
  [16, ['Sulfur', 'Sulphur']],
  [17, ['Chlorine', 'Chlorum']],
  [18, ['Argon', 'Argon']],
  [19, ['Potassium', 'Kalium']],
  [20, ['Calcium', 'Calcium']],
  [21, ['Scandium', 'Scandium']],
  [22, ['Titanium', 'Titanium']],
  [23, ['Vanadium', 'Vanadium']],
  [24, ['Chromium', 'Chromium']],
  [25, ['Manganese', 'Manganum']],
  [26, ['Iron', 'Ferrum']],
  [27, ['Cobalt', 'Cobaltum']],
  [28, ['Nickel', 'Niccolum']],
  [29, ['Copper', 'Cuprum']],
  [30, ['Zinc', 'Zincum']],
  [31, ['Gallium', 'Gallium']],
  [32, ['Germanium', 'Germanium']],
  [33, ['Arsenic', 'Arsenicum']],
  [34, ['Selenium', 'Selenium']],
  [35, ['Bromine', 'Bromum']],
  [36, ['Krypton', 'Krypton']],
  [37, ['Rubidium', 'Rubidium']],
  [38, ['Strontium', 'Strontium']],
  [39, ['Yttrium', 'Yttrium']],
  [40, ['Zirconium', 'Zirconium']],
  [41, ['Niobium', 'Niobium']],
  [42, ['Molybdenum', 'Molybdaenum']],
  [43, ['Technetium', 'Technetium']],
  [44, ['Ruthenium', 'Ruthenium']],
  [45, ['Rhodium', 'Rhodium']],
  [46, ['Palladium', 'Palladium']],
  [47, ['Silver', 'Argentum']],
  [48, ['Cadmium', 'Cadmium']],
  [49, ['Indium', 'Indium']],
  [50, ['Tin', 'Stannum']],
  [51, ['Antimony', 'Stibium']],
  [52, ['Tellurium', 'Tellurium']],
  [53, ['Iodine', 'Iodum']],
  [54, ['Xenon', 'Xenon']],
  [55, ['Caesium', 'Caesium']],
  [56, ['Barium', 'Barium']],
  [57, ['Lanthanum', 'Lanthanum']],
  [58, ['Cerium', 'Cerium']],
  [59, ['Praseodymium', 'Praseodymium']],
  [60, ['Neodymium', 'Neodymium']],
  [61, ['Promethium', 'Promethium']],
  [62, ['Samarium', 'Samarium']],
  [63, ['Europium', 'Europium']],
  [64, ['Gadolinium', 'Gadolinium']],
  [65, ['Terbium', 'Terbium']],
  [66, ['Dysprosium', 'Dysprosium']],
  [67, ['Holmium', 'Holmium']],
  [68, ['Erbium', 'Erbium']],
  [69, ['Thulium', 'Thulium']],
  [70, ['Ytterbium', 'Ytterbium']],
  [71, ['Lutetium', 'Lutetium']],
  [72, ['Hafnium', 'Hafnium']],
  [73, ['Tantalum', 'Tantalum']],
  [74, ['Tungsten', 'Wolframium']],
  [75, ['Rhenium', 'Rhenium']],
  [76, ['Osmium', 'Osmium']],
  [77, ['Iridium', 'Iridium']],
  [78, ['Platinum', 'Platinum']],
  [79, ['Gold', 'Aurum']],
  [80, ['Mercury', 'Hydrargyrum']],
  [81, ['Thallium', 'Thallium']],
  [82, ['Lead', 'Plumbum']],
  [83, ['Bismuth', 'Bismuthum']],
  [84, ['Polonium', 'Polonium']],
  [85, ['Astatine', 'Astatium']],
  [86, ['Radon', 'Radon']],
  [87, ['Francium', 'Francium']],
  [88, ['Radium', 'Radium']],
  [89, ['Actinium', 'Actinium']],
  [90, ['Thorium', 'Thorium']],
  [91, ['Protactinium', 'Protactinium']],
  [92, ['Uranium', 'Uranium']],
  [93, ['Neptunium', 'Neptunium']],
  [94, ['Plutonium', 'Plutonium']],
  [95, ['Americium', 'Americium']],
  [96, ['Curium', 'Curium']],
  [97, ['Berkelium', 'Berkelium']],
  [98, ['Californium', 'Californium']],
  [99, ['Einsteinium', 'Einsteinium']],
  [100, ['Fermium', 'Fermium']],
  [101, ['Mendelevium', 'Mendelevium']],
  [102, ['Nobelium', 'Nobelium']],
  [103, ['Lawrencium', 'Lawrencium']],
  [104, ['Rutherfordium', 'Rutherfordium']],
  [105, ['Dubnium', 'Dubnium']],
  [106, ['Seaborgium', 'Seaborgium']],
  [107, ['Bohrium', 'Bohrium']],
  [108, ['Hassium', 'Hassium']],
  [109, ['Meitnerium', 'Meitnerium']],
  [110, ['Darmstadtium', 'Darmstadtium']],
  [111, ['Roentgenium', 'Roentgenium']],
  [112, ['Copernicium', 'Copernicium']],
  [113, ['Nihonium', 'Nihonium']],
  [114, ['Flerovium', 'Flerovium']],
  [115, ['Moscovium', 'Moscovium']],
  [116, ['Livermorium', 'Livermorium']],
  [117, ['Tennessine', 'Tennessium']],
  [118, ['Oganesson', 'Oganesson']],
]);

// Read the file
const raw = readFileSync(elementsPath, 'utf-8');
const elements = JSON.parse(raw);

let updated = 0;
let missing = 0;

for (const el of elements) {
  const names = namesByZ.get(el.Z);
  if (names) {
    // Insert name_en and name_latin right after name_ru
    // by rebuilding the object with desired key order
    const ordered = {};
    for (const [key, value] of Object.entries(el)) {
      ordered[key] = value;
      if (key === 'name_ru') {
        ordered.name_en = names[0];
        ordered.name_latin = names[1];
      }
    }
    // Copy ordered keys back into el
    for (const key of Object.keys(el)) {
      delete el[key];
    }
    Object.assign(el, ordered);
    updated++;
  } else {
    console.warn(`No name data for Z=${el.Z} (${el.symbol})`);
    missing++;
  }
}

// Write back with 2-space indent and trailing newline
writeFileSync(elementsPath, JSON.stringify(elements, null, 2) + '\n', 'utf-8');

console.log(`Done. Updated ${updated} elements. Missing: ${missing}.`);
