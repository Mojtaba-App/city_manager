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
    SELECT l.name,
           COUNT(*)::int AS total,
           COUNT(f.attributes)::int AS with_attrs,
           COUNT(f.color_hex)::int AS with_color
    FROM gis.layer_features f
    JOIN gis.gis_layers l ON l.id = f.layer_id
    WHERE f.deleted_at IS NULL
      AND l.name IN ('کاربری اراضی', 'قدمت ابنیه', 'بلوک های جمعیتی')
    GROUP BY l.name
  `);
  console.log('Stats:', JSON.stringify(stats.rows, null, 2));

  const sample = await client.query(`
    SELECT f.code, f.name, f.color_hex, f.attributes
    FROM gis.layer_features f
    JOIN gis.gis_layers l ON l.id = f.layer_id
    WHERE l.name = 'کاربری اراضی' AND f.deleted_at IS NULL
    LIMIT 3
  `);
  console.log('Samples:', JSON.stringify(sample.rows, null, 2));

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
