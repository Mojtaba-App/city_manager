const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';

/** Convert Latin digits 0-9 to Persian ۰-۹ (leaves other chars unchanged). */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => PERSIAN[Number(d)]);
}

/** Convert Persian ۰-۹ and Arabic-Indic ٠-٩ digits to Latin 0-9. */
export function toLatinDigits(input: string | number): string {
  return String(input)
    .replace(/[۰-۹]/g, (d) => String(PERSIAN.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d)));
}

/**
 * Normalize a search string for digit-agnostic matching:
 * Persian/Arabic-Indic digits → Latin, then lowercased.
 */
export function normalizeDigitsForSearch(input: string): string {
  return toLatinDigits(input).toLowerCase();
}
