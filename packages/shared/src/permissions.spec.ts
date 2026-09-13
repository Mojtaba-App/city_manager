import {
  Permission,
  ROLE_PERMISSIONS,
  SystemRole,
  DEFAULT_FIELD_RULES,
} from '../src/index';

describe('@city-manager/shared permissions model', () => {
  it('super_admin has every Permission enum value', () => {
    const all = Object.values(Permission);
    const superPerms = ROLE_PERMISSIONS[SystemRole.SUPER_ADMIN];
    expect(superPerms).toEqual(expect.arrayContaining(all));
    expect(superPerms.length).toBe(all.length);
  });

  it('each role has unique permission entries', () => {
    for (const role of Object.values(SystemRole)) {
      const perms = ROLE_PERMISSIONS[role];
      expect(new Set(perms).size).toBe(perms.length);
    }
  });

  it('viewer cannot write users or manage secrets', () => {
    const v = ROLE_PERMISSIONS[SystemRole.VIEWER];
    expect(v).not.toContain(Permission.USERS_WRITE);
    expect(v).not.toContain(Permission.SECRETS_MANAGE);
    expect(v).toContain(Permission.HOUSEHOLDS_READ);
  });

  it('org_admin includes security and oauth manage', () => {
    const o = ROLE_PERMISSIONS[SystemRole.ORG_ADMIN];
    expect(o).toContain(Permission.SECURITY_READ);
    expect(o).toContain(Permission.SECRETS_MANAGE);
    expect(o).toContain(Permission.OAUTH_MANAGE);
  });

  it('DEFAULT_FIELD_RULES reference known permissions', () => {
    const known = new Set(Object.values(Permission));
    for (const rule of DEFAULT_FIELD_RULES) {
      expect(known.has(rule.requiredPermission as Permission)).toBe(true);
    }
  });
});
