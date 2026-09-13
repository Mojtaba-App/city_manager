import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  ApiResponse,
  GlobalSearchResult,
  GlobalSearchResultItem,
  JwtPayload,
  Permission,
} from '@city-manager/shared';
import { PiiCryptoService } from '../../case/services/pii-crypto.service';
import { FieldMaskingService } from '../../security/services/field-masking.service';

interface ScoredItem extends GlobalSearchResultItem {
  score: number;
}

@Injectable()
export class GlobalSearchService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly pii: PiiCryptoService,
    private readonly masking: FieldMaskingService,
  ) {}

  async search(
    orgId: string,
    q: string,
    user: JwtPayload,
    limit = 20,
  ): Promise<ApiResponse<GlobalSearchResult>> {
    const query = q.trim();
    if (query.length < 2) {
      return { success: true, data: { query, items: [], canSearchNationalId: user.permissions.includes(Permission.MEMBERS_READ_PII) } };
    }

    const like = `%${query}%`;
    const exact = query.toLowerCase();
    const canPii = user.permissions.includes(Permission.MEMBERS_READ_PII);
    const items: ScoredItem[] = [];

    const households = await this.dataSource.query(
      `SELECT id, case_number, status FROM "case".households
       WHERE organization_id = $1 AND deleted_at IS NULL
         AND case_number ILIKE $2
       ORDER BY created_at DESC LIMIT $3`,
      [orgId, like, Math.min(limit, 8)],
    );
    for (const h of households) {
      const cn = String(h.case_number);
      items.push({
        type: 'household',
        id: h.id,
        title: `پرونده ${cn}`,
        subtitle: h.status,
        href: `/dashboard/households/${h.id}`,
        score: cn.toLowerCase() === exact ? 100 : cn.toLowerCase().startsWith(exact) ? 80 : 50,
      });
    }

    const members = await this.dataSource.query(
      `SELECT id, household_id, first_name, last_name, member_role
       FROM "case".family_members
       WHERE organization_id = $1 AND deleted_at IS NULL
         AND (first_name ILIKE $2 OR last_name ILIKE $2
              OR CONCAT(first_name, ' ', last_name) ILIKE $2)
       ORDER BY created_at DESC LIMIT $3`,
      [orgId, like, 8],
    );
    for (const m of members) {
      const full = `${m.first_name} ${m.last_name}`;
      items.push({
        type: 'member',
        id: m.id,
        title: full,
        subtitle: m.member_role,
        href: `/dashboard/households/${m.household_id}`,
        score: full.toLowerCase() === exact ? 95 : full.toLowerCase().includes(exact) ? 70 : 45,
      });
    }

    if (canPii && /^\d{10}$/.test(query.replace(/\D/g, ''))) {
      const nid = query.replace(/\D/g, '');
      const hash = this.pii.hash(nid);
      const byNid = await this.dataSource.query(
        `SELECT id, household_id, first_name, last_name, member_role
         FROM "case".family_members
         WHERE organization_id = $1 AND deleted_at IS NULL AND national_id_hash = $2
         LIMIT 3`,
        [orgId, hash],
      );
      for (const m of byNid) {
        items.push({
          type: 'member',
          id: m.id,
          title: `${m.first_name} ${m.last_name}`,
          subtitle: `کد ملی • ${this.masking.mask(nid, 'partial')}`,
          href: `/dashboard/households/${m.household_id}`,
          score: 110,
          masked: false,
        });
      }
    } else if (/^\d{6,}$/.test(query.replace(/\D/g, ''))) {
      items.push({
        type: 'member',
        id: 'pii-hint',
        title: 'جستجوی کد ملی',
        subtitle: 'برای جستجوی کد ملی به مجوز members:read_pii نیاز است',
        href: '#',
        score: 0,
        masked: true,
      });
    }

    const dwellings = await this.dataSource.query(
      `SELECT id, title, full_address, plaque, street, city
       FROM "case".dwellings
       WHERE organization_id = $1 AND deleted_at IS NULL
         AND (full_address ILIKE $2 OR title ILIKE $2 OR plaque ILIKE $2 OR street ILIKE $2)
       ORDER BY created_at DESC LIMIT $3`,
      [orgId, like, 6],
    );
    for (const d of dwellings) {
      const label = d.title || d.full_address || 'ملک';
      items.push({
        type: 'dwelling',
        id: d.id,
        title: label,
        subtitle: d.full_address || `${d.street ?? ''} ${d.plaque ?? ''}`.trim(),
        href: `/dashboard/map?dwelling=${d.id}`,
        score: String(d.plaque ?? '').includes(query) ? 75 : 40,
      });
    }

    const neighborhoods = await this.dataSource.query(
      `SELECT id, code, name FROM program.neighborhoods
       WHERE organization_id = $1 AND deleted_at IS NULL
         AND (name ILIKE $2 OR code ILIKE $2)
       ORDER BY name LIMIT $3`,
      [orgId, like, 5],
    );
    for (const n of neighborhoods) {
      items.push({
        type: 'neighborhood',
        id: n.id,
        title: n.name,
        subtitle: n.code,
        href: `/dashboard/neighborhoods/${n.id}`,
        score: String(n.name).toLowerCase().startsWith(exact) ? 85 : 35,
      });
    }

    const projects = await this.dataSource.query(
      `SELECT id, name, status, target_type FROM program.area_projects
       WHERE organization_id = $1 AND deleted_at IS NULL AND name ILIKE $2
       ORDER BY created_at DESC LIMIT $3`,
      [orgId, like, 5],
    );
    for (const p of projects) {
      items.push({
        type: 'project',
        id: p.id,
        title: p.name,
        subtitle: p.status,
        href: `/dashboard/layers?project=${p.id}`,
        score: 30,
      });
    }

    const programs = await this.dataSource.query(
      `SELECT id, code, name FROM program.regeneration_programs
       WHERE organization_id = $1 AND deleted_at IS NULL
         AND (name ILIKE $2 OR code ILIKE $2)
       ORDER BY name LIMIT $3`,
      [orgId, like, 3],
    );
    for (const p of programs) {
      items.push({
        type: 'program',
        id: p.id,
        title: p.name,
        subtitle: p.code,
        href: `/dashboard/programs/${p.id}`,
        score: 30,
      });
    }

    const deduped = this.dedupe(items)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ score: _s, ...rest }) => rest);

    return {
      success: true,
      data: {
        query,
        items: deduped,
        canSearchNationalId: canPii,
      },
    };
  }

  private dedupe(items: ScoredItem[]): ScoredItem[] {
    const seen = new Set<string>();
    const out: ScoredItem[] = [];
    for (const item of items) {
      const key = `${item.type}:${item.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (item.id === 'pii-hint' && items.some((i) => i.score >= 100)) continue;
      out.push(item);
    }
    return out;
  }
}
