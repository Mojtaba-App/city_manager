import { FieldMaskingService } from './field-masking.service';
import { JwtPayload, Permission, SystemRole } from '@city-manager/shared';

function user(perms: Permission[]): JwtPayload {
  return {
    sub: 'u1',
    email: 'a@b.c',
    orgId: 'org1',
    roles: [SystemRole.VIEWER],
    permissions: perms,
  };
}

describe('FieldMaskingService', () => {
  const svc = new FieldMaskingService();

  it('masks PII fields without permission', () => {
    const out = svc.protectRecord(
      { nationalId: '0012345678', name: 'Ali', incomeAmount: 1000 },
      user([Permission.MEMBERS_READ]),
    );
    expect(out.name).toBe('Ali');
    expect(out.nationalId).not.toBe('0012345678');
    expect(out.incomeAmount).toBeNull();
  });

  it('keeps PII when permission granted', () => {
    const out = svc.protectRecord(
      { nationalId: '0012345678', incomeAmount: 1000 },
      user([Permission.MEMBERS_READ_PII, Permission.TRAJECTORY_READ_PII]),
    );
    expect(out.nationalId).toBe('0012345678');
    expect(out.incomeAmount).toBe(1000);
  });

  it('partial-masks emails', () => {
    expect(svc.mask('user@example.com', 'partial')).toBe('u***@example.com');
  });

  it('redacts and hashes', () => {
    expect(svc.mask('secret', 'redact')).toBeNull();
    expect(svc.mask('secret', 'hash')).toMatch(/^sha256:[a-f0-9]{16}$/);
    expect(svc.mask('x', 'none')).toBe('x');
  });

  it('sanitizes sensitive audit payload keys', () => {
    const clean = svc.sanitizePayload({
      action: 'login',
      password: 'x',
      nested: { apiKey: 'abc', ok: 1 },
    });
    expect(clean?.password).toBe('[REDACTED]');
    expect((clean?.nested as Record<string, unknown>).apiKey).toBe('[REDACTED]');
    expect((clean?.nested as Record<string, unknown>).ok).toBe(1);
  });

  it('anonymize is stable', () => {
    expect(svc.anonymize('001')).toBe(svc.anonymize('001'));
    expect(svc.anonymize('001')).not.toBe(svc.anonymize('002'));
  });
});
