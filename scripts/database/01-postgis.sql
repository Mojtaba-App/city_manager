-- PostGIS bootstrap for local PostgreSQL (run once after creating the database).
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS gis;

COMMENT ON SCHEMA core IS 'هسته سیستم: کاربران، نقش‌ها، سازمان';
COMMENT ON SCHEMA audit IS 'لاگ‌های ممیزی و ردیابی تغییرات';
COMMENT ON SCHEMA gis IS 'لایه‌ها و موجودیت‌های مکانی';
