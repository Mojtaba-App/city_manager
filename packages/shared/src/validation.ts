import type { FormDefinitionSchema } from './case-types';
import {
  FIELD_KEY_PATTERN,
  isFormFieldType,
} from './case-types';
import { isMunicipalDistrict, isNeighborhoodStatus } from './regeneration-types';
import { toLatinDigits } from './persian-digits';

export const NATIONAL_ID_REGEX = /^\d{10}$/;
export const PHONE_MIN_DIGITS = 10;
/** موبایل ایران ذخیره‌شده به صورت 09xxxxxxxxx */
export const IRAN_MOBILE_REGEX = /^09\d{9}$/;

export function isEmptyValue(value: unknown): boolean {
  return value == null || String(value).trim() === '';
}

export function validateRequired(value: unknown, label: string): string | undefined {
  if (isEmptyValue(value)) return `${label} الزامی است`;
  return undefined;
}

export function validateNationalId(value: unknown, required = false): string | undefined {
  if (isEmptyValue(value)) {
    return required ? 'کد ملی الزامی است' : undefined;
  }
  const digits = String(value).replace(/\D/g, '');
  if (!NATIONAL_ID_REGEX.test(digits)) return 'کد ملی باید ۱۰ رقم باشد';
  return undefined;
}

export function phoneDigits(value: unknown): string {
  return toLatinDigits(String(value ?? '')).replace(/\D/g, '');
}

/** موبایل معتبر ایران به 09xxxxxxxxx؛ در غیر این صورت undefined */
export function toIranMobile(value: unknown): string | undefined {
  if (isEmptyValue(value)) return undefined;
  const digits = phoneDigits(value);
  if (IRAN_MOBILE_REGEX.test(digits)) return digits;
  if (/^989\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^00989\d{9}$/.test(digits)) return `0${digits.slice(4)}`;
  if (/^9\d{9}$/.test(digits)) return `0${digits}`;
  return undefined;
}

export function validatePhone(value: unknown, required = false): string | undefined {
  if (isEmptyValue(value)) {
    return required ? 'تلفن الزامی است' : undefined;
  }
  const digits = phoneDigits(value);
  if (digits.length < PHONE_MIN_DIGITS) return 'شماره تلفن باید حداقل ۱۰ رقم باشد';
  return undefined;
}

export function validateIranMobile(value: unknown, required = false): string | undefined {
  if (isEmptyValue(value)) {
    return required ? 'شماره همراه الزامی است' : undefined;
  }
  if (!toIranMobile(value)) return 'شماره موبایل نامعتبر است (مثال: ۰۹۱۲۳۴۵۶۷۸۹)';
  return undefined;
}

export const USER_PASSWORD_MIN = 8;
export const USER_PASSWORD_MAX = 100;

export function validateUserPassword(
  value: unknown,
  required = true,
  policy?: { minLength?: number; requireUpper?: boolean; requireSymbol?: boolean },
): string | undefined {
  if (isEmptyValue(value)) {
    return required ? 'رمز عبور الزامی است' : undefined;
  }
  const s = String(value);
  const min = Math.max(USER_PASSWORD_MIN, policy?.minLength ?? USER_PASSWORD_MIN);
  if (s.length < min) {
    const minLabel = String(min).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
    return `رمز عبور باید حداقل ${minLabel} کاراکتر باشد`;
  }
  if (s.length > USER_PASSWORD_MAX) return 'رمز عبور نباید بیشتر از ۱۰۰ کاراکتر باشد';
  if (!/[A-Za-z\u0600-\u06FF]/.test(s)) return 'رمز عبور باید حداقل یک حرف داشته باشد';
  if (!/\d/.test(s)) return 'رمز عبور باید حداقل یک رقم داشته باشد';
  if (policy?.requireUpper && !/[A-Z]/.test(s)) return 'رمز عبور باید حداقل یک حرف بزرگ لاتین داشته باشد';
  if (policy?.requireSymbol && !/[^A-Za-z0-9\u0600-\u06FF]/.test(s)) {
    return 'رمز عبور باید حداقل یک نماد داشته باشد';
  }
  return undefined;
}

export type PasswordStrengthLevel = 'empty' | 'weak' | 'fair' | 'good' | 'strong';

export interface PasswordStrengthResult {
  level: PasswordStrengthLevel;
  /** 0–100 for progress bar width */
  score: number;
  label: string;
}

export const PASSWORD_STRENGTH_LABELS: Record<Exclude<PasswordStrengthLevel, 'empty'>, string> = {
  weak: 'ضعیف',
  fair: 'متوسط',
  good: 'خوب',
  strong: 'قوی',
};

export interface PasswordRequirementCheck {
  id: 'length' | 'letter' | 'digit' | 'case' | 'symbol';
  label: string;
  met: boolean;
}

/** Checklist shown while typing a password (UI). */
export function passwordRequirementChecks(value: unknown): PasswordRequirementCheck[] {
  const s = String(value ?? '');
  return [
    { id: 'length', label: 'حداقل ۸ کاراکتر', met: s.length >= 8 },
    { id: 'letter', label: 'حداقل یک حرف', met: /[A-Za-z\u0600-\u06FF]/.test(s) },
    { id: 'digit', label: 'حداقل یک رقم', met: /\d/.test(s) },
    { id: 'case', label: 'حرف بزرگ و کوچک لاتین', met: /[a-z]/.test(s) && /[A-Z]/.test(s) },
    { id: 'symbol', label: 'حداقل یک نماد (!@#…)', met: /[^A-Za-z0-9\u0600-\u06FF]/.test(s) },
  ];
}

const PASSWORD_GEN_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const PASSWORD_GEN_LOWER = 'abcdefghijkmnopqrstuvwxyz';
const PASSWORD_GEN_DIGIT = '23456789';
const PASSWORD_GEN_SYMBOL = '!@#$%&*-_=+';

/** Cryptographically strong password for admin/user forms. */
export function generateStrongPassword(length = 16): string {
  const len = Math.max(12, Math.min(64, Math.floor(length)));
  const pools = [PASSWORD_GEN_UPPER, PASSWORD_GEN_LOWER, PASSWORD_GEN_DIGIT, PASSWORD_GEN_SYMBOL];
  const all = pools.join('');
  const bytes = new Uint8Array(len);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < len; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  const chars: string[] = pools.map((pool, i) => pool[bytes[i] % pool.length]);
  for (let i = pools.length; i < len; i += 1) {
    chars.push(all[bytes[i] % all.length]);
  }
  // Fisher–Yates shuffle with remaining entropy
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = bytes[i % bytes.length] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** Live password strength for UI meters (independent of submit validation). */
export function evaluatePasswordStrength(value: unknown): PasswordStrengthResult {
  const s = String(value ?? '');
  if (!s) return { level: 'empty', score: 0, label: '' };

  let score = 0;
  if (s.length >= 8) score += 20;
  if (s.length >= 12) score += 12;
  if (s.length >= 16) score += 8;
  if (/[A-Za-z\u0600-\u06FF]/.test(s)) score += 15;
  if (/\d/.test(s)) score += 15;
  if (/[a-z]/.test(s) && /[A-Z]/.test(s)) score += 10;
  if (/[^A-Za-z0-9\u0600-\u06FF]/.test(s)) score += 10;
  const uniqueChars = new Set(s.split('')).size;
  if (uniqueChars >= Math.min(s.length, 8)) score += 5;

  const hasLetter = /[A-Za-z\u0600-\u06FF]/.test(s);
  const hasDigit = /\d/.test(s);
  if (!hasLetter || !hasDigit) score = Math.min(score, 35);

  score = Math.min(100, score);

  let level: Exclude<PasswordStrengthLevel, 'empty'>;
  if (score < 36) level = 'weak';
  else if (score < 56) level = 'fair';
  else if (score < 76) level = 'good';
  else level = 'strong';

  return { level, score, label: PASSWORD_STRENGTH_LABELS[level] };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const USERNAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9._-]{2,49}$/;

export function validateEmail(value: unknown, required = true): string | undefined {
  if (isEmptyValue(value)) {
    return required ? 'ایمیل الزامی است' : undefined;
  }
  const email = String(value).trim();
  if (!EMAIL_PATTERN.test(email)) return 'ایمیل نامعتبر است';
  return undefined;
}

export function validateUsername(value: unknown, required = false): string | undefined {
  if (isEmptyValue(value)) {
    return required ? 'نام کاربری الزامی است' : undefined;
  }
  const s = String(value).trim();
  if (s.length < 3) return 'نام کاربری باید حداقل ۳ کاراکتر باشد';
  if (s.length > 50) return 'نام کاربری نباید بیشتر از ۵۰ کاراکتر باشد';
  if (!USERNAME_PATTERN.test(s)) {
    return 'نام کاربری باید با حرف لاتین شروع شود و فقط حرف، رقم، نقطه، خط تیره یا زیرخط داشته باشد';
  }
  return undefined;
}

/** Mask mobile for OTP UI: 0912***6789 */
export function maskPhoneForDisplay(phone: string | null | undefined): string {
  const digits = phoneDigits(phone);
  if (digits.length < 7) return '••••••••••';
  return `${digits.slice(0, 4)}***${digits.slice(-4)}`;
}

export function validateLoginIdentifier(value: unknown): string | undefined {
  if (isEmptyValue(value)) return 'ایمیل یا نام کاربری الزامی است';
  const raw = String(value).trim();
  if (raw.length < 2) return 'ایمیل یا نام کاربری نامعتبر است';
  if (raw.includes('@')) return validateEmail(raw, true);
  return validateUsername(raw, true);
}

export function validateLoginOtpCode(value: unknown): string | undefined {
  if (isEmptyValue(value)) return 'کد تأیید الزامی است';
  const digits = phoneDigits(value);
  if (!/^\d{4,8}$/.test(digits)) return 'کد تأیید باید ۴ تا ۸ رقم باشد';
  return undefined;
}

export function validateLoginInput(input: {
  identifier?: string;
  password?: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  const idErr = validateLoginIdentifier(input.identifier);
  if (idErr) errors.identifier = idErr;
  const passErr = validateUserPassword(input.password, true);
  if (passErr) errors.password = passErr;
  return errors;
}

export interface AdminUserInput {
  email?: string;
  username?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export function validateAdminUserInput(
  input: AdminUserInput,
  mode: 'create' | 'update',
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (mode === 'create') {
    const email = validateEmail(input.email, true);
    if (email) errors.email = email;
  }
  if (input.username !== undefined) {
    const username = validateUsername(input.username, false);
    if (username) errors.username = username;
  }
  const password = validateUserPassword(input.password, mode === 'create');
  if (password) errors.password = password;
  if (mode === 'create' || input.firstName !== undefined) {
    const first = validateRequired(input.firstName, 'نام');
    if (first) errors.firstName = first;
    else if (String(input.firstName).trim().length > 100) errors.firstName = 'نام نباید بیشتر از ۱۰۰ کاراکتر باشد';
  }
  if (mode === 'create' || input.lastName !== undefined) {
    const last = validateRequired(input.lastName, 'نام خانوادگی');
    if (last) errors.lastName = last;
    else if (String(input.lastName).trim().length > 100) errors.lastName = 'نام خانوادگی نباید بیشتر از ۱۰۰ کاراکتر باشد';
  }
  if (input.phone !== undefined) {
    const phone = validateIranMobile(input.phone, false);
    if (phone) errors.phone = phone;
  }
  return errors;
}

export function validateDateString(value: unknown, label: string, required = false): string | undefined {
  if (isEmptyValue(value)) {
    return required ? `${label} الزامی است` : undefined;
  }
  const s = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${label} نامعتبر است`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return `${label} نامعتبر است`;
  return undefined;
}

export interface DwellingStepInput {
  title?: string;
  province?: string;
  city?: string;
  street?: string;
  plaque?: string;
  buildingType?: string;
  ownershipType?: string;
}

export function validateDwellingStep(input: DwellingStepInput): Record<string, string> {
  const errors: Record<string, string> = {};
  const fields: Array<[keyof DwellingStepInput, string]> = [
    ['title', 'عنوان ملک'],
    ['province', 'استان'],
    ['city', 'شهر'],
    ['street', 'خیابان'],
    ['plaque', 'پلاک'],
    ['buildingType', 'نوع ساختمان'],
    ['ownershipType', 'نوع مالکیت'],
  ];
  for (const [key, label] of fields) {
    const err = validateRequired(input[key], label);
    if (err) errors[key] = err;
  }
  return errors;
}

export interface HouseholdStepInput {
  caseNumber?: string;
}

export function validateHouseholdStep(input: HouseholdStepInput): Record<string, string> {
  const errors: Record<string, string> = {};
  const err = validateRequired(input.caseNumber, 'شماره پرونده');
  if (err) errors.caseNumber = err;
  return errors;
}

export interface MemberHeadInput {
  firstName?: string;
  lastName?: string;
  nationalId?: string;
  phone?: string;
  birthDate?: string;
}

export function validateMemberHeadStep(input: MemberHeadInput): Record<string, string> {
  const errors: Record<string, string> = {};
  const first = validateRequired(input.firstName, 'نام');
  if (first) errors.firstName = first;
  const last = validateRequired(input.lastName, 'نام خانوادگی');
  if (last) errors.lastName = last;
  const nid = validateNationalId(input.nationalId, true);
  if (nid) errors.nationalId = nid;
  const phone = validatePhone(input.phone, true);
  if (phone) errors.phone = phone;
  const birth = validateDateString(input.birthDate, 'تاریخ تولد', true);
  if (birth) errors.birthDate = birth;
  return errors;
}

export interface MemberPartialInput {
  firstName?: string;
  lastName?: string;
  nationalId?: string;
  phone?: string;
}

export function validateMemberPartial(input: MemberPartialInput): Record<string, string> {
  const errors: Record<string, string> = {};
  const first = validateRequired(input.firstName, 'نام');
  if (first) errors.firstName = first;
  const last = validateRequired(input.lastName, 'نام خانوادگی');
  if (last) errors.lastName = last;
  const nid = validateNationalId(input.nationalId, false);
  if (nid) errors.nationalId = nid;
  const phone = validatePhone(input.phone, false);
  if (phone) errors.phone = phone;
  return errors;
}

export function validateDynamicFields(
  schema: FormDefinitionSchema,
  values: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of schema.fields ?? []) {
    if (!field?.key) continue;
    const label = field.label?.trim() || field.key;
    const v = values[field.key];

    if (field.type === 'boolean') {
      if (field.required && v !== true) {
        errors[field.key] = `${label} باید تأیید شود`;
      }
      continue;
    }

    if (isEmptyValue(v)) {
      if (field.required) errors[field.key] = `${label} الزامی است`;
      continue;
    }

    if (field.type === 'number') {
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(n)) errors[field.key] = `${label} باید عدد باشد`;
      continue;
    }

    if (field.type === 'date') {
      const err = validateDateString(v, label, false);
      if (err) errors[field.key] = err;
      continue;
    }

    if (field.type === 'select' && field.options?.length) {
      const allowed = new Set(field.options.map((o) => o.value));
      if (!allowed.has(String(v))) errors[field.key] = `${label} نامعتبر است`;
    }
  }
  return errors;
}

/** @deprecated use validateDynamicFields — kept as alias for existing callers. */
export function validateDynamicRequired(
  schema: FormDefinitionSchema,
  values: Record<string, unknown>,
): Record<string, string> {
  return validateDynamicFields(schema, values);
}

export function validateFormDefinitionSchema(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object') return ['ساختار فرم نامعتبر است'];
  const schema = raw as FormDefinitionSchema;
  const messages: string[] = [];
  const sections = Array.isArray(schema.sections) ? schema.sections : [];
  const fields = Array.isArray(schema.fields) ? schema.fields : [];

  if (!Array.isArray(schema.sections) || !Array.isArray(schema.fields)) {
    return ['ساختار فرم باید شامل بخش‌ها و فیلدها باشد'];
  }

  const sectionIds = new Set<string>();
  for (const sec of sections) {
    const id = String(sec?.id ?? '').trim();
    const title = String(sec?.title ?? '').trim();
    if (!id) messages.push('شناسه بخش خالی است');
    else if (sectionIds.has(id)) messages.push(`شناسه بخش تکراری است: ${id}`);
    else sectionIds.add(id);
    if (!title) messages.push('عنوان بخش الزامی است');
  }

  const keys = new Set<string>();
  for (const field of fields) {
    const key = String(field?.key ?? '').trim();
    const label = String(field?.label ?? '').trim();
    if (!label) messages.push('برچسب فیلد الزامی است');
    if (!key) messages.push('کلید فیلد الزامی است');
    else if (!FIELD_KEY_PATTERN.test(key)) {
      messages.push(`کلید «${key}» نامعتبر است (حرف لاتین، عدد و _ )`);
    } else if (keys.has(key)) {
      messages.push(`کلید تکراری است: ${key}`);
    } else {
      keys.add(key);
    }
    if (!isFormFieldType(field?.type)) {
      messages.push(`نوع فیلد «${label || key}» نامعتبر است`);
    }
    if (field?.section && !sectionIds.has(field.section)) {
      messages.push(`بخش فیلد «${label || key}» پیدا نشد`);
    }
    if (field?.type === 'select') {
      const options = Array.isArray(field.options) ? field.options : [];
      if (options.length === 0) {
        messages.push(`فیلد انتخابی «${label || key}» حداقل یک گزینه لازم دارد`);
      }
      const optValues = new Set<string>();
      for (const opt of options) {
        const ov = String(opt?.value ?? '').trim();
        const ol = String(opt?.label ?? '').trim();
        if (!ov || !ol) messages.push(`گزینه فیلد «${label || key}» باید مقدار و برچسب داشته باشد`);
        else if (optValues.has(ov)) messages.push(`مقدار گزینه تکراری در «${label || key}»: ${ov}`);
        else optValues.add(ov);
      }
    }
  }

  return messages;
}

export interface NeighborhoodCreateInput {
  code?: string;
  name?: string;
  status?: string;
  municipalDistrict?: string | number;
  population?: string | number;
  householdCount?: string | number;
  avgIncome?: string | number;
  literacyRate?: string | number;
  areaSqm?: string | number;
}

export function validateNeighborhoodCreate(input: NeighborhoodCreateInput): Record<string, string> {
  const errors: Record<string, string> = {};
  const code = validateRequired(input.code, 'کد محله');
  if (code) errors.code = code;
  const name = validateRequired(input.name, 'نام محله');
  if (name) errors.name = name;
  if (!isEmptyValue(input.status) && !isNeighborhoodStatus(input.status)) {
    errors.status = 'وضعیت محله نامعتبر است';
  }
  if (!isEmptyValue(input.municipalDistrict) && !isMunicipalDistrict(input.municipalDistrict)) {
    errors.municipalDistrict = 'منطقه شهرداری باید بین ۱ تا ۸ باشد';
  }
  if (!isEmptyValue(input.population)) {
    const n = Number(input.population);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      errors.population = 'جمعیت باید عدد صحیح نامنفی باشد';
    }
  }
  if (!isEmptyValue(input.householdCount)) {
    const n = Number(input.householdCount);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      errors.householdCount = 'تعداد خانوار باید عدد صحیح نامنفی باشد';
    }
  }
  if (!isEmptyValue(input.avgIncome)) {
    const n = Number(input.avgIncome);
    if (!Number.isFinite(n) || n < 0) {
      errors.avgIncome = 'میانگین درآمد باید عدد نامنفی باشد';
    }
  }
  if (!isEmptyValue(input.literacyRate)) {
    const n = Number(input.literacyRate);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      errors.literacyRate = 'سطح سواد باید بین ۰ تا ۱۰۰ باشد';
    }
  }
  if (!isEmptyValue(input.areaSqm)) {
    const n = Number(input.areaSqm);
    if (!Number.isFinite(n) || n < 0) {
      errors.areaSqm = 'مساحت باید عدد نامنفی باشد';
    }
  }
  return errors;
}
