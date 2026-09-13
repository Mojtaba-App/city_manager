import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export type MvtLayer = 'neighborhoods' | 'fabrics' | 'urban';

@Injectable()
export class MvtService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getTile(
    orgId: string,
    layer: MvtLayer,
    z: number,
    x: number,
    y: number,
  ): Promise<Buffer> {
    const zoom = Math.max(0, Math.min(22, Math.floor(z)));
    const tileX = Math.floor(x);
    const tileY = Math.floor(y);

    if (layer === 'neighborhoods') {
      const rows = await this.dataSource.query(
        `
        WITH bounds AS (
          SELECT ST_TileEnvelope($1::int, $2::int, $3::int) AS geom
        ),
        src AS (
          SELECT
            n.id::text AS id,
            n.name,
            n.code,
            ST_AsMVTGeom(
              ST_Transform(n.boundary, 3857),
              bounds.geom,
              4096,
              64,
              true
            ) AS geom
          FROM program.neighborhoods n, bounds
          WHERE n.deleted_at IS NULL
            AND n.organization_id = $4
            AND n.boundary IS NOT NULL
            AND ST_Transform(n.boundary, 3857) && bounds.geom
        )
        SELECT ST_AsMVT(src, 'neighborhoods', 4096, 'geom') AS mvt FROM src
        `,
        [zoom, tileX, tileY, orgId],
      );
      return Buffer.from(rows[0]?.mvt ?? []);
    }

    if (layer === 'fabrics') {
      const rows = await this.dataSource.query(
        `
        WITH bounds AS (
          SELECT ST_TileEnvelope($1::int, $2::int, $3::int) AS geom
        ),
        src AS (
          SELECT
            f.id::text AS id,
            f.name,
            ST_AsMVTGeom(
              ST_Transform(f.geometry, 3857),
              bounds.geom,
              4096,
              64,
              true
            ) AS geom
          FROM gis.fabrics f, bounds
          WHERE f.deleted_at IS NULL
            AND f.organization_id = $4
            AND f.geometry IS NOT NULL
            AND ST_Transform(f.geometry, 3857) && bounds.geom
        )
        SELECT ST_AsMVT(src, 'fabrics', 4096, 'geom') AS mvt FROM src
        `,
        [zoom, tileX, tileY, orgId],
      );
      return Buffer.from(rows[0]?.mvt ?? []);
    }

    const rows = await this.dataSource.query(
      `
      WITH bounds AS (
        SELECT ST_TileEnvelope($1::int, $2::int, $3::int) AS geom
      ),
      src AS (
        SELECT
          lf.id::text AS id,
          lf.name,
          ST_AsMVTGeom(
            ST_Transform(lf.geometry, 3857),
            bounds.geom,
            4096,
            64,
            true
          ) AS geom
        FROM gis.layer_features lf
        JOIN gis.layer_versions lv ON lv.id = lf.layer_version_id
        JOIN gis.gis_layers gl ON gl.id = lv.layer_id
        , bounds
        WHERE gl.organization_id = $4
          AND gl.deleted_at IS NULL
          AND lf.geometry IS NOT NULL
          AND ST_Transform(lf.geometry, 3857) && bounds.geom
        LIMIT 50000
      )
      SELECT ST_AsMVT(src, 'urban', 4096, 'geom') AS mvt FROM src
      `,
      [zoom, tileX, tileY, orgId],
    );
    return Buffer.from(rows[0]?.mvt ?? []);
  }
}
