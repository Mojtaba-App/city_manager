/**
 * Public, readable field metadata for forms (labels, placeholders, hints).
 * Keep copy here so UI and API validation stay consistent and human-readable.
 */

export type FieldMeta = {
  /** Form control name / key */
  key: string;
  /** Visible label (Persian) */
  label: string;
  /** Input placeholder — examples, not real credentials */
  placeholder: string;
  /** Short helper under the field */
  hint?: string;
  /** HTML autocomplete token */
  autoComplete?: string;
  /** Prefer LTR for emails, phones, usernames, codes */
  dir?: 'ltr' | 'rtl';
  inputMode?: 'text' | 'email' | 'tel' | 'numeric' | 'search';
};

export const FIELD_EMAIL: FieldMeta = {
  key: 'email',
  label: 'ایمیل',
  placeholder: 'name@example.com',
  hint: 'ایمیل سازمانی معتبر؛ برای ورود و اعلان‌ها استفاده می‌شود',
  autoComplete: 'email',
  dir: 'ltr',
  inputMode: 'email',
};

export const FIELD_USERNAME: FieldMeta = {
  key: 'username',
  label: 'نام کاربری',
  placeholder: 'مثلاً ali.rezaei',
  hint: 'حداقل ۳ کاراکتر لاتین؛ با حرف شروع شود (حرف، رقم، . _ -)',
  autoComplete: 'username',
  dir: 'ltr',
};

export const FIELD_LOGIN_IDENTIFIER: FieldMeta = {
  key: 'identifier',
  label: 'ایمیل یا نام کاربری',
  placeholder: 'name@example.com یا username',
  hint: 'می‌توانید با ایمیل یا نام کاربری وارد شوید',
  autoComplete: 'username',
  dir: 'ltr',
};

export const FIELD_PASSWORD: FieldMeta = {
  key: 'password',
  label: 'رمز عبور',
  placeholder: 'حداقل ۸ کاراکتر، حرف و رقم',
  hint: 'حداقل ۸ کاراکتر؛ شامل حرف و رقم باشد',
  autoComplete: 'current-password',
};

export const FIELD_PASSWORD_NEW: FieldMeta = {
  key: 'passwordNew',
  label: 'رمز عبور',
  placeholder: 'حداقل ۸ کاراکتر، حرف و رقم',
  hint: 'حداقل ۸ کاراکتر؛ حرف، رقم و در صورت امکان نماد داشته باشد',
  autoComplete: 'new-password',
};

export const FIELD_PASSWORD_OPTIONAL: FieldMeta = {
  key: 'passwordOptional',
  label: 'بازنشانی رمز (اختیاری)',
  placeholder: 'خالی = بدون تغییر',
  hint: 'برای reset ادمین رمز جدید را وارد کنید؛ خالی بگذارید تا رمز قبلی بماند',
  autoComplete: 'new-password',
};

export const FIELD_FIRST_NAME: FieldMeta = {
  key: 'firstName',
  label: 'نام',
  placeholder: 'مثلاً علی',
  autoComplete: 'given-name',
};

export const FIELD_LAST_NAME: FieldMeta = {
  key: 'lastName',
  label: 'نام خانوادگی',
  placeholder: 'مثلاً رضایی',
  autoComplete: 'family-name',
};

export const FIELD_PHONE: FieldMeta = {
  key: 'phone',
  label: 'شماره همراه',
  placeholder: '۰۹۱۲۳۴۵۶۷۸۹',
  hint: 'موبایل ایران؛ رقم فارسی هم پذیرفته می‌شود. برای ورود دو مرحله‌ای لازم است',
  autoComplete: 'tel',
  dir: 'ltr',
  inputMode: 'tel',
};

export const FIELD_OTP: FieldMeta = {
  key: 'otp',
  label: 'کد تأیید',
  placeholder: '۶ رقم',
  hint: 'کد ارسال‌شده به شماره همراه را وارد کنید',
  autoComplete: 'one-time-code',
  dir: 'ltr',
  inputMode: 'numeric',
};

export const FIELD_USER_SEARCH: FieldMeta = {
  key: 'userSearch',
  label: 'جستجوی کاربران',
  placeholder: 'جستجو با نام، ایمیل، نام کاربری یا تلفن…',
  inputMode: 'search',
};

/** Bundle used by admin user create/edit forms */
export const ADMIN_USER_FIELDS = {
  email: FIELD_EMAIL,
  username: FIELD_USERNAME,
  password: FIELD_PASSWORD_NEW,
  passwordOptional: FIELD_PASSWORD_OPTIONAL,
  firstName: FIELD_FIRST_NAME,
  lastName: FIELD_LAST_NAME,
  phone: FIELD_PHONE,
} as const;

/** Bundle used by login page */
export const LOGIN_FIELDS = {
  identifier: { ...FIELD_LOGIN_IDENTIFIER, hint: undefined },
  password: { ...FIELD_PASSWORD, hint: undefined, placeholder: '••••••••' },
  otp: FIELD_OTP,
  phone: {
    ...FIELD_PHONE,
    hint: 'شماره همراه ثبت‌شده در حساب کاربری',
    placeholder: '۰۹۱۲۳۴۵۶۷۸۹',
  },
} as const;

export const FIELD_CONNECTOR_CODE: FieldMeta = {
  key: 'connectorCode',
  label: 'کد کانکتور',
  placeholder: 'مثلاً welfare_api',
  hint: 'شناسه یکتا؛ لاتین، بدون فاصله',
  dir: 'ltr',
};

export const FIELD_CONNECTOR_NAME: FieldMeta = {
  key: 'connectorName',
  label: 'نام کانکتور',
  placeholder: 'مثلاً سامانه بهزیستی',
};

export const FIELD_CONNECTOR_BASE_URL: FieldMeta = {
  key: 'baseUrl',
  label: 'آدرس پایه API',
  placeholder: 'https://api.example.com',
  hint: 'برای REST و CSV از URL کامل استفاده کنید',
  dir: 'ltr',
  inputMode: 'text',
};

export const FIELD_CSV_URL: FieldMeta = {
  key: 'csvUrl',
  label: 'آدرس فایل CSV',
  placeholder: 'https://example.com/export.csv',
  hint: 'برای کانکتور csv_file؛ یا csvText را در تنظیمات بگذارید',
  dir: 'ltr',
};

export const FIELD_WEBHOOK_SECRET: FieldMeta = {
  key: 'webhookSecret',
  label: 'رمز امضای Webhook',
  placeholder: 'حداقل ۱۶ کاراکتر تصادفی',
  hint: 'برای تأیید HMAC الزامی است',
  autoComplete: 'off',
  dir: 'ltr',
};

export const FIELD_MAPPING_SOURCE: FieldMeta = {
  key: 'sourceField',
  label: 'فیلد مبدأ',
  placeholder: 'مثلاً national_id',
  dir: 'ltr',
};

export const FIELD_MAPPING_TARGET: FieldMeta = {
  key: 'targetField',
  label: 'فیلد مقصد',
  placeholder: 'مثلاً nationalId',
  dir: 'ltr',
};

export const INTEGRATION_FIELDS = {
  code: FIELD_CONNECTOR_CODE,
  name: FIELD_CONNECTOR_NAME,
  baseUrl: FIELD_CONNECTOR_BASE_URL,
  csvUrl: FIELD_CSV_URL,
  webhookSecret: FIELD_WEBHOOK_SECRET,
  sourceField: FIELD_MAPPING_SOURCE,
  targetField: FIELD_MAPPING_TARGET,
} as const;

export const FIELD_SECRET_KEY: FieldMeta = {
  key: 'secretKey',
  label: 'کلید محرمانه',
  placeholder: 'مثلاً sms_api_key',
  hint: 'نام کلید در vault؛ فقط حروف، رقم و _',
  dir: 'ltr',
};

export const FIELD_SECRET_VALUE: FieldMeta = {
  key: 'secretValue',
  label: 'مقدار محرمانه',
  placeholder: 'مقدار را وارد کنید',
  autoComplete: 'off',
  dir: 'ltr',
};

export const FIELD_OAUTH_CLIENT_NAME: FieldMeta = {
  key: 'oauthClientName',
  label: 'نام کلاینت OAuth',
  placeholder: 'مثلاً سامانه شهرداری',
};

export const FIELD_ABAC_POLICY_NAME: FieldMeta = {
  key: 'policyName',
  label: 'نام سیاست ABAC',
  placeholder: 'مثلاً org_isolation',
};

export const FIELD_GEO_NEIGHBORHOOD: FieldMeta = {
  key: 'neighborhoodId',
  label: 'محله (محدوده جغرافیایی)',
  placeholder: 'شناسه محله',
  hint: 'کاربر فقط به این محله‌ها دسترسی ردیفی دارد',
  dir: 'ltr',
};

export const SECURITY_FIELDS = {
  secretKey: FIELD_SECRET_KEY,
  secretValue: FIELD_SECRET_VALUE,
  oauthClientName: FIELD_OAUTH_CLIENT_NAME,
  policyName: FIELD_ABAC_POLICY_NAME,
  neighborhoodId: FIELD_GEO_NEIGHBORHOOD,
} as const;

export const FIELD_VISIT_NOTES: FieldMeta = {
  key: 'visitNotes',
  label: 'یادداشت بازدید',
  placeholder: 'خلاصه وضعیت خانوار در بازدید میدانی',
};

export const FIELD_VISIT_OUTCOME: FieldMeta = {
  key: 'visitOutcome',
  label: 'نتیجه بازدید',
  placeholder: 'مثلاً تکمیل شد / نیاز به پیگیری',
};

export const FIELD_CHANNEL_SEARCH: FieldMeta = {
  key: 'fieldSearch',
  label: 'جستجوی پرونده میدانی',
  placeholder: 'شماره پرونده، نام سرپرست یا آدرس…',
  inputMode: 'search',
};

export const FIELD_CHANNEL_FIELDS = {
  notes: FIELD_VISIT_NOTES,
  outcome: FIELD_VISIT_OUTCOME,
  search: FIELD_CHANNEL_SEARCH,
} as const;
