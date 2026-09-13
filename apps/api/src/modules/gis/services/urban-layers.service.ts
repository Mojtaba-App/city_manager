import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { GisLayer, LayerVersion } from '../entities/gis-layer.entity';
import { CreateUrbanLayerDto, UpdateUrbanLayerDto } from '../dto/gis.dto';
import { ApiResponse, UrbanLayerCategory, clampOpacity, clampStrokeWidth, normalizeHexColor } from '@city-manager/shared';
import {
  BEST_PUBLISHED_VERSIONS_CTE,
  PUBLISHED_LAYER_VERSION_JOIN,
  buildUrbanLayerListSql,
} from '../gis-layer-version.sql';

@Injectable()
export class UrbanLayersService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async findAll(orgId: string): Promise<ApiResponse<unknown[]>> {
    const rows = await this.dataSource.query(buildUrbanLayerListSql(1), [orgId]);
    return { success: true, data: rows };
  }

  async create(orgId: string, dto: CreateUrbanLayerDto): Promise<ApiResponse<unknown>> {
    const code = dto.code.trim();
    const name = dto.name.trim();
    const category = dto.category ?? UrbanLayerCategory.CUSTOM;
    const colorHex = dto.colorHex ? normalizeHexColor(dto.colorHex) : '#2e86ab';
    const fillOpacity = dto.fillOpacity != null ? clampOpacity(dto.fillOpacity, 0.25) : 0.25;
    const strokeHex = dto.strokeHex ? normalizeHexColor(dto.strokeHex, '#1b4f72') : '#1b4f72';
    const strokeWidth = dto.strokeWidth != null ? clampStrokeWidth(Number(dto.strokeWidth)) : 2.5;
    const sortOrder = dto.sortOrder ?? 0;

    const dup = await this.dataSource.query(
      `SELECT id FROM gis.gis_layers WHERE organization_id = $1 AND code = $2 LIMIT 1`,
      [orgId, code],
    );
    if (dup[0]) throw new ConflictException('کد لایه تکراری است');

    const rows = await this.dataSource.query(
      `INSERT INTO gis.gis_layers
        (organization_id, code, name, description, category, geometry_type,
         color_hex, fill_opacity, stroke_hex, stroke_width, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5::gis.urban_layer_category_enum, 'multipolygon',
               $6, $7, $8, $9, $10, true)
       RETURNING id, code, name, description, category, color_hex, fill_opacity,
                 stroke_hex, stroke_width, sort_order, is_active, created_at, updated_at`,
      [
        orgId,
        code,
        name,
        dto.description ?? null,
        category,
        colorHex,
        fillOpacity,
        strokeHex,
        strokeWidth,
        sortOrder,
      ],
    );
    return { success: true, data: rows[0] };
  }

  async update(
    orgId: string,
    id: string,
    dto: UpdateUrbanLayerDto,
  ): Promise<ApiResponse<unknown>> {
    const existing = await this.dataSource.query(
      `SELECT id FROM gis.gis_layers WHERE id = $1 AND organization_id = $2`,
      [id, orgId],
    );
    if (!existing[0]) throw new NotFoundException('لایه یافت نشد');

    await this.dataSource.query(
      `UPDATE gis.gis_layers SET
         name = COALESCE($3, name),
         description = COALESCE($4, description),
         category = COALESCE($5::gis.urban_layer_category_enum, category),
         color_hex = COALESCE($6, color_hex),
         fill_opacity = COALESCE($7, fill_opacity),
         stroke_hex = COALESCE($8, stroke_hex),
         stroke_width = COALESCE($9, stroke_width),
         sort_order = COALESCE($10, sort_order),
         is_active = COALESCE($11, is_active),
         updated_at = NOW()
       WHERE id = $1 AND organization_id = $2`,
      [
        id,
        orgId,
        dto.name?.trim() ?? null,
        dto.description ?? null,
        dto.category ?? null,
        dto.colorHex != null ? normalizeHexColor(dto.colorHex) : null,
        dto.fillOpacity != null ? clampOpacity(dto.fillOpacity) : null,
        dto.strokeHex != null ? normalizeHexColor(dto.strokeHex, '#1b4f72') : null,
        dto.strokeWidth != null ? clampStrokeWidth(Number(dto.strokeWidth)) : null,
        dto.sortOrder ?? null,
        dto.isActive ?? null,
      ],
    );

    const rows = await this.dataSource.query(
      `SELECT id, code, name, description, category, color_hex, fill_opacity,
              stroke_hex, stroke_width, sort_order, is_active, created_at, updated_at
       FROM gis.gis_layers WHERE id = $1`,
      [id],
    );
    return { success: true, data: rows[0] };
  }

  async remove(orgId: string, id: string): Promise<ApiResponse<{ id: string }>> {
    const result = await this.dataSource.query(
      `DELETE FROM gis.gis_layers WHERE id = $1 AND organization_id = $2 RETURNING id`,
      [id, orgId],
    );
    if (!result[0]) throw new NotFoundException('لایه یافت نشد');
    return { success: true, data: { id } };
  }

  async getOrThrow(orgId: string, id: string): Promise<GisLayer> {
    const rows = await this.dataSource.query(
      `SELECT * FROM gis.gis_layers WHERE id = $1 AND organization_id = $2`,
      [id, orgId],
    );
    if (!rows[0]) throw new NotFoundException('لایه شهری یافت نشد');
    const r = rows[0];
    return {
      id: r.id,
      organizationId: r.organization_id,
      code: r.code,
      name: r.name,
      description: r.description,
      category: r.category,
      geometryType: r.geometry_type,
      colorHex: r.color_hex,
      fillOpacity: Number(r.fill_opacity),
      strokeHex: r.stroke_hex,
      strokeWidth: Number(r.stroke_width ?? 2.5),
      sortOrder: r.sort_order,
      isActive: r.is_active,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    } as GisLayer;
  }

  async ensureLayer(
    orgId: string,
    opts: {
      layerId?: string;
      layerCode?: string;
      layerName?: string;
      category?: UrbanLayerCategory;
      colorHex?: string;
    },
  ): Promise<GisLayer> {
    if (opts.layerId) return this.getOrThrow(orgId, opts.layerId);

    if (!opts.layerCode || !opts.layerName) {
      throw new BadRequestException('برای لایه جدید، کد و نام لایه الزامی است');
    }

    const existing = await this.dataSource.query(
      `SELECT * FROM gis.gis_layers WHERE organization_id = $1 AND code = $2 LIMIT 1`,
      [orgId, opts.layerCode],
    );
    if (existing[0]) {
      return this.getOrThrow(orgId, existing[0].id);
    }

    const created = await this.create(orgId, {
      code: opts.layerCode,
      name: opts.layerName,
      category: opts.category ?? UrbanLayerCategory.CUSTOM,
      colorHex: opts.colorHex,
    });
    const row = created.data as { id: string };
    return this.getOrThrow(orgId, row.id);
  }

  /** Create a draft version (does not archive published versions). */
  async createDraftVersion(
    layerId: string,
    userId: string,
    notes?: string,
  ): Promise<LayerVersion> {
    const maxRow = await this.dataSource.query(
      `SELECT COALESCE(MAX(version_number), 0)::int AS max FROM gis.layer_versions WHERE layer_id = $1`,
      [layerId],
    );
    const next = Number(maxRow[0]?.max ?? 0) + 1;

    const rows = await this.dataSource.query(
      `INSERT INTO gis.layer_versions
        (layer_id, version_number, status, published_at, published_by, notes)
       VALUES ($1, $2, 'draft', NULL, $3, $4)
       RETURNING id, layer_id, version_number, status, published_at, published_by, notes, created_at`,
      [layerId, next, userId, notes ?? `Import draft ${next}`],
    );
    const r = rows[0];
    return {
      id: r.id,
      layerId: r.layer_id,
      versionNumber: r.version_number,
      status: r.status,
      publishedAt: r.published_at,
      publishedBy: r.published_by,
      notes: r.notes,
      createdAt: r.created_at,
    } as LayerVersion;
  }

  async deleteDraftVersion(versionId: string): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM gis.layer_features WHERE layer_version_id = $1`,
      [versionId],
    );
    await this.dataSource.query(
      `DELETE FROM gis.layer_versions WHERE id = $1 AND status = 'draft'`,
      [versionId],
    );
  }

  /** Publish a draft version and archive the previous published one. */
  async publishLayerVersion(layerId: string, versionId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE gis.layer_versions SET status = 'archived' WHERE layer_id = $1 AND status = 'published'`,
      [layerId],
    );
    await this.dataSource.query(
      `UPDATE gis.layer_versions
       SET status = 'published', published_at = NOW()
       WHERE id = $1 AND layer_id = $2`,
      [versionId, layerId],
    );
  }

  /** Create a new published version and return its id (archives previous published). */
  async createPublishedVersion(
    layerId: string,
    userId: string,
    notes?: string,
  ): Promise<LayerVersion> {
    const maxRow = await this.dataSource.query(
      `SELECT COALESCE(MAX(version_number), 0)::int AS max FROM gis.layer_versions WHERE layer_id = $1`,
      [layerId],
    );
    const next = Number(maxRow[0]?.max ?? 0) + 1;

    await this.dataSource.query(
      `UPDATE gis.layer_versions SET status = 'archived' WHERE layer_id = $1 AND status = 'published'`,
      [layerId],
    );

    const rows = await this.dataSource.query(
      `INSERT INTO gis.layer_versions
        (layer_id, version_number, status, published_at, published_by, notes)
       VALUES ($1, $2, 'published', NOW(), $3, $4)
       RETURNING id, layer_id, version_number, status, published_at, published_by, notes, created_at`,
      [layerId, next, userId, notes ?? `Import نسخه ${next}`],
    );
    const r = rows[0];
    return {
      id: r.id,
      layerId: r.layer_id,
      versionNumber: r.version_number,
      status: r.status,
      publishedAt: r.published_at,
      publishedBy: r.published_by,
      notes: r.notes,
      createdAt: r.created_at,
    } as LayerVersion;
  }

  async insertFeature(
    orgId: string,
    layerId: string,
    versionId: string,
    feature: {
      code?: string;
      name?: string;
      geometry: Record<string, unknown>;
      attributes?: Record<string, unknown>;
    },
  ): Promise<string> {
    const id = await this.insertOneFeatureSafe(orgId, layerId, versionId, feature);
    if (!id) {
      throw new BadRequestException(
        `هندسه نامعتبر: ${feature.name ?? feature.code ?? ''}`,
      );
    }
    return id;
  }

  /**
   * Bulk-insert urban polygons in SQL chunks.
   * Returns number of rows inserted (not ID list — large spreads caused stack overflow).
   */
  async insertFeaturesBatch(
    orgId: string,
    layerId: string,
    versionId: string,
    features: Array<{
      code?: string;
      name?: string;
      geometry: Record<string, unknown>;
      attributes?: Record<string, unknown> | null;
    }>,
  ): Promise<number> {
    if (!features.length) return 0;

    let inserted = 0;
    const CHUNK = 20;

    for (let offset = 0; offset < features.length; offset += CHUNK) {
      const chunk = features.slice(offset, offset + CHUNK);
      try {
        const n = await this.insertChunkSql(orgId, layerId, versionId, chunk);
        if (n > 0) {
          inserted += n;
        } else {
          for (const f of chunk) {
            const id = await this.insertOneFeatureSafe(orgId, layerId, versionId, f);
            if (id) inserted += 1;
          }
        }
      } catch {
        for (const f of chunk) {
          const id = await this.insertOneFeatureSafe(orgId, layerId, versionId, f);
          if (id) inserted += 1;
        }
      }
    }

    if (!inserted) {
      throw new BadRequestException(
        'هیچ عارضهٔ چندضلعی معتبری در فایل یافت نشد (یا همه هندسه‌ها نامعتبر بودند).',
      );
    }
    return inserted;
  }

  private async insertChunkSql(
    orgId: string,
    layerId: string,
    versionId: string,
    chunk: Array<{
      code?: string;
      name?: string;
      geometry: Record<string, unknown>;
      attributes?: Record<string, unknown> | null;
    }>,
  ): Promise<number> {
    const payload = JSON.stringify(
      chunk.map((f) => ({
        code: f.code ?? null,
        name: f.name ?? null,
        geometry: f.geometry,
        attributes: f.attributes ?? null,
      })),
    );

    const rows = await this.dataSource.query(
      `WITH src AS (
         SELECT
           NULLIF(elem->>'code', '') AS code,
           NULLIF(elem->>'name', '') AS name,
           elem->'geometry' AS geom_json,
           CASE
             WHEN elem->'attributes' IS NULL OR jsonb_typeof(elem->'attributes') = 'null'
               THEN NULL
             ELSE elem->'attributes'
           END AS attributes
         FROM jsonb_array_elements($4::jsonb) AS elem
       ),
       prepared AS (
         SELECT
           code,
           name,
           attributes,
           ST_Multi(
             ST_CollectionExtract(
               ST_Force2D(
                 ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(geom_json::text), 4326))
               ),
               3
             )
           ) AS g
         FROM src
         WHERE geom_json IS NOT NULL AND jsonb_typeof(geom_json) = 'object'
       )
       INSERT INTO gis.layer_features
         (organization_id, layer_id, layer_version_id, code, name, geometry, area_sqm,
          attributes)
       SELECT
         $1, $2, $3,
         prepared.code,
         prepared.name,
         CASE
           WHEN ST_GeometryType(prepared.g) = 'ST_Polygon' THEN ST_Multi(prepared.g)
           ELSE prepared.g
         END,
         ST_Area(prepared.g::geography),
         prepared.attributes
       FROM prepared
       WHERE prepared.g IS NOT NULL
         AND NOT ST_IsEmpty(prepared.g)
         AND ST_GeometryType(prepared.g) IN ('ST_MultiPolygon', 'ST_Polygon')
       RETURNING id`,
      [orgId, layerId, versionId, payload],
    );

    return Array.isArray(rows) ? rows.length : 0;
  }

  private async insertOneFeatureSafe(
    orgId: string,
    layerId: string,
    versionId: string,
    feature: {
      code?: string;
      name?: string;
      geometry: Record<string, unknown>;
      attributes?: Record<string, unknown> | null;
    },
  ): Promise<string | null> {
    try {
      const geoJson = JSON.stringify(feature.geometry);
      const attrs =
        feature.attributes == null ? null : JSON.stringify(feature.attributes);
      const rows = await this.dataSource.query(
        `WITH prepared AS (
           SELECT ST_Multi(
             ST_CollectionExtract(
               ST_Force2D(
                 ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($6::text), 4326))
               ),
               3
             )
           ) AS g
         )
         INSERT INTO gis.layer_features
           (organization_id, layer_id, layer_version_id, code, name, geometry, area_sqm,
            attributes)
         SELECT
           $1, $2, $3, $4, $5,
           CASE
             WHEN ST_GeometryType(prepared.g) = 'ST_Polygon' THEN ST_Multi(prepared.g)
             ELSE prepared.g
           END,
           ST_Area(prepared.g::geography),
           $7::jsonb
         FROM prepared
         WHERE prepared.g IS NOT NULL
           AND NOT ST_IsEmpty(prepared.g)
           AND ST_GeometryType(prepared.g) IN ('ST_MultiPolygon', 'ST_Polygon')
         RETURNING id`,
        [
          orgId,
          layerId,
          versionId,
          feature.code ?? null,
          feature.name ?? null,
          geoJson,
          attrs,
        ],
      );
      return (rows[0]?.id as string | undefined) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Restore layers whose published version is empty but an archived version still has features.
   * Fixes map display after a failed re-import.
   */
  async repairLayerPublications(orgId: string): Promise<void> {
    await this.dataSource.query(
      `WITH empty_pub AS (
         SELECT l.id AS layer_id, v.id AS version_id
         FROM gis.gis_layers l
         JOIN gis.layer_versions v ON v.layer_id = l.id AND v.status = 'published'
         WHERE l.organization_id = $1
           AND NOT EXISTS (
             SELECT 1 FROM gis.layer_features f
             WHERE f.layer_version_id = v.id AND f.deleted_at IS NULL
           )
       ),
       best_archived AS (
         SELECT DISTINCT ON (v.layer_id)
           v.layer_id,
           v.id AS version_id
         FROM gis.layer_versions v
         JOIN empty_pub e ON e.layer_id = v.layer_id
         WHERE v.status = 'archived'
           AND EXISTS (
             SELECT 1 FROM gis.layer_features f
             WHERE f.layer_version_id = v.id AND f.deleted_at IS NULL
           )
         ORDER BY v.layer_id, v.version_number DESC
       )
       UPDATE gis.layer_versions v
       SET status = CASE
             WHEN v.id IN (SELECT version_id FROM empty_pub) THEN 'archived'
             WHEN v.id IN (SELECT version_id FROM best_archived) THEN 'published'
             ELSE v.status
           END,
           published_at = CASE
             WHEN v.id IN (SELECT version_id FROM best_archived) THEN NOW()
             ELSE v.published_at
           END
       WHERE v.layer_id IN (SELECT layer_id FROM empty_pub)`,
      [orgId],
    );
  }

  async softDeleteFeature(orgId: string, featureId: string): Promise<ApiResponse<{ id: string }>> {
    const rows = await this.dataSource.query(
      `UPDATE gis.layer_features SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [featureId, orgId],
    );
    if (!rows[0]) throw new NotFoundException('عارضه لایه یافت نشد');
    return { success: true, data: { id: featureId } };
  }
}
