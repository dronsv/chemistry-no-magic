import { describe, it, expect } from 'vitest';
import { decline, detectDeclClass, resolveForm, withPrep } from '../decline';

describe('detectDeclClass', () => {
  it('detects m:hard', () => {
    expect(detectDeclClass('водород')).toBe('m:hard');
    expect(detectDeclClass('цвет')).toBe('m:hard');
    expect(detectDeclClass('запах')).toBe('m:hard');
    expect(detectDeclClass('бром')).toBe('m:hard');
  });

  it('detects m:-ий', () => {
    expect(detectDeclClass('натрий')).toBe('m:-ий');
    expect(detectDeclClass('калий')).toBe('m:-ий');
    expect(detectDeclClass('алюминий')).toBe('m:-ий');
    expect(detectDeclClass('барий')).toBe('m:-ий');
  });

  it('detects m:-тель', () => {
    expect(detectDeclClass('окислитель')).toBe('m:-тель');
    expect(detectDeclClass('восстановитель')).toBe('m:-тель');
  });

  it('detects m:-ец', () => {
    expect(detectDeclClass('марганец')).toBe('m:-ец');
    expect(detectDeclClass('свинец')).toBe('m:-ец');
  });

  it('detects f:-сть', () => {
    expect(detectDeclClass('плотность')).toBe('f:-сть');
    expect(detectDeclClass('горючесть')).toBe('f:-сть');
    expect(detectDeclClass('электроотрицательность')).toBe('f:-сть');
  });

  it('detects f:-а', () => {
    expect(detectDeclClass('сера')).toBe('f:-а');
    expect(detectDeclClass('платина')).toBe('f:-а');
    expect(detectDeclClass('кислота')).toBe('f:-а');
  });

  it('detects f:-ь', () => {
    expect(detectDeclClass('медь')).toBe('f:-ь');
    expect(detectDeclClass('соль')).toBe('f:-ь');
    expect(detectDeclClass('щёлочь')).toBe('f:-ь');
  });

  it('detects n:-о', () => {
    expect(detectDeclClass('железо')).toBe('n:-о');
    expect(detectDeclClass('серебро')).toBe('n:-о');
    expect(detectDeclClass('золото')).toBe('n:-о');
  });

  it('detects n:-ие', () => {
    expect(detectDeclClass('основание')).toBe('n:-ие');
    expect(detectDeclClass('возрастание')).toBe('n:-ие');
  });
});

describe('decline — parity with morphology.json elements', () => {
  // Verify gen form matches morphology.json for each element declension class

  it.each([
    // m:hard elements
    ['водород', 'водорода'],
    ['бор', 'бора'],
    ['углерод', 'углерода'],
    ['азот', 'азота'],
    ['кислород', 'кислорода'],
    ['фтор', 'фтора'],
    ['неон', 'неона'],
    ['фосфор', 'фосфора'],
    ['хлор', 'хлора'],
    ['аргон', 'аргона'],
    ['титан', 'титана'],
    ['хром', 'хрома'],
    ['кобальт', 'кобальта'],
    ['никель', 'никеля'],
    ['цинк', 'цинка'],
    ['мышьяк', 'мышьяка'],
    ['селен', 'селена'],
    ['бром', 'брома'],
    ['криптон', 'криптона'],
    ['йод', 'йода'],
  ])('%s → gen: %s', (lemma, expectedGen) => {
    const forms = decline(lemma);
    expect(forms).not.toBeNull();
    expect(forms!.gen).toBe(expectedGen);
  });

  it.each([
    // m:-ий elements
    ['гелий', 'гелия'],
    ['литий', 'лития'],
    ['бериллий', 'бериллия'],
    ['натрий', 'натрия'],
    ['магний', 'магния'],
    ['алюминий', 'алюминия'],
    ['кремний', 'кремния'],
    ['калий', 'калия'],
    ['кальций', 'кальция'],
    ['скандий', 'скандия'],
    ['ванадий', 'ванадия'],
    ['галлий', 'галлия'],
    ['германий', 'германия'],
    ['барий', 'бария'],
  ])('%s → gen: %s', (lemma, expectedGen) => {
    const forms = decline(lemma, 'm:-ий');
    expect(forms!.gen).toBe(expectedGen);
  });

  it.each([
    // m:-ец elements (fleeting vowel)
    ['марганец', 'марганца'],
    ['свинец', 'свинца'],
  ])('%s → gen: %s', (lemma, expectedGen) => {
    const forms = decline(lemma, 'm:-ец');
    expect(forms!.gen).toBe(expectedGen);
  });

  it.each([
    // f:-а elements
    ['сера', 'серы'],
    ['платина', 'платины'],
  ])('%s → gen: %s', (lemma, expectedGen) => {
    const forms = decline(lemma);
    expect(forms!.gen).toBe(expectedGen);
  });

  it.each([
    // n:-о elements
    ['железо', 'железа'],
    ['серебро', 'серебра'],
    ['олово', 'олова'],
    ['золото', 'золота'],
  ])('%s → gen: %s', (lemma, expectedGen) => {
    const forms = decline(lemma);
    expect(forms!.gen).toBe(expectedGen);
  });

  it('f:-ь — медь → меди', () => {
    const forms = decline('медь');
    expect(forms!.gen).toBe('меди');
  });
});

describe('decline — parity with concept overlay forms', () => {
  // Single-word concepts: verify all 5 cases match existing overlay data

  it('m:hard — оксид (all singular cases)', () => {
    const f = decline('оксид')!;
    expect(f.nom).toBe('оксид');
    expect(f.gen).toBe('оксида');
    expect(f.dat).toBe('оксиду');
    expect(f.ins).toBe('оксидом');
    expect(f.prep).toBe('оксиде');
    // plurals
    expect(f.pl_nom).toBe('оксиды');
    expect(f.pl_gen).toBe('оксидов');
    expect(f.pl_dat).toBe('оксидам');
    expect(f.pl_ins).toBe('оксидами');
    expect(f.pl_prep).toBe('оксидах');
  });

  it('f:-а — кислота (all cases)', () => {
    const f = decline('кислота')!;
    expect(f.nom).toBe('кислота');
    expect(f.gen).toBe('кислоты');
    expect(f.dat).toBe('кислоте');
    expect(f.ins).toBe('кислотой');
    expect(f.prep).toBe('кислоте');
    expect(f.pl_nom).toBe('кислоты');
    expect(f.pl_gen).toBe('кислот');
    expect(f.pl_dat).toBe('кислотам');
    expect(f.pl_ins).toBe('кислотами');
    expect(f.pl_prep).toBe('кислотах');
  });

  it('n:-ие — основание (all cases)', () => {
    const f = decline('основание', 'n:-ие')!;
    expect(f.nom).toBe('основание');
    expect(f.gen).toBe('основания');
    expect(f.dat).toBe('основанию');
    expect(f.ins).toBe('основанием');
    expect(f.prep).toBe('основании');
    expect(f.pl_nom).toBe('основания');
    expect(f.pl_gen).toBe('оснований');
    expect(f.pl_dat).toBe('основаниям');
    expect(f.pl_ins).toBe('основаниями');
    expect(f.pl_prep).toBe('основаниях');
  });

  it('f:-ь — соль (all cases)', () => {
    const f = decline('соль')!;
    expect(f.nom).toBe('соль');
    expect(f.gen).toBe('соли');
    expect(f.dat).toBe('соли');
    expect(f.ins).toBe('солью');
    expect(f.prep).toBe('соли');
    expect(f.pl_nom).toBe('соли');
    expect(f.pl_gen).toBe('солей');
    expect(f.pl_dat).toBe('солям');
    expect(f.pl_ins).toBe('солями');
    expect(f.pl_prep).toBe('солях');
  });

  it('f:-ь — щёлочь (all cases)', () => {
    const f = decline('щёлочь')!;
    expect(f.nom).toBe('щёлочь');
    expect(f.gen).toBe('щёлочи');
    expect(f.dat).toBe('щёлочи');
    expect(f.ins).toBe('щёлочью');
    expect(f.prep).toBe('щёлочи');
    expect(f.pl_nom).toBe('щёлочи');
    expect(f.pl_gen).toBe('щёлочей');
  });

  it('m:-тель — окислитель (all cases)', () => {
    const f = decline('окислитель')!;
    expect(f.nom).toBe('окислитель');
    expect(f.gen).toBe('окислителя');
    expect(f.dat).toBe('окислителю');
    expect(f.ins).toBe('окислителем');
    expect(f.prep).toBe('окислителе');
  });

  it('m:-тель — восстановитель (all cases)', () => {
    const f = decline('восстановитель')!;
    expect(f.gen).toBe('восстановителя');
    expect(f.dat).toBe('восстановителю');
    expect(f.ins).toBe('восстановителем');
    expect(f.prep).toBe('восстановителе');
  });

  it('f:-сть — плотность (all cases)', () => {
    const f = decline('плотность')!;
    expect(f.gen).toBe('плотности');
    expect(f.dat).toBe('плотности');
    expect(f.ins).toBe('плотностью');
    expect(f.prep).toBe('плотности');
  });

  it('f:-сть — горючесть', () => {
    const f = decline('горючесть')!;
    expect(f.gen).toBe('горючести');
    expect(f.ins).toBe('горючестью');
  });

  it('m:hard — цвет (all cases)', () => {
    const f = decline('цвет')!;
    expect(f.gen).toBe('цвета');
    expect(f.dat).toBe('цвету');
    expect(f.ins).toBe('цветом');
    expect(f.prep).toBe('цвете');
  });

  it('m:hard — запах (all cases)', () => {
    const f = decline('запах')!;
    expect(f.gen).toBe('запаха');
    expect(f.dat).toBe('запаху');
    expect(f.ins).toBe('запахом');
    expect(f.prep).toBe('запахе');
  });

  it('m:hard — галоген (all cases + plural)', () => {
    const f = decline('галоген')!;
    expect(f.gen).toBe('галогена');
    expect(f.pl_nom).toBe('галогены');
    expect(f.pl_gen).toBe('галогенов');
    expect(f.pl_dat).toBe('галогенам');
    expect(f.pl_ins).toBe('галогенами');
    expect(f.pl_prep).toBe('галогенах');
  });

  it('m:-ий — кальций (plural)', () => {
    const f = decline('кальций', 'm:-ий')!;
    expect(f.pl_nom).toBe('кальции');
  });

  it('n:-ие — возрастание', () => {
    const f = decline('возрастание', 'n:-ие')!;
    expect(f.gen).toBe('возрастания');
  });

  it('n:-ие — убывание', () => {
    const f = decline('убывание', 'n:-ие')!;
    expect(f.gen).toBe('убывания');
  });
});

describe('decline — overrides', () => {
  it('applies explicit override for irregular form', () => {
    const f = decline('щёлочь', 'f:-ь', { pl_gen: 'щёлочей' })!;
    expect(f.pl_gen).toBe('щёлочей'); // same as rule in this case
  });

  it('override trumps rule', () => {
    const f = decline('соль', 'f:-ь', { pl_gen: 'солей' })!;
    expect(f.pl_gen).toBe('солей');
  });
});

describe('decline — spelling rules', () => {
  it('к + ы → ки (цинк → pl_nom цинки)', () => {
    const f = decline('цинк')!;
    expect(f.pl_nom).toBe('цинки');
  });

  it('мышьяк → pl_nom мышьяки', () => {
    const f = decline('мышьяк')!;
    expect(f.pl_nom).toBe('мышьяки');
  });
});

describe('resolveForm', () => {
  it('returns explicit form first', () => {
    expect(resolveForm('соль', 'gen', 'f:-ь', { gen: 'соли-custom' })).toBe('соли-custom');
  });

  it('falls back to decline()', () => {
    expect(resolveForm('оксид', 'gen')).toBe('оксида');
  });

  it('falls back to lemma for unknown form', () => {
    expect(resolveForm('оксид', 'vocative')).toBe('оксид');
  });

  it('falls back to lemma for unknown class', () => {
    expect(resolveForm('xyz', 'gen', 'unknown')).toBe('xyz');
  });
});

describe('withPrep', () => {
  it('об + vowel-initial', () => {
    expect(withPrep('окислителе')).toBe('об окислителе');
    expect(withPrep('оксиде')).toBe('об оксиде');
    expect(withPrep('основании')).toBe('об основании');
    expect(withPrep('атоме')).toBe('об атоме');
  });

  it('о + consonant-initial', () => {
    expect(withPrep('плотности')).toBe('о плотности');
    expect(withPrep('запахе')).toBe('о запахе');
    expect(withPrep('цвете')).toBe('о цвете');
    expect(withPrep('соли')).toBe('о соли');
  });
});
