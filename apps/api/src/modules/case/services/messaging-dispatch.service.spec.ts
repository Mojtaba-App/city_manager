import { MessagingDispatchService } from './messaging-dispatch.service';
import { MessageChannel, MessageOutboxStatus, OperationalEvent } from '@city-manager/shared';

describe('MessagingDispatchService', () => {
  const outboxRepo = {
    create: jest.fn((v: unknown) => ({ ...(v as object) })),
    save: jest.fn(async (v: unknown) => v),
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const settingsRepo = { findOne: jest.fn() };
  const config = { get: jest.fn(() => '1') }; // sync dispatch for tests
  const svc = new MessagingDispatchService(outboxRepo as never, settingsRepo as never, config as never);
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockReturnValue('1');
    outboxRepo.create.mockImplementation((v: unknown) => ({ ...(v as object), id: 'm1', attempt: 0, maxAttempts: 5 }));
    outboxRepo.save.mockImplementation(async (v: unknown) => v);
    outboxRepo.findOne.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      organizationId: 'org1',
      channel: MessageChannel.SMS,
      recipient: '09120000000',
      body: 'x',
      status: MessageOutboxStatus.PENDING,
      attempt: 0,
      maxAttempts: 5,
    }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns null when event channel is disabled', async () => {
    settingsRepo.findOne.mockResolvedValue({ value: { enabled: false, templates: [] } });
    const result = await svc.sendEvent('org1', 'u1', {
      event: OperationalEvent.TASK_CREATED,
      channel: MessageChannel.SMS,
      recipient: '09120000000',
      templateCode: 'task_created',
    });
    expect(result).toBeNull();
    expect(outboxRepo.save).not.toHaveBeenCalled();
  });

  it('marks outbox SKIPPED when manual send hits a disabled channel', async () => {
    settingsRepo.findOne.mockResolvedValue({ value: { enabled: false } });
    outboxRepo.findOne.mockResolvedValue({
      id: 'm1',
      organizationId: 'org1',
      channel: MessageChannel.SMS,
      recipient: '09120000000',
      body: 'سلام',
      status: MessageOutboxStatus.PENDING,
      attempt: 0,
      maxAttempts: 5,
    });
    const res = await svc.sendManual('org1', 'u1', 'hh1', {
      channel: MessageChannel.SMS,
      recipient: '09120000000',
      body: 'سلام',
    });
    expect(res.data?.status).toBe(MessageOutboxStatus.SKIPPED);
  });

  it('sends via generic HTTP /send and marks SENT', async () => {
    settingsRepo.findOne.mockResolvedValue({
      value: { enabled: true, provider: 'custom', apiBaseUrl: 'http://sms.test', apiKey: 'k', sender: 'CM' },
    });
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as never;
    outboxRepo.findOne.mockResolvedValue({
      id: 'm1',
      organizationId: 'org1',
      channel: MessageChannel.SMS,
      recipient: '09120000000',
      body: 'پیام تست',
      status: MessageOutboxStatus.PENDING,
      attempt: 0,
      maxAttempts: 5,
    });
    const res = await svc.sendManual('org1', 'u1', 'hh1', {
      channel: MessageChannel.SMS,
      recipient: '09120000000',
      body: 'پیام تست',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://sms.test/send',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(res.data?.status).toBe(MessageOutboxStatus.SENT);
  });

  it('sends sms.ir bulk API with x-api-key', async () => {
    settingsRepo.findOne.mockResolvedValue({
      value: {
        enabled: true,
        provider: 'smsir',
        apiBaseUrl: 'https://api.sms.ir/v1',
        apiKey: 'sms-key',
        sender: '3000123',
      },
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 1, message: 'موفق' }),
    }) as never;
    outboxRepo.findOne.mockResolvedValue({
      id: 'm1',
      organizationId: 'org1',
      channel: MessageChannel.SMS,
      recipient: '09120000000',
      body: 'پیام تست',
      status: MessageOutboxStatus.PENDING,
      attempt: 0,
      maxAttempts: 5,
    });
    const res = await svc.sendManual('org1', 'u1', 'hh1', {
      channel: MessageChannel.SMS,
      recipient: '09120000000',
      body: 'پیام تست',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.sms.ir/v1/send/bulk',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-api-key': 'sms-key' }),
      }),
    );
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.mobiles).toEqual(['09120000000']);
    expect(body.lineNumber).toBe(3000123);
    expect(res.data?.status).toBe(MessageOutboxStatus.SENT);
  });

  it('marks FAILED when mocked provider returns HTTP error', async () => {
    settingsRepo.findOne.mockResolvedValue({
      value: { enabled: true, apiBaseUrl: 'http://sms.test' },
    });
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 502 }) as never;
    outboxRepo.findOne.mockResolvedValue({
      id: 'm1',
      organizationId: 'org1',
      channel: MessageChannel.EMAIL,
      recipient: 'a@b.c',
      body: 'متن',
      status: MessageOutboxStatus.PENDING,
      attempt: 0,
      maxAttempts: 5,
    });
    const res = await svc.sendManual('org1', 'u1', 'hh1', {
      channel: MessageChannel.EMAIL,
      recipient: 'a@b.c',
      body: 'متن',
    });
    expect(res.data?.status).toBe(MessageOutboxStatus.FAILED);
    expect(res.data?.errorMessage).toContain('502');
  });

  it('renders event template then delivers', async () => {
    settingsRepo.findOne.mockResolvedValue({
      value: {
        enabled: true,
        apiBaseUrl: 'http://sms.test',
        templates: [{ code: 'task_created', name: 't', body: 'وظیفه {title}' }],
      },
    });
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as never;
    outboxRepo.findOne.mockImplementation(async () => ({
      id: 'm1',
      organizationId: 'org1',
      channel: MessageChannel.SMS,
      recipient: '09120000000',
      body: 'وظیفه بازدید',
      status: MessageOutboxStatus.PENDING,
      attempt: 0,
      maxAttempts: 5,
    }));
    const row = await svc.sendEvent('org1', 'u1', {
      householdId: 'hh1',
      event: OperationalEvent.TASK_CREATED,
      channel: MessageChannel.SMS,
      recipient: '09120000000',
      vars: { title: 'بازدید' },
      sync: true,
    });
    expect(row?.body).toBe('وظیفه بازدید');
    expect(row?.status).toBe(MessageOutboxStatus.SENT);
  });
});
