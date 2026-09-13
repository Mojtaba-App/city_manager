import { SyncQueueService } from './sync-queue.service';
import { ConfigService } from '@nestjs/config';
import { QueueItemStatus } from '@city-manager/shared';

describe('SyncQueueService', () => {
  const queueRepo = {
    save: jest.fn(async (x) => ({ ...x, id: x.id ?? 'q1' })),
    create: jest.fn((x) => x),
    find: jest.fn(async () => []),
    count: jest.fn(async () => 2),
  };
  const connectorRepo = {
    find: jest.fn(async () => []),
    findOne: jest.fn(async () => null),
    save: jest.fn(async (x) => x),
  };
  const runner = { run: jest.fn(async () => undefined) };

  function buildService(disable = 'false') {
    const config = { get: jest.fn((_k: string, def?: string) => (_k === 'DISABLE_IN_PROCESS_SYNC' ? disable : def)) };
    return new SyncQueueService(queueRepo as never, connectorRepo as never, runner as never, config as unknown as ConfigService);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    queueRepo.find.mockResolvedValue([]);
    connectorRepo.find.mockResolvedValue([]);
    connectorRepo.findOne.mockResolvedValue(null);
    runner.run.mockResolvedValue(undefined);
  });

  it('does not start timer when in-process sync disabled', async () => {
    const service = buildService('true');
    service.onModuleInit();
    await expect(service.getMetrics()).resolves.toMatchObject({ inProcessSyncDisabled: true });
  });

  it('returns org-scoped queue metrics', async () => {
    const service = buildService('true');
    const metrics = await service.getMetrics('org-1');
    expect(metrics.pendingCount).toBe(2);
    expect(queueRepo.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ organizationId: 'org-1' }),
    });
  });

  it('enqueues item', async () => {
    const service = buildService('true');
    const item = await service.enqueue('org1', 'c1', undefined, { foo: 'bar' });
    expect(item.organizationId).toBe('org1');
    expect(queueRepo.save).toHaveBeenCalled();
  });

  it('uses connector retry policy for backoff', async () => {
    const service = buildService('true');
    const item = {
      id: 'q1',
      organizationId: 'org1',
      connectorId: 'c1',
      status: QueueItemStatus.PENDING,
      attempt: 0,
      maxAttempts: 3,
      nextAttemptAt: new Date(0),
      payload: {},
    };
    queueRepo.find.mockResolvedValueOnce([item] as never);
    connectorRepo.findOne.mockResolvedValue({
      id: 'c1',
      connectionConfig: {
        retry: { maxAttempts: 3, backoffMs: 1000, backoffMultiplier: 3, maxBackoffMs: 9000 },
      },
    } as never);
    runner.run.mockRejectedValueOnce(new Error('boom'));

    await service.tick();

    expect(runner.run).toHaveBeenCalled();
    expect(queueRepo.save).toHaveBeenCalled();
    const saved = queueRepo.save.mock.calls.map((c) => c[0]).find((row) => row.status === QueueItemStatus.FAILED);
    expect(saved).toBeTruthy();
    expect(saved.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    // attempt 1 → backoff = 1000 * 3^0 = 1000ms
    expect(saved.nextAttemptAt.getTime() - Date.now()).toBeLessThan(1500);
  });
});
