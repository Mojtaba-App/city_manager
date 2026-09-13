import { HealthController } from './health.controller';
import { ServiceUnavailableException } from '@nestjs/common';

describe('HealthController', () => {
  it('live returns alive', () => {
    const ds = { query: jest.fn(), isInitialized: true };
    const ctrl = new HealthController(ds as never);
    const res = ctrl.live();
    expect(res.status).toBe('alive');
    expect(res.uptimeSec).toBeGreaterThanOrEqual(0);
  });

  it('ready succeeds when DB answers', async () => {
    const ds = { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]), isInitialized: true };
    const ctrl = new HealthController(ds as never);
    await expect(ctrl.ready()).resolves.toEqual({ status: 'ready', database: 'up' });
  });

  it('ready fails when DB down', async () => {
    const ds = { query: jest.fn().mockRejectedValue(new Error('down')), isInitialized: false };
    const ctrl = new HealthController(ds as never);
    await expect(ctrl.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('metrics is prometheus text', () => {
    const ds = { query: jest.fn(), isInitialized: true };
    const ctrl = new HealthController(ds as never);
    const text = ctrl.metrics();
    expect(text).toContain('process_uptime_seconds');
    expect(text).toContain('db_up 1');
  });
});
