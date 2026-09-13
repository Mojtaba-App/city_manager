import { Injectable, NotFoundException, BadRequestException, GoneException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ShareView } from '../entities/share-view.entity';
import { CreateShareViewDto } from '../dto/share-view.dto';
import {
  ApiResponse,
  ShareViewKind,
  ShareViewListItem,
  ShareViewPublicDto,
  ShareViewSnapshot,
  ShareViewStatus,
  buildShareViewPath,
  isShareViewExpired,
  normalizeShareReportSections,
  sanitizeShareHtml,
} from '@city-manager/shared';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

function generateToken(): string {
  return `sv_${crypto.randomBytes(18).toString('base64url')}`;
}

@Injectable()
export class ShareViewsService {
  constructor(
    @InjectRepository(ShareView)
    private readonly repo: Repository<ShareView>,
  ) {}

  async create(
    orgId: string,
    userId: string,
    dto: CreateShareViewDto,
  ): Promise<ApiResponse<{ item: ShareViewListItem; token: string; publicPath: string }>> {
    const kind = dto.kind as ShareViewKind;
    if (!Object.values(ShareViewKind).includes(kind)) {
      throw new BadRequestException('نوع اشتراک نامعتبر است');
    }

    const snapshot = this.normalizeSnapshot(kind, dto);
    const token = generateToken();
    const days = dto.expiresInDays ?? 7;
    const row = this.repo.create({
      organizationId: orgId,
      kind,
      title: dto.title.trim(),
      caption: dto.caption?.trim(),
      recipientLabel: dto.recipientLabel?.trim(),
      status: ShareViewStatus.ACTIVE,
      tokenHash: hashToken(token),
      tokenHint: token.slice(-4),
      snapshot: snapshot as unknown as Record<string, unknown>,
      expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      createdBy: userId,
      viewCount: 0,
    });
    const saved = await this.repo.save(row);
    return {
      success: true,
      data: {
        item: this.toListItem(saved),
        token,
        publicPath: buildShareViewPath(token),
      },
    };
  }

  async list(orgId: string): Promise<ApiResponse<ShareViewListItem[]>> {
    const rows = await this.repo.find({
      where: { organizationId: orgId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return {
      success: true,
      data: rows.map((r) => this.toListItem(this.applyExpiry(r))),
    };
  }

  async revoke(orgId: string, id: string): Promise<ApiResponse<ShareViewListItem>> {
    const row = await this.require(orgId, id);
    row.status = ShareViewStatus.REVOKED;
    const saved = await this.repo.save(row);
    return { success: true, data: this.toListItem(saved) };
  }

  /** Public read-only access by opaque token (no login). */
  async getPublicByToken(token: string): Promise<ApiResponse<ShareViewPublicDto>> {
    const raw = String(token || '').trim();
    if (!raw || raw.length < 10) throw new NotFoundException('لینک اشتراک یافت نشد');

    const row = await this.repo.findOne({ where: { tokenHash: hashToken(raw) } });
    if (!row) throw new NotFoundException('لینک اشتراک یافت نشد');

    if (row.status === ShareViewStatus.REVOKED) {
      throw new GoneException('این لینک لغو شده است');
    }
    if (isShareViewExpired(row.expiresAt) || row.status === ShareViewStatus.EXPIRED) {
      if (row.status !== ShareViewStatus.EXPIRED) {
        row.status = ShareViewStatus.EXPIRED;
        await this.repo.save(row);
      }
      throw new GoneException('این لینک منقضی شده است');
    }

    row.viewCount = (row.viewCount || 0) + 1;
    row.lastViewedAt = new Date();
    await this.repo.save(row);

    const snapshot = this.publicSnapshot(row.snapshot as unknown as ShareViewSnapshot);
    return {
      success: true,
      data: {
        id: row.id,
        kind: row.kind,
        title: row.title,
        caption: row.caption,
        status: row.status,
        expiresAt: row.expiresAt?.toISOString(),
        viewCount: row.viewCount,
        snapshot,
        readOnly: true,
      },
    };
  }

  private normalizeSnapshot(kind: ShareViewKind, dto: CreateShareViewDto): ShareViewSnapshot {
    const incoming = (dto.snapshot ?? {}) as Partial<ShareViewSnapshot>;
    const sections = normalizeShareReportSections(
      dto.reportSections ?? incoming.report?.sections,
    );
    const reportHtml = incoming.report?.html
      ? sanitizeShareHtml(incoming.report.html)
      : undefined;

    const map = incoming.map
      ? {
          layerIds: Array.isArray(incoming.map.layerIds) ? incoming.map.layerIds.slice(0, 40).map(String) : undefined,
          layerLabels: Array.isArray(incoming.map.layerLabels) ? incoming.map.layerLabels.slice(0, 40).map(String) : undefined,
          bbox: Array.isArray(incoming.map.bbox) && incoming.map.bbox.length === 4
            ? incoming.map.bbox.map(Number) as [number, number, number, number]
            : undefined,
          imageDataUrl: typeof incoming.map.imageDataUrl === 'string'
            && incoming.map.imageDataUrl.startsWith('data:image/')
            && incoming.map.imageDataUrl.length < 2_500_000
            ? incoming.map.imageDataUrl
            : undefined,
          note: incoming.map.note?.toString().slice(0, 1000),
          center: incoming.map.center,
          zoom: incoming.map.zoom,
        }
      : undefined;

    if (kind === ShareViewKind.REPORT && !reportHtml && !incoming.report) {
      throw new BadRequestException('برای اشتراک گزارش، محتوای گزارش لازم است');
    }
    if (kind === ShareViewKind.MAP && !map?.imageDataUrl && !(map?.layerLabels?.length) && !(map?.layerIds?.length)) {
      throw new BadRequestException('برای اشتراک نقشه، لایه یا تصویر نقشه لازم است');
    }

    return {
      kind,
      title: dto.title.trim(),
      caption: dto.caption?.trim() || incoming.caption,
      generatedAt: incoming.generatedAt || new Date().toISOString(),
      producer: incoming.producer,
      organizationLabel: incoming.organizationLabel,
      report: (kind === ShareViewKind.REPORT || kind === ShareViewKind.HYBRID)
        ? {
            sections,
            html: reportHtml,
            title: incoming.report?.title || dto.title.trim(),
            subtitle: incoming.report?.subtitle,
          }
        : undefined,
      map: (kind === ShareViewKind.MAP || kind === ShareViewKind.HYBRID) ? map : undefined,
    };
  }

  private publicSnapshot(raw: ShareViewSnapshot): ShareViewSnapshot {
    const html = raw.report?.html ? sanitizeShareHtml(raw.report.html) : undefined;
    return {
      ...raw,
      report: raw.report
        ? { ...raw.report, html, sections: normalizeShareReportSections(raw.report.sections) }
        : undefined,
    };
  }

  private applyExpiry(row: ShareView): ShareView {
    if (row.status === ShareViewStatus.ACTIVE && isShareViewExpired(row.expiresAt)) {
      row.status = ShareViewStatus.EXPIRED;
    }
    return row;
  }

  private toListItem(row: ShareView): ShareViewListItem {
    return {
      id: row.id,
      kind: row.kind,
      title: row.title,
      status: row.status,
      tokenHint: row.tokenHint,
      expiresAt: row.expiresAt?.toISOString(),
      viewCount: row.viewCount ?? 0,
      lastViewedAt: row.lastViewedAt?.toISOString(),
      createdAt: row.createdAt.toISOString(),
      // Token itself is not stored; path template for UI after create uses returned token.
      publicPath: `/share/••••${row.tokenHint}`,
    };
  }

  private async require(orgId: string, id: string): Promise<ShareView> {
    const row = await this.repo.findOne({ where: { id, organizationId: orgId } });
    if (!row) throw new NotFoundException('اشتراک یافت نشد');
    return row;
  }
}
