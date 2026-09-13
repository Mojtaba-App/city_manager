import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { GeoJsonFeatureCollection } from '@city-manager/shared';

@Injectable()
export class GeometryService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  toMultiPolygonGeoJson(geometryJson: string): string {
    return `
      CASE
        WHEN ST_GeometryType(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)) IN ('ST_Polygon')
          THEN ST_AsGeoJSON(ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)))
        ELSE ST_AsGeoJSON(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))
      END
    `;
  }

  async geomFromGeoJson(geoJson: string): Promise<string> {
    const rows = await this.dataSource.query(
      `SELECT ST_AsEWKT(
        ST_Multi(ST_CollectionExtract(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)), 3))
      ) AS wkt`,
      [geoJson],
    );
    return rows[0]?.wkt;
  }

  async pointFromLngLat(lng: number, lat: number): Promise<string> {
    const rows = await this.dataSource.query(
      `SELECT ST_AsEWKT(ST_SetSRID(ST_MakePoint($1, $2), 4326)) AS wkt`,
      [lng, lat],
    );
    return rows[0]?.wkt;
  }

  async isValidGeometry(geoJson: string): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT ST_IsValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)) AS valid`,
      [geoJson],
    );
    return rows[0]?.valid === true;
  }

  async computeAreaSqm(geoJson: string): Promise<number> {
    const rows = await this.dataSource.query(
      `SELECT ST_Area(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)::geography) AS area`,
      [geoJson],
    );
    return parseFloat(rows[0]?.area ?? '0');
  }

  buildFeatureCollection(features: Array<Record<string, unknown>>): GeoJsonFeatureCollection {
    return {
      type: 'FeatureCollection',
      features: features.map((f) => ({
        type: 'Feature' as const,
        id: f.id as string,
        geometry: JSON.parse(f.geometry as string),
        properties: f.properties as Record<string, unknown>,
      })),
    };
  }
}
