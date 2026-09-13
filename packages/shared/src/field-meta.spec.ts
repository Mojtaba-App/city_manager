import {
  ADMIN_USER_FIELDS,
  FIELD_LOGIN_IDENTIFIER,
  LOGIN_FIELDS,
} from './field-meta';
import {
  validateEmail,
  validateLoginIdentifier,
  validateLoginInput,
  validateLoginOtpCode,
} from './validation';

describe('field-meta', () => {
  it('exposes readable Persian labels and placeholders for login', () => {
    expect(LOGIN_FIELDS.identifier.label).toContain('ایمیل');
    expect(LOGIN_FIELDS.identifier.placeholder.length).toBeGreaterThan(5);
    expect(LOGIN_FIELDS.password.hint).toBeTruthy();
    expect(FIELD_LOGIN_IDENTIFIER.dir).toBe('ltr');
  });

  it('exposes admin user field bundle', () => {
    expect(ADMIN_USER_FIELDS.phone.label).toContain('همراه');
    expect(ADMIN_USER_FIELDS.username.placeholder).toMatch(/ali|admin|مثلاً/i);
  });
});

describe('validateLoginInput', () => {
  it('requires identifier and password', () => {
    const errors = validateLoginInput({});
    expect(errors.identifier).toBeTruthy();
    expect(errors.password).toBeTruthy();
  });

  it('accepts email or username with valid password', () => {
    expect(Object.keys(validateLoginInput({
      identifier: 'admin@city.local',
      password: 'Admin@1234',
    }))).toHaveLength(0);
    expect(Object.keys(validateLoginInput({
      identifier: 'admin_user',
      password: 'Admin@1234',
    }))).toHaveLength(0);
  });

  it('rejects invalid email-shaped identifier', () => {
    expect(validateLoginIdentifier('bad@')).toMatch(/ایمیل/);
    expect(validateEmail('not-an-email')).toMatch(/نامعتبر/);
  });

  it('validates OTP digits', () => {
    expect(validateLoginOtpCode('')).toMatch(/الزامی/);
    expect(validateLoginOtpCode('12')).toMatch(/رقم/);
    expect(validateLoginOtpCode('۱۲۳۴۵۶')).toBeUndefined();
  });
});
