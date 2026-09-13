import { config } from 'dotenv';
import pg from 'pg';

config({ path: new URL('../.env', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1') });

const client = new pg.Client({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT || 5432),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
});

await client.connect();
const stats = await client.query(`
  SELECT l.id, l.name, l.color_hex AS layer_color,
         COUNT(*)::int AS total,
         COUNT(f.color_hex)::int AS with_feature_color,
         COUNT(*) FILTER (WHERE f.fill_opacity IS NOT NULL AND f.fill_opacity <= 0)::int AS zero_opacity
  FROM gis.layer_features f
  JOIN gis.gis_layers l ON l.id = f.layer_id
  JOIN gis.layer_versions v ON v.id = f.layer_version_id
  WHERE f.deleted_at IS NULL AND v.status = 'published'
  GROUP BY l.id, l.name, l.color_hex
  ORDER BY total DESC
  LIMIT 10
`);
console.log('Layer stats:', JSON.stringify(stats.rows, null, 2));

const sample = await client.query(`
  SELECT f.color_hex, f.fill_opacity, f.attributes
  FROM gis.layer_features f
  JOIN gis.layer_versions v ON v.id = f.layer_version_id
  WHERE f.deleted_at IS NULL AND v.status = 'published'
  LIMIT 5
`);
console.log('Sample features:', JSON.stringify(sample.rows, null, 2));

await client.end();
