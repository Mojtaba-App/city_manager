import {
  validateDateString,
  validateDwellingStep,
  validateDynamicRequired,
  validateFormDefinitionSchema,
  validateHouseholdStep,
  validateMemberHeadStep,
  validateMemberPartial,
  validateNationalId,
  validateNeighborhoodCreate,
  validatePhone,
  validateIranMobile,
  toIranMobile,
  validateRequired,
  validateUserPassword,
  validateAdminUserInput,
  evaluatePasswordStrength,
  PASSWORD_STRENGTH_LABELS,
  passwordRequirementChecks,
  generateStrongPassword,
  validateUsername,
  maskPhoneForDisplay,
} from './validation';

describe('validateRequired', () => {
  it('flags empty values', () => {
    expect(validateRequired('', 'فیلد')).toBe('فیلد الزامی است');
    expect(validateRequired('  ', 'فیلد')).toBe('فیلد الزامی است');
    expect(validateRequired('ok', 'فیلد')).toBeUndefined();
  });
});

describe('validateNationalId', () => {
  it('requires 10 digits when required', () => {
    expect(validateNationalId('', true)).toBe('کد ملی الزامی است');
    expect(validateNationalId('123', true)).toBe('کد ملی باید ۱۰ رقم باشد');
    expect(validateNationalId('1234567890', true)).toBeUndefined();
  });

  it('allows empty when optional', () => {
    expect(validateNationalId('', false)).toBeUndefined();
    expect(validateNationalId('123', false)).toBe('کد ملی باید ۱۰ رقم باشد');
  });
});

describe('validatePhone', () => {
  it('requires minimum digits and accepts Persian digits', () => {
    expect(validatePhone('0912', true)).toBe('شماره تلفن باید حداقل ۱۰ رقم باشد');
    expect(validatePhone('09123456789', true)).toBeUndefined();
    expect(validatePhone('۰۹۱۲۳۴۵۶۷۸۹', true)).toBeUndefined();
  });
});

describe('toIranMobile / validateIranMobile', () => {
  it('normalizes local, +98, 0098 and 9-prefixed numbers', () => {
    expect(toIranMobile('09123456789')).toBe('09123456789');
    expect(toIranMobile('۰۹۱۲ ۳۴۵ ۶۷۸۹')).toBe('09123456789');
    expect(toIranMobile('+98 912 345 6789')).toBe('09123456789');
    expect(toIranMobile('00989123456789')).toBe('09123456789');
    expect(toIranMobile('9123456789')).toBe('09123456789');
    expect(toIranMobile('02112345678')).toBeUndefined();
    expect(toIranMobile('0912')).toBeUndefined();
  });

  it('rejects landline and short numbers', () => {
    expect(validateIranMobile('02112345678', false)).toBe('شماره موبایل نامعتبر است (مثال: ۰۹۱۲۳۴۵۶۷۸۹)');
    expect(validateIranMobile('0912', true)).toBe('شماره موبایل نامعتبر است (مثال: ۰۹۱۲۳۴۵۶۷۸۹)');
    expect(validateIranMobile('', false)).toBeUndefined();
    expect(validateIranMobile('09123456789')).toBeUndefined();
  });
});

describe('validateUserPassword', () => {
  it('requires letter and digit beyond min length', () => {
    expect(validateUserPassword('', true)).toBe('رمز عبور الزامی است');
    expect(validateUserPassword('short', true)).toContain('۸ کاراکتر');
    expect(validateUserPassword('onlyletters', true)).toContain('رقم');
    expect(validateUserPassword('12345678', true)).toContain('حرف');
    expect(validateUserPassword('Admin1234', true)).toBeUndefined();
    expect(validateUserPassword('', false)).toBeUndefined();
  });
});

describe('evaluatePasswordStrength', () => {
  it('returns empty for blank input', () => {
    expect(evaluatePasswordStrength('')).toEqual({ level: 'empty', score: 0, label: '' });
    expect(evaluatePasswordStrength('   ').level).not.toBe('empty');
  });

  it('marks short or incomplete passwords as weak', () => {
    expect(evaluatePasswordStrength('123').level).toBe('weak');
    expect(evaluatePasswordStrength('12345678').level).toBe('weak');
    expect(evaluatePasswordStrength('abcdefgh').level).toBe('weak');
  });

  it('progresses from fair to strong as complexity increases', () => {
    expect(evaluatePasswordStrength('abc12345').level).toBe('fair');
    expect(evaluatePasswordStrength('Abc12345').level).toBe('good');
    expect(evaluatePasswordStrength('Abc12345!').level).toBe('good');
    expect(evaluatePasswordStrength('MyStr0ng!Pass').level).toBe('strong');
  });

  it('labels all non-empty levels in Persian', () => {
    for (const level of ['weak', 'fair', 'good', 'strong'] as const) {
      expect(PASSWORD_STRENGTH_LABELS[level]).toBeTruthy();
    }
    expect(evaluatePasswordStrength('abc12345').label).toBe(PASSWORD_STRENGTH_LABELS.fair);
    expect(evaluatePasswordStrength('MyStr0ng!Pass').label).toBe(PASSWORD_STRENGTH_LABELS.strong);
  });

  it('score increases monotonically with stronger passwords', () => {
    const weak = evaluatePasswordStrength('12345678').score;
    const fair = evaluatePasswordStrength('abc12345').score;
    const good = evaluatePasswordStrength('Abc12345!').score;
    const strong = evaluatePasswordStrength('MyStr0ng!Pass2026').score;
    expect(fair).toBeGreaterThan(weak);
    expect(good).toBeGreaterThan(fair);
    expect(strong).toBeGreaterThan(good);
    expect(strong).toBeGreaterThanOrEqual(76);
  });
});

describe('passwordRequirementChecks & generateStrongPassword', () => {
  it('marks requirements as they are satisfied', () => {
    const checks = passwordRequirementChecks('Ab1!');
    expect(checks.find((c) => c.id === 'length')?.met).toBe(false);
    expect(checks.find((c) => c.id === 'letter')?.met).toBe(true);
    expect(checks.find((c) => c.id === 'digit')?.met).toBe(true);
    expect(checks.find((c) => c.id === 'symbol')?.met).toBe(true);
    expect(passwordRequirementChecks('Abcdefgh1!').every((c) => c.met)).toBe(true);
  });

  it('generates strong passwords meeting all checks', () => {
    for (let i = 0; i < 5; i += 1) {
      const pwd = generateStrongPassword(16);
      expect(pwd.length).toBeGreaterThanOrEqual(12);
      expect(passwordRequirementChecks(pwd).every((c) => c.met)).toBe(true);
      expect(evaluatePasswordStrength(pwd).level).toBe('strong');
    }
  });
});

describe('validateUsername & maskPhoneForDisplay', () => {
  it('validates username format', () => {
    expect(validateUsername('')).toBeUndefined();
    expect(validateUsername('', true)).toBeTruthy();
    expect(validateUsername('ab')).toMatch(/۳/);
    expect(validateUsername('1admin')).toMatch(/حرف/);
    expect(validateUsername('admin_user')).toBeUndefined();
  });

  it('masks phone for OTP display', () => {
    expect(maskPhoneForDisplay('09123456789')).toBe('0912***6789');
  });
});

describe('validateAdminUserInput', () => {
  const valid = {
    email: 'user@city.local',
    password: 'Secret123',
    firstName: 'علی',
    lastName: 'رضایی',
    phone: '09123456789',
  };

  it('accepts a complete create payload', () => {
    expect(Object.keys(validateAdminUserInput(valid, 'create'))).toHaveLength(0);
  });

  it('rejects weak password and invalid mobile on create', () => {
    const errors = validateAdminUserInput({
      ...valid,
      password: 'password',
      phone: '02112345678',
    }, 'create');
    expect(errors.password).toContain('رقم');
    expect(errors.phone).toContain('موبایل');
  });

  it('allows partial update without password', () => {
    const errors = validateAdminUserInput({ firstName: 'مینا' }, 'update');
    expect(Object.keys(errors)).toHaveLength(0);
  });
});

describe('validateDateString', () => {
  it('validates ISO date', () => {
    expect(validateDateString('2020-13-01', 'تاریخ', true)).toBe('تاریخ نامعتبر است');
    expect(validateDateString('2020-05-01', 'تاریخ', true)).toBeUndefined();
  });
});

describe('validateDwellingStep', () => {
  it('collects all required dwelling fields', () => {
    const errors = validateDwellingStep({});
    expect(errors.title).toBeDefined();
    expect(errors.province).toBeDefined();
    expect(errors.city).toBeDefined();
    expect(errors.street).toBeDefined();
    expect(errors.plaque).toBeDefined();
    expect(errors.buildingType).toBeDefined();
    expect(errors.ownershipType).toBeDefined();
  });

  it('passes valid dwelling', () => {
    const errors = validateDwellingStep({
      title: 'واحد ۱',
      province: 'تهران',
      city: 'تهران',
      street: 'ولیعصر',
      plaque: '۱۲',
      buildingType: 'آجری',
      ownershipType: 'tenant',
    });
    expect(Object.keys(errors)).toHaveLength(0);
  });
});

describe('validateHouseholdStep', () => {
  it('requires case number', () => {
    expect(validateHouseholdStep({}).caseNumber).toBeDefined();
    expect(validateHouseholdStep({ caseNumber: 'HH-1' }).caseNumber).toBeUndefined();
  });
});

describe('validateMemberHeadStep', () => {
  it('validates head member PII', () => {
    const errors = validateMemberHeadStep({
      firstName: 'علی',
      lastName: 'رضایی',
      nationalId: '1234567890',
      phone: '09123456789',
      birthDate: '1990-01-01',
    });
    expect(Object.keys(errors)).toHaveLength(0);
  });
});

describe('validateMemberPartial', () => {
  it('only validates names when PII omitted', () => {
    expect(Object.keys(validateMemberPartial({ firstName: 'a', lastName: 'b' }))).toHaveLength(0);
  });
});

describe('validateDynamicRequired', () => {
  it('checks schema required fields', () => {
    const errors = validateDynamicRequired(
      {
        sections: [],
        fields: [{ key: 'x', label: 'فیلد X', type: 'text', required: true }],
      },
      {},
    );
    expect(errors.x).toBe('فیلد X الزامی است');
  });

  it('validates number, date, select and required boolean', () => {
    const schema = {
      sections: [],
      fields: [
        { key: 'score', label: 'امتیاز', type: 'number' as const, required: true },
        { key: 'when', label: 'تاریخ', type: 'date' as const },
        {
          key: 'kind',
          label: 'نوع',
          type: 'select' as const,
          options: [{ value: 'a', label: 'آ' }],
        },
        { key: 'ok', label: 'تأیید', type: 'boolean' as const, required: true },
      ],
    };
    const errors = validateDynamicRequired(schema, {
      score: 'x',
      when: '2020-13-01',
      kind: 'z',
      ok: false,
    });
    expect(errors.score).toContain('عدد');
    expect(errors.when).toContain('نامعتبر');
    expect(errors.kind).toContain('نامعتبر');
    expect(errors.ok).toContain('تأیید');
  });
});

describe('validateFormDefinitionSchema', () => {
  it('accepts a valid household form', () => {
    const msgs = validateFormDefinitionSchema({
      sections: [{ id: 'custom', title: 'تکمیلی' }],
      fields: [
        { key: 'score', label: 'امتیاز', type: 'number', section: 'custom' },
        {
          key: 'kind',
          label: 'نوع',
          type: 'select',
          options: [{ value: 'a', label: 'آ' }],
        },
      ],
    });
    expect(msgs).toEqual([]);
  });

  it('rejects duplicate keys, bad keys, and empty select', () => {
    const msgs = validateFormDefinitionSchema({
      sections: [{ id: 's1', title: 'بخش' }],
      fields: [
        { key: '1bad', label: 'الف', type: 'text' },
        { key: 'dup', label: 'ب', type: 'text' },
        { key: 'dup', label: 'ج', type: 'text' },
        { key: 'sel', label: 'د', type: 'select' },
      ],
    });
    expect(msgs.some((m) => m.includes('نامعتبر'))).toBe(true);
    expect(msgs.some((m) => m.includes('تکراری'))).toBe(true);
    expect(msgs.some((m) => m.includes('گزینه'))).toBe(true);
  });
});

describe('validateNeighborhoodCreate', () => {
  it('requires code and name', () => {
    const errors = validateNeighborhoodCreate({});
    expect(errors.code).toBeDefined();
    expect(errors.name).toBeDefined();
  });

  it('accepts municipal district 1–8, population, area and joint-action status', () => {
    const errors = validateNeighborhoodCreate({
      code: 'N-01',
      name: 'منبع آب',
      status: 'joint_action',
      municipalDistrict: 3,
      population: 12000,
      householdCount: 3200,
      avgIncome: 15000000,
      literacyRate: 78.5,
      areaSqm: 45000,
    });
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('rejects district outside 1–8 and negative population', () => {
    const errors = validateNeighborhoodCreate({
      code: 'N-01',
      name: 'آ',
      municipalDistrict: 9,
      population: -1,
    });
    expect(errors.municipalDistrict).toBeDefined();
    expect(errors.population).toBeDefined();
  });

  it('rejects invalid household/income/literacy values', () => {
    const errors = validateNeighborhoodCreate({
      code: 'N-01',
      name: 'آ',
      householdCount: -2,
      avgIncome: -1,
      literacyRate: 120,
    });
    expect(errors.householdCount).toBeDefined();
    expect(errors.avgIncome).toBeDefined();
    expect(errors.literacyRate).toBeDefined();
  });
});
