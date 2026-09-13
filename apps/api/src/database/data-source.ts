import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join, resolve } from 'path';

config({ path: resolve(__dirname, '../../../../.env') });
config({ path: resolve(process.cwd(), '.env') });

const isProdBuild = __filename.endsWith('.js');
const root = __dirname;

export default new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  username: process.env.POSTGRES_USER || 'city_manager',
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB || 'city_manager',
  entities: isProdBuild
    ? [join(root, '..', '**', '*.entity.js')]
    : ['src/**/*.entity.ts'],
  migrations: isProdBuild
    ? [join(root, 'migrations', '*.js')]
    : ['src/database/migrations/*.ts'],
  synchronize: false,
});
