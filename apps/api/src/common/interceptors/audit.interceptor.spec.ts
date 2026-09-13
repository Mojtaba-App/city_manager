import { ExecutionContext } from '@nestjs/common';
import { of, throwError, lastValueFrom } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';
import { AuditOutcome } from '@city-manager/shared';
import { FieldMaskingService } from '../../modules/security/services/field-masking.service';

function httpContext(req: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => function handler() { return null; },
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({}),
      getNext: () => undefined,
    }),
  } as unknown as ExecutionContext;
}

describe('AuditInterceptor', () => {
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const reflector = { get: jest.fn() };
  const interceptor = new AuditInterceptor(
    reflector as never,
    audit as never,
    new FieldMaskingService(),
  );

  beforeEach(() => {
    audit.log.mockClear();
    reflector.get.mockReset();
  });

  it('skips handlers without @Audited', async () => {
    reflector.get.mockReturnValue(undefined);
    const next = { handle: () => of({ ok: true }) };
    await lastValueFrom(interceptor.intercept(httpContext({}), next));
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('logs SUCCESS on write completion', async () => {
    reflector.get.mockReturnValue({ action: 'household.create', resource: 'household' });
    const req = {
      user: { sub: 'u1', orgId: 'org1' },
      params: { id: 'hh-1' },
      headers: {},
      method: 'POST',
      url: '/case/households',
      query: {},
    };
    const next = { handle: () => of({ success: true }) };
    await lastValueFrom(interceptor.intercept(httpContext(req), next));
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'household.create',
        resource: 'household',
        resourceId: 'hh-1',
        userId: 'u1',
        organizationId: 'org1',
        outcome: AuditOutcome.SUCCESS,
      }),
    );
  });

  it('logs DENIED on 403', async () => {
    reflector.get.mockReturnValue({ action: 'household.delete', resource: 'household' });
    const req = { user: { sub: 'u1', orgId: 'org1' }, params: {}, headers: {}, method: 'DELETE', url: '/x', query: {} };
    const err = Object.assign(new Error('forbidden'), { status: 403 });
    const next = { handle: () => throwError(() => err) };
    await expect(lastValueFrom(interceptor.intercept(httpContext(req), next))).rejects.toBe(err);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ outcome: AuditOutcome.DENIED }));
  });
});
