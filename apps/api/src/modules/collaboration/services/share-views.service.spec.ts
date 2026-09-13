import { BadRequestException, GoneException } from '@nestjs/common';
import { ShareViewsService } from './share-views.service';
import { ShareViewKind, ShareViewStatus } from '@city-manager/shared';

describe('ShareViewsService', () => {
  const repo = {
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({
      ...x,
      id: x.id || 'sv1',
      createdAt: x.createdAt || new Date(),
      updatedAt: new Date(),
      viewCount: x.viewCount ?? 0,
    })),
    find: jest.fn(async () => []),
    findOne: jest.fn(),
  };

  let service: ShareViewsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ShareViewsService(repo as never);
  });

  it('creates a report share and returns plaintext token once', async () => {
    const res = await service.create('org-1', 'u1', {
      kind: ShareViewKind.REPORT,
      title: 'گزارش جلسه',
      expiresInDays: 3,
      snapshot: {
        kind: ShareViewKind.REPORT,
        title: 'گزارش جلسه',
        generatedAt: new Date().toISOString(),
        report: {
          sections: ['kpis'],
          html: '<p>خلاصه</p><script>evil()</script>',
        },
      },
    });
    expect(res.success).toBe(true);
    expect(res.data?.token).toMatch(/^sv_/);
    expect(res.data?.publicPath).toContain('/share/');
    expect(repo.create).toHaveBeenCalled();
    const savedSnap = repo.save.mock.calls[0][0].snapshot;
    expect(savedSnap.report.html).toContain('<p>خلاصه</p>');
    expect(savedSnap.report.html).not.toContain('script');
  });

  it('rejects map share without layers or image', async () => {
    await expect(service.create('org-1', 'u1', {
      kind: ShareViewKind.MAP,
      title: 'نقشه',
      snapshot: { kind: ShareViewKind.MAP, title: 'نقشه', generatedAt: new Date().toISOString() },
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('serves public snapshot and increments view count', async () => {
    repo.findOne.mockResolvedValue({
      id: 'sv1',
      kind: ShareViewKind.MAP,
      title: 'لایه بافت',
      status: ShareViewStatus.ACTIVE,
      tokenHash: 'x',
      expiresAt: new Date(Date.now() + 86_400_000),
      viewCount: 2,
      snapshot: {
        kind: ShareViewKind.MAP,
        title: 'لایه بافت',
        generatedAt: new Date().toISOString(),
        map: { layerLabels: ['بافت فرسوده'], imageDataUrl: 'data:image/png;base64,abc' },
      },
    });
    // Bypass hash lookup by mocking findOne after hashing — service hashes token
    const crypto = await import('crypto');
    const token = 'sv_testtokenvalue123456';
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    repo.findOne.mockImplementation(async ({ where }: { where: { tokenHash: string } }) => {
      if (where.tokenHash === hash) {
        return {
          id: 'sv1',
          kind: ShareViewKind.MAP,
          title: 'لایه بافت',
          status: ShareViewStatus.ACTIVE,
          tokenHash: hash,
          expiresAt: new Date(Date.now() + 86_400_000),
          viewCount: 2,
          snapshot: {
            kind: ShareViewKind.MAP,
            title: 'لایه بافت',
            generatedAt: new Date().toISOString(),
            map: { layerLabels: ['بافت فرسوده'], imageDataUrl: 'data:image/png;base64,abc' },
          },
        };
      }
      return null;
    });

    const res = await service.getPublicByToken(token);
    expect(res.data?.readOnly).toBe(true);
    expect(res.data?.snapshot.map?.layerLabels).toEqual(['بافت فرسوده']);
    expect(repo.save).toHaveBeenCalled();
  });

  it('blocks revoked and expired tokens', async () => {
    const crypto = await import('crypto');
    const token = 'sv_revokedtokenvalue999';
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    repo.findOne.mockResolvedValue({
      id: 'sv2',
      status: ShareViewStatus.REVOKED,
      tokenHash: hash,
      snapshot: {},
      title: 'x',
      kind: ShareViewKind.REPORT,
      viewCount: 0,
    });
    await expect(service.getPublicByToken(token)).rejects.toBeInstanceOf(GoneException);
  });
});
