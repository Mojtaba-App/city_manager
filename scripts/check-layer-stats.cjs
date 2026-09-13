const { Client } = require('../apps/api/node_modules/pg');
const fs = require('fs');
const path = require('path');

function readEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) out[m[1].trim()] = m[2].trim();
  }
  return out;
}

async function main() {
  const env = readEnv();
  const client = new Client({
    host: env.POSTGRES_HOST || 'localhost',
    port: Number(env.POSTGRES_PORT || 5432),
    user: env.POSTGRES_USER || 'city_manager',
    password: env.POSTGRES_PASSWORD,
    database: env.POSTGRES_DB || 'city_manager',
  });
  await client.connect();

  const stats = await client.query(`
    SELECT l.id, l.name, l.color_hex AS layer_color,
           COUNT(*)::int AS total,
           COUNT(f.color_hex)::int AS with_feature_color,
           COUNT(*) FILTER (WHERE COALESCE(f.fill_opacity, 1) <= 0)::int AS zero_opacity
    FROM gis.layer_features f
    JOIN gis.gis_layers l ON l.id = f.layer_id
    JOIN gis.layer_versions v ON v.id = f.layer_version_id
    WHERE f.deleted_at IS NULL AND v.status = 'published'
    GROUP BY l.id, l.name, l.color_hex
    ORDER BY total DESC
    LIMIT 10
  `);
  console.log('Layer stats:');
  console.log(JSON.stringify(stats.rows, null, 2));

  const sample = await client.query(`
    SELECT f.color_hex, f.fill_opacity, f.attributes
    FROM gis.layer_features f
    JOIN gis.layer_versions v ON v.id = f.layer_version_id
    WHERE f.deleted_at IS NULL AND v.status = 'published'
    LIMIT 8
  `);
  console.log('Sample features:');
  console.log(JSON.stringify(sample.rows, null, 2));

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
