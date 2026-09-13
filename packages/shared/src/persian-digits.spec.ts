import { normalizeDigitsForSearch, toLatinDigits, toPersianDigits } from './persian-digits';

describe('persian-digits', () => {
  it('converts Latin digits to Persian', () => {
    expect(toPersianDigits('ملاشیه 11')).toBe('ملاشیه ۱۱');
    expect(toPersianDigits('غرب007')).toBe('غرب۰۰۷');
  });

  it('converts Persian and Arabic-Indic digits to Latin', () => {
    expect(toLatinDigits('ملاشیه ۱۱')).toBe('ملاشیه 11');
    expect(toLatinDigits('کد ٠١٢')).toBe('کد 012');
  });

  it('normalizes mixed digit scripts for search', () => {
    expect(normalizeDigitsForSearch('ملاشیه ۱۱')).toBe('ملاشیه 11');
    expect(normalizeDigitsForSearch('Malashieh 11')).toBe('malashieh 11');
    expect(
      normalizeDigitsForSearch('ملاشیه 11').includes(
        normalizeDigitsForSearch('۱۱'),
      ),
    ).toBe(true);
  });
});
