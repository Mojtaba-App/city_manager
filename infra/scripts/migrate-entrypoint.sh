#!/bin/sh
set -eu
cd /app/apps/api
echo "[migrate] running TypeORM migrations..."
node ../../node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js \
  || node ./node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js
echo "[migrate] done"
exec "$@"
