-- ============================================================================
-- City Manager — Domain Database Schema v0.2
-- PostgreSQL 16 + PostGIS 3.4
-- Extends InitCoreSchema (core, audit, gis schemas)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Schemas
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS program;
CREATE SCHEMA IF NOT EXISTS gis;
CREATE SCHEMA IF NOT EXISTS "case";
CREATE SCHEMA IF NOT EXISTS trajectory;
CREATE SCHEMA IF NOT EXISTS support;
CREATE SCHEMA IF NOT EXISTS integration;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS audit;

COMMENT ON SCHEMA core        IS 'سازمان، کاربر، نقش، ارگان، تنظیمات';
COMMENT ON SCHEMA program     IS 'برنامه بازآفرینی، منطقه، محله';
COMMENT ON SCHEMA gis         IS 'لایه‌ها، بافت‌ها، موجودیت‌های مکانی';
COMMENT ON SCHEMA "case"      IS 'منزل، خانوار، اعضا، مالکیت، بیمه';
COMMENT ON SCHEMA trajectory  IS 'خط سیر تحول، ارزیابی دوره‌ای، رویداد';
COMMENT ON SCHEMA support     IS 'حمایت‌ها، مداخلات، یادداشت پرونده';
COMMENT ON SCHEMA integration IS 'اتصال به سامانه‌های بیرونی';
COMMENT ON SCHEMA analytics   IS 'تعریف گزارش، snapshot، read models';
COMMENT ON SCHEMA audit       IS 'ممیزی، دسترسی PII، export';

-- ---------------------------------------------------------------------------
-- ENUM Types
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE core.system_role_enum AS ENUM (
    'super_admin', 'org_admin', 'program_manager', 'zone_manager',
    'social_worker', 'gis_analyst', 'analyst', 'auditor',
    'integration_operator', 'viewer'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE core.system_role_enum ADD VALUE IF NOT EXISTS 'program_manager';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TYPE program.neighborhood_status_enum AS ENUM (
  'planned', 'active', 'paused', 'completed', 'archived'
);

CREATE TYPE program.zone_level_enum AS ENUM (
  'region', 'district', 'zone', 'subzone'
);

CREATE TYPE gis.layer_status_enum AS ENUM (
  'draft', 'review', 'published', 'archived'
);

CREATE TYPE gis.geometry_type_enum AS ENUM (
  'point', 'linestring', 'polygon', 'multipolygon'
);

CREATE TYPE "case".household_status_enum AS ENUM (
  'draft', 'active', 'suspended', 'graduated', 'withdrawn', 'archived'
);

CREATE TYPE "case".ownership_type_enum AS ENUM (
  'owner', 'tenant', 'rent_free', 'cooperative', 'other'
);

CREATE TYPE "case".member_role_enum AS ENUM (
  'head', 'spouse', 'child', 'parent', 'relative', 'other'
);

CREATE TYPE "case".gender_enum AS ENUM (
  'male', 'female', 'other', 'unknown'
);

CREATE TYPE "case".marital_status_enum AS ENUM (
  'single', 'married', 'divorced', 'widowed', 'other'
);

CREATE TYPE trajectory.employment_status_enum AS ENUM (
  'employed', 'self_employed', 'unemployed', 'student',
  'retired', 'homemaker', 'disabled', 'other'
);

CREATE TYPE trajectory.education_level_enum AS ENUM (
  'none', 'primary', 'middle', 'high_school', 'diploma',
  'associate', 'bachelor', 'master', 'doctorate', 'other'
);

CREATE TYPE trajectory.record_type_enum AS ENUM (
  'periodic_assessment', 'life_event'
);

CREATE TYPE trajectory.life_event_type_enum AS ENUM (
  'marriage', 'divorce', 'birth', 'death', 'migration',
  'job_change', 'income_change', 'education_change',
  'health_change', 'housing_change', 'other'
);

CREATE TYPE support.support_status_enum AS ENUM (
  'planned', 'approved', 'delivered', 'suspended', 'cancelled'
);

CREATE TYPE support.intervention_type_enum AS ENUM (
  'visit', 'counseling', 'referral', 'training', 'material_aid', 'other'
);

CREATE TYPE integration.connector_type_enum AS ENUM (
  'postgresql', 'mysql', 'rest_api', 'csv_file', 'other'
);

CREATE TYPE integration.sync_direction_enum AS ENUM (
  'inbound', 'outbound', 'bidirectional'
);

CREATE TYPE integration.sync_status_enum AS ENUM (
  'pending', 'running', 'success', 'partial', 'failed'
);

CREATE TYPE audit.audit_action_enum AS ENUM (
  'create', 'read', 'update', 'delete', 'login', 'logout',
  'export', 'sync', 'approve', 'assign', 'publish'
);

CREATE TYPE audit.sensitivity_enum AS ENUM (
  'public', 'internal', 'pii', 'special'
);

-- ---------------------------------------------------------------------------
-- CORE — Organizations (existing, idempotent)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS core.organizations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code          VARCHAR(200) NOT NULL UNIQUE,
  name          VARCHAR(300) NOT NULL,
  name_en       VARCHAR(300),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

-- Agencies / supporting organizations (بهزیستی، NGO، ...)
CREATE TABLE IF NOT EXISTS core.agencies (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES core.organizations(id),
  code            VARCHAR(100) NOT NULL,
  name            VARCHAR(300) NOT NULL,
  agency_type     VARCHAR(100),          -- welfare, municipality, ngo, insurance, ...
  contact_phone   VARCHAR(20),
  contact_email   VARCHAR(320),
  address         TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE (organization_id, code)
);

-- Roles (existing pattern)
CREATE TABLE IF NOT EXISTS core.roles (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code          core.system_role_enum NOT NULL UNIQUE,
  name          VARCHAR(100) NOT NULL,
  description   TEXT,
  permissions   JSONB NOT NULL DEFAULT '[]',
  is_system     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS core.users (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID REFERENCES core.organizations(id),
  email             VARCHAR(320) NOT NULL UNIQUE,
  password_hash     VARCHAR(200) NOT NULL,
  first_name        VARCHAR(100) NOT NULL,
  last_name         VARCHAR(100) NOT NULL,
  phone             VARCHAR(20),
  is_active         BOOLEAN NOT NULL DEFAULT true,
  is_email_verified BOOLEAN NOT NULL DEFAULT false,
  last_login_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS core.user_roles (
  user_id     UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  role_id     UUID NOT NULL REFERENCES core.roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role_id)
);

-- ABAC: geographic scope per user
CREATE TABLE IF NOT EXISTS core.user_geo_scopes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES core.organizations(id),
  zone_id         UUID,                  -- FK added after program.zones
  neighborhood_id UUID,                  -- FK added after program.neighborhoods
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, neighborhood_id)
);

CREATE TABLE IF NOT EXISTS core.refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(512) NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- PROGRAM — Regeneration zones & neighborhoods
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS program.regeneration_programs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES core.organizations(id),
  code            VARCHAR(100) NOT NULL,
  name            VARCHAR(300) NOT NULL,
  description     TEXT,
  start_date      DATE,
  end_date        DATE,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS program.zones (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES core.organizations(id),
  program_id      UUID REFERENCES program.regeneration_programs(id),
  parent_id       UUID REFERENCES program.zones(id),
  level           program.zone_level_enum NOT NULL DEFAULT 'zone',
  code            VARCHAR(100) NOT NULL,
  name            VARCHAR(300) NOT NULL,
  boundary        GEOMETRY(MultiPolygon, 4326),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS program.neighborhoods (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES core.organizations(id),
  program_id      UUID NOT NULL REFERENCES program.regeneration_programs(id),
  zone_id         UUID REFERENCES program.zones(id),
  code            VARCHAR(100) NOT NULL,
  name            VARCHAR(300) NOT NULL,
  status          program.neighborhood_status_enum NOT NULL DEFAULT 'planned',
  boundary        GEOMETRY(MultiPolygon, 4326) NOT NULL,
  centroid        GEOMETRY(Point, 4326),
  area_sqm        NUMERIC(14, 2),
  population_est  INTEGER,
  priority_rank   SMALLINT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS program.neighborhood_status_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  neighborhood_id UUID NOT NULL REFERENCES program.neighborhoods(id) ON DELETE CASCADE,
  from_status     program.neighborhood_status_enum,
  to_status       program.neighborhood_status_enum NOT NULL,
  reason          TEXT,
  changed_by      UUID REFERENCES core.users(id),
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deferred FKs for user_geo_scopes
ALTER TABLE core.user_geo_scopes
  DROP CONSTRAINT IF EXISTS user_geo_scopes_zone_id_fkey,
  ADD CONSTRAINT user_geo_scopes_zone_id_fkey
    FOREIGN KEY (zone_id) REFERENCES program.zones(id) ON DELETE CASCADE;

ALTER TABLE core.user_geo_scopes
  DROP CONSTRAINT IF EXISTS user_geo_scopes_neighborhood_id_fkey,
  ADD CONSTRAINT user_geo_scopes_neighborhood_id_fkey
    FOREIGN KEY (neighborhood_id) REFERENCES program.neighborhoods(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- GIS — Layers & fabrics
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gis.fabric_types (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES core.organizations(id),
  code            VARCHAR(100) NOT NULL,
  name            VARCHAR(200) NOT NULL,
  color_hex       VARCHAR(7),
  description     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS gis.gis_layers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES core.organizations(id),
  code            VARCHAR(100) NOT NULL,
  name            VARCHAR(300) NOT NULL,
  description     TEXT,
  geometry_type   gis.geometry_type_enum NOT NULL DEFAULT 'multipolygon',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS gis.layer_versions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  layer_id        UUID NOT NULL REFERENCES gis.gis_layers(id) ON DELETE CASCADE,
  version_number  INTEGER NOT NULL,
  status          gis.layer_status_enum NOT NULL DEFAULT 'draft',
  published_at    TIMESTAMPTZ,
  published_by    UUID REFERENCES core.users(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (layer_id, version_number)
);

CREATE TABLE IF NOT EXISTS gis.fabrics (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES core.organizations(id),
  neighborhood_id   UUID REFERENCES program.neighborhoods(id),
  fabric_type_id    UUID NOT NULL REFERENCES gis.fabric_types(id),
  layer_version_id  UUID REFERENCES gis.layer_versions(id),
  code              VARCHAR(100),
  name              VARCHAR(300),
  geometry          GEOMETRY(MultiPolygon, 4326) NOT NULL,
  area_sqm          NUMERIC(14, 2),
  attributes        JSONB,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- CASE — Dwellings, households, members
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "case".dwellings (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES core.organizations(id),
  neighborhood_id   UUID NOT NULL REFERENCES program.neighborhoods(id),
  fabric_id         UUID REFERENCES gis.fabrics(id),
  dwelling_code     VARCHAR(100),
  -- Address (S2 internal)
  province          VARCHAR(100),
  city              VARCHAR(100),
  district          VARCHAR(100),
  street            VARCHAR(300),
  alley             VARCHAR(200),
  plaque            VARCHAR(50),
  unit              VARCHAR(50),
  postal_code       VARCHAR(20),
  full_address      TEXT,
  location          GEOMETRY(Point, 4326),
  building_type     VARCHAR(100),        -- apartment, villa, informal, ...
  floor_count       SMALLINT,
  unit_count        SMALLINT,
  construction_year SMALLINT,
  area_sqm          NUMERIC(10, 2),
  metadata          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS "case".households (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES core.organizations(id),
  neighborhood_id   UUID NOT NULL REFERENCES program.neighborhoods(id),
  dwelling_id       UUID NOT NULL REFERENCES "case".dwellings(id),
  case_number       VARCHAR(100) NOT NULL,
  status            "case".household_status_enum NOT NULL DEFAULT 'draft',
  registered_at     DATE NOT NULL DEFAULT CURRENT_DATE,
  status_changed_at TIMESTAMPTZ,
  head_member_id    UUID,                -- FK added after family_members
  member_count      SMALLINT NOT NULL DEFAULT 0,
  notes             TEXT,
  metadata          JSONB,
  version           INTEGER NOT NULL DEFAULT 1,  -- optimistic locking
  created_by        UUID REFERENCES core.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (organization_id, case_number)
);

CREATE TABLE IF NOT EXISTS "case".household_assignments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id    UUID NOT NULL REFERENCES "case".households(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES core.users(id),
  assigned_by     UUID REFERENCES core.users(id),
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unassigned_at   TIMESTAMPTZ,
  is_primary      BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (household_id, user_id, assigned_at)
);

CREATE TABLE IF NOT EXISTS "case".household_status_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id    UUID NOT NULL REFERENCES "case".households(id) ON DELETE CASCADE,
  from_status     "case".household_status_enum,
  to_status       "case".household_status_enum NOT NULL,
  reason          TEXT NOT NULL,
  approved_by     UUID REFERENCES core.users(id),
  changed_by      UUID REFERENCES core.users(id),
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "case".family_members (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     UUID NOT NULL REFERENCES core.organizations(id),
  household_id        UUID NOT NULL REFERENCES "case".households(id) ON DELETE CASCADE,
  member_role         "case".member_role_enum NOT NULL DEFAULT 'other',
  is_beneficiary      BOOLEAN NOT NULL DEFAULT true,
  first_name          VARCHAR(100) NOT NULL,
  last_name           VARCHAR(100) NOT NULL,
  gender              "case".gender_enum NOT NULL DEFAULT 'unknown',
  birth_date          DATE,
  marital_status      "case".marital_status_enum,
  -- PII (S3): encrypted + hash for lookup
  national_id_enc     BYTEA,             -- pgp_sym_encrypt
  national_id_hash    VARCHAR(64),       -- SHA-256 hex for dedup/search
  phone_enc           BYTEA,
  phone_hash          VARCHAR(64),
  is_identity_verified BOOLEAN NOT NULL DEFAULT false,
  identity_source     VARCHAR(100),      -- manual, national_registry, integration
  left_household_at   DATE,
  left_reason         VARCHAR(200),
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

ALTER TABLE "case".households
  DROP CONSTRAINT IF EXISTS households_head_member_id_fkey,
  ADD CONSTRAINT households_head_member_id_fkey
    FOREIGN KEY (head_member_id) REFERENCES "case".family_members(id);

CREATE TABLE IF NOT EXISTS "case".ownership_records (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dwelling_id       UUID NOT NULL REFERENCES "case".dwellings(id) ON DELETE CASCADE,
  household_id      UUID REFERENCES "case".households(id),
  ownership_type    "case".ownership_type_enum NOT NULL,
  owner_name          VARCHAR(300),
  lease_start_date    DATE,
  lease_end_date      DATE,
  monthly_rent        NUMERIC(14, 2),    -- S3 sensitive
  document_reference  VARCHAR(200),
  is_current          BOOLEAN NOT NULL DEFAULT true,
  recorded_by         UUID REFERENCES core.users(id),
  recorded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes               TEXT
);

CREATE TABLE IF NOT EXISTS "case".insurance_records (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id      UUID NOT NULL REFERENCES "case".households(id) ON DELETE CASCADE,
  member_id         UUID REFERENCES "case".family_members(id),
  agency_id         UUID REFERENCES core.agencies(id),
  insurance_type    VARCHAR(100) NOT NULL,  -- health, social, unemployment, ...
  policy_number_enc BYTEA,                  -- S3
  coverage_start    DATE,
  coverage_end      DATE,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  metadata          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- TRAJECTORY — Periodic assessments & life events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trajectory.life_trajectory_records (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     UUID NOT NULL REFERENCES core.organizations(id),
  household_id        UUID NOT NULL REFERENCES "case".households(id) ON DELETE CASCADE,
  member_id           UUID REFERENCES "case".family_members(id),
  record_type         trajectory.record_type_enum NOT NULL,
  period_start        DATE,
  period_end          DATE,
  event_type          trajectory.life_event_type_enum,
  event_date          DATE,
  -- Assessment fields (S3 where noted)
  employment_status   trajectory.employment_status_enum,
  job_title           VARCHAR(200),
  employer_name       VARCHAR(300),
  monthly_income      NUMERIC(14, 2),     -- S3
  income_currency     VARCHAR(3) NOT NULL DEFAULT 'IRR',
  education_level     trajectory.education_level_enum,
  education_field     VARCHAR(200),
  quality_of_life_score SMALLINT CHECK (quality_of_life_score BETWEEN 1 AND 10),
  qol_dimensions      JSONB,              -- {housing:8, health:6, ...}
  description         TEXT,
  source              VARCHAR(100) NOT NULL DEFAULT 'manual',
  recorded_by         UUID REFERENCES core.users(id),
  approved_by         UUID REFERENCES core.users(id),
  approved_at         TIMESTAMPTZ,
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- SUPPORT — Programs, records, interventions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS support.support_programs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES core.organizations(id),
  agency_id       UUID REFERENCES core.agencies(id),
  code            VARCHAR(100) NOT NULL,
  name            VARCHAR(300) NOT NULL,
  description     TEXT,
  program_type    VARCHAR(100),           -- cash, service, housing, training, ...
  is_active       BOOLEAN NOT NULL DEFAULT true,
  eligibility     JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS support.support_records (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     UUID NOT NULL REFERENCES core.organizations(id),
  household_id        UUID NOT NULL REFERENCES "case".households(id) ON DELETE CASCADE,
  member_id           UUID REFERENCES "case".family_members(id),
  program_id          UUID NOT NULL REFERENCES support.support_programs(id),
  agency_id           UUID REFERENCES core.agencies(id),
  status              support.support_status_enum NOT NULL DEFAULT 'planned',
  amount              NUMERIC(14, 2),
  currency            VARCHAR(3) NOT NULL DEFAULT 'IRR',
  delivery_date       DATE,
  period_start        DATE,
  period_end          DATE,
  external_reference  VARCHAR(200),
  source              VARCHAR(100) NOT NULL DEFAULT 'manual',
  description         TEXT,
  recorded_by         UUID REFERENCES core.users(id),
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support.interventions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES core.organizations(id),
  household_id      UUID NOT NULL REFERENCES "case".households(id) ON DELETE CASCADE,
  member_id         UUID REFERENCES "case".family_members(id),
  intervention_type support.intervention_type_enum NOT NULL,
  title             VARCHAR(300) NOT NULL,
  description       TEXT,
  intervention_date TIMESTAMPTZ NOT NULL,
  outcome           TEXT,
  performed_by      UUID REFERENCES core.users(id),
  metadata          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support.case_notes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id    UUID NOT NULL REFERENCES "case".households(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL REFERENCES core.users(id),
  note_type       VARCHAR(100) DEFAULT 'general',
  content         TEXT NOT NULL,
  is_confidential BOOLEAN NOT NULL DEFAULT false,
  attachment_refs JSONB,                 -- [{bucket, key, filename}]
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- INTEGRATION — External systems
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS integration.connectors (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES core.organizations(id),
  code              VARCHAR(100) NOT NULL,
  name              VARCHAR(300) NOT NULL,
  connector_type    integration.connector_type_enum NOT NULL,
  sync_direction    integration.sync_direction_enum NOT NULL DEFAULT 'inbound',
  connection_config JSONB NOT NULL,      -- encrypted credentials ref / host / url
  target_entity     VARCHAR(100) NOT NULL, -- household, member, support, ...
  is_active         BOOLEAN NOT NULL DEFAULT true,
  schedule_cron     VARCHAR(100),
  last_sync_at      TIMESTAMPTZ,
  created_by        UUID REFERENCES core.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS integration.field_mappings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connector_id    UUID NOT NULL REFERENCES integration.connectors(id) ON DELETE CASCADE,
  source_field    VARCHAR(200) NOT NULL,
  target_field    VARCHAR(200) NOT NULL,
  transform_rule  JSONB,
  is_required     BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (connector_id, source_field)
);

CREATE TABLE IF NOT EXISTS integration.sync_jobs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connector_id    UUID NOT NULL REFERENCES integration.connectors(id) ON DELETE CASCADE,
  status          integration.sync_status_enum NOT NULL DEFAULT 'pending',
  started_at      TIMESTAMPTZ,
  finished_at     TIMESTAMPTZ,
  records_read    INTEGER NOT NULL DEFAULT 0,
  records_written INTEGER NOT NULL DEFAULT 0,
  records_failed  INTEGER NOT NULL DEFAULT 0,
  error_summary   TEXT,
  triggered_by    UUID REFERENCES core.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integration.sync_job_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sync_job_id     UUID NOT NULL REFERENCES integration.sync_jobs(id) ON DELETE CASCADE,
  log_level       VARCHAR(20) NOT NULL DEFAULT 'info',
  message         TEXT NOT NULL,
  record_ref      VARCHAR(200),
  payload         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integration.external_id_mappings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connector_id    UUID NOT NULL REFERENCES integration.connectors(id) ON DELETE CASCADE,
  entity_type     VARCHAR(100) NOT NULL,
  internal_id     UUID NOT NULL,
  external_id     VARCHAR(500) NOT NULL,
  last_synced_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (connector_id, entity_type, external_id)
);

-- ---------------------------------------------------------------------------
-- ANALYTICS — Report definitions & snapshots
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics.report_definitions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES core.organizations(id),
  code            VARCHAR(100) NOT NULL,
  name            VARCHAR(300) NOT NULL,
  description     TEXT,
  query_template  TEXT,                  -- parameterized SQL or ref
  parameters      JSONB,
  includes_pii    BOOLEAN NOT NULL DEFAULT false,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID REFERENCES core.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS analytics.report_snapshots (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id       UUID NOT NULL REFERENCES analytics.report_definitions(id),
  organization_id UUID NOT NULL REFERENCES core.organizations(id),
  period_label    VARCHAR(100),          -- e.g. 1404-Q1
  parameters      JSONB,
  result_data     JSONB NOT NULL,
  generated_by    UUID REFERENCES core.users(id),
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Materialized view placeholder: neighborhood KPI
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_neighborhood_kpi AS
SELECT
  n.organization_id,
  n.id AS neighborhood_id,
  n.code AS neighborhood_code,
  n.name AS neighborhood_name,
  n.status,
  COUNT(DISTINCT h.id) FILTER (WHERE h.deleted_at IS NULL AND h.status = 'active') AS active_households,
  COUNT(DISTINCT fm.id) FILTER (WHERE fm.deleted_at IS NULL) AS total_members,
  COUNT(DISTINCT sr.id) AS support_records_count,
  NOW() AS refreshed_at
FROM program.neighborhoods n
LEFT JOIN "case".households h ON h.neighborhood_id = n.id
LEFT JOIN "case".family_members fm ON fm.household_id = h.id
LEFT JOIN support.support_records sr ON sr.household_id = h.id
WHERE n.deleted_at IS NULL
GROUP BY n.organization_id, n.id, n.code, n.name, n.status
WITH NO DATA;

-- ---------------------------------------------------------------------------
-- AUDIT — Enhanced logging
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit.audit_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID,
  user_id         UUID,
  action          audit.audit_action_enum NOT NULL,
  resource        VARCHAR(100) NOT NULL,
  resource_id     VARCHAR(100),
  sensitivity     audit.sensitivity_enum NOT NULL DEFAULT 'internal',
  old_values      JSONB,
  new_values      JSONB,
  payload         JSONB,
  ip_address      INET,
  user_agent      TEXT,
  request_id      VARCHAR(100),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Default partition + monthly template (create partitions via job)
CREATE TABLE IF NOT EXISTS audit.audit_logs_default
  PARTITION OF audit.audit_logs DEFAULT;

CREATE TABLE IF NOT EXISTS audit.data_access_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL,
  user_id         UUID NOT NULL,
  resource        VARCHAR(100) NOT NULL,
  resource_id     UUID NOT NULL,
  field_names     TEXT[] NOT NULL,
  access_reason   TEXT,
  ip_address      INET,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit.export_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL,
  user_id         UUID NOT NULL,
  export_type     VARCHAR(100) NOT NULL,
  filters         JSONB,
  row_count       INTEGER,
  includes_pii    BOOLEAN NOT NULL DEFAULT false,
  file_ref        VARCHAR(500),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------

-- Spatial GIST
CREATE INDEX IF NOT EXISTS idx_zones_boundary_gist
  ON program.zones USING GIST (boundary);
CREATE INDEX IF NOT EXISTS idx_neighborhoods_boundary_gist
  ON program.neighborhoods USING GIST (boundary);
CREATE INDEX IF NOT EXISTS idx_fabrics_geometry_gist
  ON gis.fabrics USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_dwellings_location_gist
  ON "case".dwellings USING GIST (location);

-- Tenant + lookup
CREATE INDEX IF NOT EXISTS idx_agencies_org ON core.agencies(organization_id);
CREATE INDEX IF NOT EXISTS idx_programs_org ON program.regeneration_programs(organization_id);
CREATE INDEX IF NOT EXISTS idx_zones_org ON program.zones(organization_id);
CREATE INDEX IF NOT EXISTS idx_neighborhoods_org ON program.neighborhoods(organization_id);
CREATE INDEX IF NOT EXISTS idx_neighborhoods_zone ON program.neighborhoods(zone_id);
CREATE INDEX IF NOT EXISTS idx_neighborhoods_status ON program.neighborhoods(status);
CREATE INDEX IF NOT EXISTS idx_fabrics_org ON gis.fabrics(organization_id);
CREATE INDEX IF NOT EXISTS idx_fabrics_neighborhood ON gis.fabrics(neighborhood_id);
CREATE INDEX IF NOT EXISTS idx_dwellings_org ON "case".dwellings(organization_id);
CREATE INDEX IF NOT EXISTS idx_dwellings_neighborhood ON "case".dwellings(neighborhood_id);
CREATE INDEX IF NOT EXISTS idx_households_org ON "case".households(organization_id);
CREATE INDEX IF NOT EXISTS idx_households_neighborhood ON "case".households(neighborhood_id);
CREATE INDEX IF NOT EXISTS idx_households_status ON "case".households(status);
CREATE INDEX IF NOT EXISTS idx_households_dwelling ON "case".households(dwelling_id);
CREATE INDEX IF NOT EXISTS idx_assignments_user ON "case".household_assignments(user_id)
  WHERE unassigned_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_assignments_household ON "case".household_assignments(household_id)
  WHERE unassigned_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_members_household ON "case".family_members(household_id);
CREATE INDEX IF NOT EXISTS idx_members_national_hash ON "case".family_members(national_id_hash)
  WHERE national_id_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ownership_dwelling ON "case".ownership_records(dwelling_id)
  WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_trajectory_household ON trajectory.life_trajectory_records(household_id);
CREATE INDEX IF NOT EXISTS idx_trajectory_member ON trajectory.life_trajectory_records(member_id);
CREATE INDEX IF NOT EXISTS idx_trajectory_period ON trajectory.life_trajectory_records(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_support_household ON support.support_records(household_id);
CREATE INDEX IF NOT EXISTS idx_support_program ON support.support_records(program_id);
CREATE INDEX IF NOT EXISTS idx_interventions_household ON support.interventions(household_id);
CREATE INDEX IF NOT EXISTS idx_external_mapping ON integration.external_id_mappings(connector_id, entity_type, internal_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_connector ON integration.sync_jobs(connector_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_org_time ON audit.audit_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit.audit_logs(resource, resource_id);
CREATE INDEX IF NOT EXISTS idx_data_access_user ON audit.data_access_logs(user_id, created_at DESC);

-- Composite for common queries
CREATE INDEX IF NOT EXISTS idx_households_org_status
  ON "case".households(organization_id, status) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY (tenant isolation template)
-- ---------------------------------------------------------------------------
ALTER TABLE program.neighborhoods ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case".households ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case".family_members ENABLE ROW LEVEL SECURITY;

-- App sets: SET app.current_org_id = '<uuid>';
CREATE OR REPLACE FUNCTION core.current_org_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_org_id', true), '')::UUID;
$$ LANGUAGE SQL STABLE;

CREATE POLICY tenant_isolation_neighborhoods ON program.neighborhoods
  USING (organization_id = core.current_org_id() OR core.current_org_id() IS NULL);

CREATE POLICY tenant_isolation_households ON "case".households
  USING (organization_id = core.current_org_id() OR core.current_org_id() IS NULL);

CREATE POLICY tenant_isolation_members ON "case".family_members
  USING (organization_id = core.current_org_id() OR core.current_org_id() IS NULL);

-- ---------------------------------------------------------------------------
-- MASKED VIEW for analysts (no PII)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW "case".v_family_members_masked AS
SELECT
  id,
  organization_id,
  household_id,
  member_role,
  is_beneficiary,
  first_name,
  LEFT(last_name, 1) || '***' AS last_name_masked,
  gender,
  date_trunc('year', birth_date)::DATE AS birth_year,
  marital_status,
  is_identity_verified,
  left_household_at,
  created_at,
  updated_at
FROM "case".family_members
WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- HELPER: encrypt PII (application supplies key via app.enc_key setting)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.encrypt_pii(plain_text TEXT) RETURNS BYTEA AS $$
  SELECT pgp_sym_encrypt(plain_text, current_setting('app.enc_key', true));
$$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION core.decrypt_pii(cipher BYTEA) RETURNS TEXT AS $$
  SELECT pgp_sym_decrypt(cipher, current_setting('app.enc_key', true));
$$ LANGUAGE SQL;

-- ---------------------------------------------------------------------------
-- COMMENTS on sensitive columns
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN "case".family_members.national_id_enc IS 'S3-PII: encrypted national ID';
COMMENT ON COLUMN "case".family_members.national_id_hash IS 'S3-PII: SHA-256 hash for dedup';
COMMENT ON COLUMN "case".family_members.phone_enc IS 'S3-PII: encrypted phone';
COMMENT ON COLUMN trajectory.life_trajectory_records.monthly_income IS 'S3-PII: income data';
COMMENT ON COLUMN "case".ownership_records.monthly_rent IS 'S3-PII: financial data';
