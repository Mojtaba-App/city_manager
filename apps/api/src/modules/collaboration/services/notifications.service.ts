import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InAppNotification } from '../entities/in-app-notification.entity';
import { ApiResponse, NotificationType } from '@city-manager/shared';
import { NotificationStreamService } from './notification-stream.service';

export interface NotifyInput {
  organizationId: string;
  userId: string;
  type: NotificationType | string;
  title: string;
  body?: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(InAppNotification)
    private readonly repo: Repository<InAppNotification>,
    @Optional() private readonly stream?: NotificationStreamService,
  ) {}

  async notify(input: NotifyInput): Promise<InAppNotification> {
    const row = this.repo.create({
      organizationId: input.organizationId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
      metadata: input.metadata,
      isRead: false,
    });
    const saved = await this.repo.save(row);
    if (this.stream) {
      const unread = await this.repo.count({
        where: { organizationId: input.organizationId, userId: input.userId, isRead: false },
      });
      this.stream.publish(input.userId, {
        type: 'notification',
        unreadCount: unread,
        item: {
          id: saved.id,
          type: saved.type,
          title: saved.title,
          body: saved.body,
          link: saved.link,
          isRead: saved.isRead,
          createdAt: saved.createdAt,
        },
      });
    }
    return saved;
  }

  async listForUser(
    orgId: string,
    userId: string,
    opts?: { unreadOnly?: boolean; limit?: number },
  ): Promise<ApiResponse<InAppNotification[]>> {
    const qb = this.repo.createQueryBuilder('n')
      .where('n.organization_id = :orgId', { orgId })
      .andWhere('n.user_id = :userId', { userId })
      .orderBy('n.created_at', 'DESC')
      .take(Math.min(opts?.limit ?? 50, 100));
    if (opts?.unreadOnly) qb.andWhere('n.is_read = false');
    const data = await qb.getMany();
    return { success: true, data };
  }

  async unreadCount(orgId: string, userId: string): Promise<ApiResponse<{ count: number }>> {
    const count = await this.repo.count({
      where: { organizationId: orgId, userId, isRead: false },
    });
    return { success: true, data: { count } };
  }

  async markRead(orgId: string, userId: string, id: string): Promise<ApiResponse<InAppNotification>> {
    const row = await this.repo.findOne({ where: { id, organizationId: orgId, userId } });
    if (!row) return { success: true, data: null as unknown as InAppNotification };
    row.isRead = true;
    row.readAt = new Date();
    const data = await this.repo.save(row);
    return { success: true, data };
  }

  async markAllRead(orgId: string, userId: string): Promise<ApiResponse<{ updated: number }>> {
    const result = await this.repo.update(
      { organizationId: orgId, userId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
    return { success: true, data: { updated: result.affected ?? 0 } };
  }
}
