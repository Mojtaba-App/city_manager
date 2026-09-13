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

  const versions = await client.query(`
    SELECT l.name, v.version_number, v.status, COUNT(f.id)::int AS cnt
    FROM gis.gis_layers l
    JOIN gis.layer_versions v ON v.layer_id = l.id
    LEFT JOIN gis.layer_features f ON f.layer_version_id = v.id AND f.deleted_at IS NULL
    WHERE l.name IN ('قدمت ابنیه', 'کاربری اراضی')
    GROUP BY l.name, v.version_number, v.status
    ORDER BY l.name, v.version_number DESC
  `);
  console.log('Versions:', JSON.stringify(versions.rows, null, 2));

  const bbox = [48.489, 31.18, 48.849, 31.46];
  const inView = await client.query(
    `
    SELECT l.name, COUNT(*)::int AS in_bbox
    FROM gis.layer_features f
    JOIN gis.gis_layers l ON l.id = f.layer_id
    JOIN gis.layer_versions v ON v.id = f.layer_version_id
    WHERE f.deleted_at IS NULL
      AND v.status = 'published'
      AND ST_Intersects(f.geometry, ST_MakeEnvelope($1, $2, $3, $4, 4326))
      AND l.name IN ('قدمت ابنیه', 'کاربری اراضی', 'بلوک های جمعیتی')
    GROUP BY l.name
    ORDER BY in_bbox DESC
  `,
    bbox,
  );
  console.log('In default Ahvaz bbox:', JSON.stringify(inView.rows, null, 2));

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
