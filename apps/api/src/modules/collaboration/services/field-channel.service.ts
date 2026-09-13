import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { FieldVisit } from '../../case/entities/field-visit.entity';
import { FieldCompleteDto } from '../dto/collaboration.dto';
import { ApiResponse, FieldVisitStatus } from '@city-manager/shared';

@Injectable()
export class FieldChannelService {
  constructor(
    @InjectRepository(FieldVisit)
    private readonly visits: Repository<FieldVisit>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async myVisits(
    orgId: string,
    userId: string,
    opts?: { from?: string; to?: string },
  ): Promise<ApiResponse<Array<Record<string, unknown>>>> {
    const params: unknown[] = [orgId, userId];
    let dateFilter = '';
    if (opts?.from) {
      params.push(opts.from);
      dateFilter += ` AND v.scheduled_at >= $${params.length}`;
    }
    if (opts?.to) {
      params.push(opts.to);
      dateFilter += ` AND v.scheduled_at < $${params.length}`;
    }
    const rows = await this.dataSource.query(
      `SELECT v.*, h.case_number, h.status AS household_status,
              d.plaque, d.street, d.full_address, d.title AS dwelling_title
       FROM "case".field_visits v
       JOIN "case".households h ON h.id = v.household_id
       LEFT JOIN "case".dwellings d ON d.id = h.dwelling_id
       WHERE v.organization_id = $1
         AND v.assigned_user_id = $2
         AND v.deleted_at IS NULL
         AND h.deleted_at IS NULL
         ${dateFilter}
       ORDER BY v.scheduled_at ASC
       LIMIT 100`,
      params,
    );
    return { success: true, data: rows };
  }

  async search(
    orgId: string,
    q?: string,
    plaque?: string,
  ): Promise<ApiResponse<Array<Record<string, unknown>>>> {
    const term = (q ?? plaque ?? '').trim();
    if (term.length < 2) return { success: true, data: [] };

    const rows = await this.dataSource.query(
      `SELECT h.id AS household_id, h.case_number, h.status, h.member_count,
              d.id AS dwelling_id, d.plaque, d.street, d.full_address, d.title
       FROM "case".households h
       LEFT JOIN "case".dwellings d ON d.id = h.dwelling_id
       WHERE h.organization_id = $1 AND h.deleted_at IS NULL
         AND (
           h.case_number ILIKE $2
           OR d.plaque ILIKE $2
           OR d.street ILIKE $2
           OR d.full_address ILIKE $2
           OR d.title ILIKE $2
         )
       ORDER BY h.updated_at DESC
       LIMIT 30`,
      [orgId, `%${term}%`],
    );
    return { success: true, data: rows };
  }

  async completeVisit(
    orgId: string,
    userId: string,
    visitId: string,
    dto: FieldCompleteDto,
  ): Promise<ApiResponse<FieldVisit>> {
    const visit = await this.visits.findOne({
      where: { id: visitId, organizationId: orgId, deletedAt: IsNull() },
    });
    if (!visit) throw new NotFoundException('بازدید یافت نشد');
    if (visit.assignedUserId && visit.assignedUserId !== userId) {
      throw new NotFoundException('این بازدید به شما تخصیص نشده است');
    }

    visit.findings = dto.findings?.trim() ?? visit.findings;
    if (dto.latitude != null) visit.latitude = String(dto.latitude);
    if (dto.longitude != null) visit.longitude = String(dto.longitude);
    visit.status = dto.status ?? FieldVisitStatus.COMPLETED;
    visit.completedAt = new Date();
    if (dto.photoDocumentIds?.length) {
      visit.photoDocumentIds = dto.photoDocumentIds;
    }
    const data = await this.visits.save(visit);
    return { success: true, data };
  }

  async todaySummary(orgId: string, userId: string): Promise<ApiResponse<Record<string, number>>> {
    const [row] = await this.dataSource.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'scheduled' AND scheduled_at::date = CURRENT_DATE)::int AS scheduled_today,
         COUNT(*) FILTER (WHERE status = 'completed' AND completed_at::date = CURRENT_DATE)::int AS completed_today,
         COUNT(*) FILTER (WHERE status = 'scheduled' AND scheduled_at < NOW())::int AS overdue
       FROM "case".field_visits
       WHERE organization_id = $1 AND assigned_user_id = $2 AND deleted_at IS NULL`,
      [orgId, userId],
    );
    return {
      success: true,
      data: {
        scheduledToday: row?.scheduled_today ?? 0,
        completedToday: row?.completed_today ?? 0,
        overdue: row?.overdue ?? 0,
      },
    };
  }
}
