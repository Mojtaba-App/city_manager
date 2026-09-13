import { NotificationsService } from './notifications.service';
import { NotificationType } from '@city-manager/shared';

describe('NotificationsService', () => {
  const mockRepo = {
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({ ...x, id: 'n1', createdAt: new Date() })),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    })),
    count: jest.fn().mockResolvedValue(3),
    update: jest.fn().mockResolvedValue({ affected: 2 }),
    findOne: jest.fn(),
  };

  let service: NotificationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo.count.mockResolvedValue(3);
    service = new NotificationsService(mockRepo as never);
  });

  it('creates notification row', async () => {
    const row = await service.notify({
      organizationId: 'org1',
      userId: 'u1',
      type: NotificationType.TASK_ASSIGNED,
      title: 'Test',
    });
    expect(row.title).toBe('Test');
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('publishes to SSE hub after notify', async () => {
    const stream = { publish: jest.fn() };
    service = new NotificationsService(mockRepo as never, stream as never);
    mockRepo.count.mockResolvedValue(4);
    await service.notify({
      organizationId: 'org1',
      userId: 'u1',
      type: NotificationType.TASK_ASSIGNED,
      title: 'SSE',
    });
    expect(stream.publish).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ type: 'notification', unreadCount: 4 }),
    );
  });

  it('returns unread count', async () => {
    const res = await service.unreadCount('org1', 'u1');
    expect(res.success).toBe(true);
    expect(res.data?.count).toBe(3);
  });
});
