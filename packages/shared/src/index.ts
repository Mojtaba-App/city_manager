/** نقش‌های پایه سیستم — در مراحل بعد گسترش می‌یابد */
export enum SystemRole {
  SUPER_ADMIN = 'super_admin',
  ORG_ADMIN = 'org_admin',
  MANAGER = 'manager',
  SOCIAL_WORKER = 'social_worker',
  ANALYST = 'analyst',
  VIEWER = 'viewer',
}

/** مجوزهای هسته — RBAC مبتنی بر resource:action */
export enum Permission {
  USERS_READ = 'users:read',
  USERS_WRITE = 'users:write',
  USERS_DELETE = 'users:delete',
  ROLES_READ = 'roles:read',
  ROLES_WRITE = 'roles:write',
  AUDIT_READ = 'audit:read',
  ORG_READ = 'org:read',
  ORG_WRITE = 'org:write',
  NEIGHBORHOODS_READ = 'neighborhoods:read',
  NEIGHBORHOODS_WRITE = 'neighborhoods:write',
  FABRICS_READ = 'fabrics:read',
  FABRICS_WRITE = 'fabrics:write',
  GIS_LAYERS_READ = 'gis_layers:read',
  GIS_LAYERS_WRITE = 'gis_layers:write',
  GIS_LAYERS_PUBLISH = 'gis_layers:publish',
  DWELLINGS_READ = 'dwellings:read',
  DWELLINGS_WRITE = 'dwellings:write',
  GIS_INGEST = 'gis:ingest',
  GIS_SPATIAL_SEARCH = 'gis:spatial_search',
  HOUSEHOLDS_READ = 'households:read',
  HOUSEHOLDS_WRITE = 'households:write',
  HOUSEHOLDS_READ_PII = 'households:read_pii',
  MEMBERS_READ = 'members:read',
  MEMBERS_WRITE = 'members:write',
  MEMBERS_READ_PII = 'members:read_pii',
  AGENCIES_READ = 'agencies:read',
  AGENCIES_WRITE = 'agencies:write',
  INSURANCE_READ = 'insurance:read',
  INSURANCE_WRITE = 'insurance:write',
  FORMS_READ = 'forms:read',
  FORMS_WRITE = 'forms:write',
  TRAJECTORY_READ = 'trajectory:read',
  TRAJECTORY_WRITE = 'trajectory:write',
  TRAJECTORY_READ_PII = 'trajectory:read_pii',
  SETTINGS_READ = 'settings:read',
  SETTINGS_WRITE = 'settings:write',
  REPORTS_READ = 'reports:read',
  REPORTS_WRITE = 'reports:write',
  INTEGRATION_READ = 'integration:read',
  INTEGRATION_WRITE = 'integration:write',
  INTEGRATION_EXECUTE = 'integration:execute',
  SECURITY_READ = 'security:read',
  SECURITY_WRITE = 'security:write',
  SECRETS_MANAGE = 'secrets:manage',
  OAUTH_MANAGE = 'oauth:manage',
  OPERATIONS_READ = 'operations:read',
  OPERATIONS_WRITE = 'operations:write',
  OPERATIONS_ASSIGN = 'operations:assign',
  DOCUMENTS_READ = 'documents:read',
  DOCUMENTS_WRITE = 'documents:write',
  MESSAGING_SEND = 'messaging:send',
  NOTIFICATIONS_READ = 'notifications:read',
  NOTIFICATIONS_WRITE = 'notifications:write',
  REFERRALS_READ = 'referrals:read',
  REFERRALS_WRITE = 'referrals:write',
  CONSENTS_READ = 'consents:read',
  CONSENTS_WRITE = 'consents:write',
  PORTAL_MANAGE = 'portal:manage',
  PORTAL_ACCESS = 'portal:access',
  FIELD_ACCESS = 'field:access',
  SHARE_VIEWS_READ = 'share_views:read',
  SHARE_VIEWS_MANAGE = 'share_views:manage',
}

export const ROLE_PERMISSIONS: Record<SystemRole, Permission[]> = {
  [SystemRole.SUPER_ADMIN]: Object.values(Permission),
  [SystemRole.ORG_ADMIN]: [
    Permission.USERS_READ,
    Permission.USERS_WRITE,
    Permission.ROLES_READ,
    Permission.ROLES_WRITE,
    Permission.AUDIT_READ,
    Permission.ORG_READ,
    Permission.ORG_WRITE,
    Permission.NEIGHBORHOODS_READ,
    Permission.NEIGHBORHOODS_WRITE,
    Permission.FABRICS_READ,
    Permission.FABRICS_WRITE,
    Permission.GIS_LAYERS_READ,
    Permission.GIS_LAYERS_WRITE,
    Permission.GIS_LAYERS_PUBLISH,
    Permission.DWELLINGS_READ,
    Permission.DWELLINGS_WRITE,
    Permission.GIS_INGEST,
    Permission.GIS_SPATIAL_SEARCH,
    Permission.HOUSEHOLDS_READ,
    Permission.HOUSEHOLDS_WRITE,
    Permission.HOUSEHOLDS_READ_PII,
    Permission.MEMBERS_READ,
    Permission.MEMBERS_WRITE,
    Permission.MEMBERS_READ_PII,
    Permission.AGENCIES_READ,
    Permission.AGENCIES_WRITE,
    Permission.INSURANCE_READ,
    Permission.INSURANCE_WRITE,
    Permission.FORMS_READ,
    Permission.FORMS_WRITE,
    Permission.TRAJECTORY_READ,
    Permission.TRAJECTORY_WRITE,
    Permission.TRAJECTORY_READ_PII,
    Permission.SETTINGS_READ,
    Permission.SETTINGS_WRITE,
    Permission.REPORTS_READ,
    Permission.REPORTS_WRITE,
    Permission.INTEGRATION_READ,
    Permission.INTEGRATION_WRITE,
    Permission.INTEGRATION_EXECUTE,
    Permission.SECURITY_READ,
    Permission.SECURITY_WRITE,
    Permission.SECRETS_MANAGE,
    Permission.OAUTH_MANAGE,
    Permission.OPERATIONS_READ,
    Permission.OPERATIONS_WRITE,
    Permission.OPERATIONS_ASSIGN,
    Permission.DOCUMENTS_READ,
    Permission.DOCUMENTS_WRITE,
    Permission.MESSAGING_SEND,
    Permission.NOTIFICATIONS_READ,
    Permission.NOTIFICATIONS_WRITE,
    Permission.REFERRALS_READ,
    Permission.REFERRALS_WRITE,
    Permission.CONSENTS_READ,
    Permission.CONSENTS_WRITE,
    Permission.PORTAL_MANAGE,
    Permission.FIELD_ACCESS,
    Permission.SHARE_VIEWS_READ,
    Permission.SHARE_VIEWS_MANAGE,
  ],
  [SystemRole.MANAGER]: [
    Permission.USERS_READ,
    Permission.ROLES_READ,
    Permission.AUDIT_READ,
    Permission.ORG_READ,
    Permission.NEIGHBORHOODS_READ,
    Permission.FABRICS_READ,
    Permission.GIS_LAYERS_READ,
    Permission.DWELLINGS_READ,
    Permission.GIS_SPATIAL_SEARCH,
    Permission.HOUSEHOLDS_READ,
    Permission.MEMBERS_READ,
    Permission.INSURANCE_READ,
    Permission.AGENCIES_READ,
    Permission.FORMS_READ,
    Permission.TRAJECTORY_READ,
    Permission.SETTINGS_READ,
    Permission.REPORTS_READ,
    Permission.INTEGRATION_READ,
    Permission.SECURITY_READ,
    Permission.OPERATIONS_READ,
    Permission.DOCUMENTS_READ,
    Permission.NOTIFICATIONS_READ,
    Permission.REFERRALS_READ,
    Permission.CONSENTS_READ,
    Permission.FIELD_ACCESS,
    Permission.SHARE_VIEWS_READ,
    Permission.SHARE_VIEWS_MANAGE,
  ],
  [SystemRole.SOCIAL_WORKER]: [
    Permission.ORG_READ,
    Permission.NEIGHBORHOODS_READ,
    Permission.FABRICS_READ,
    Permission.GIS_LAYERS_READ,
    Permission.DWELLINGS_READ,
    Permission.DWELLINGS_WRITE,
    Permission.GIS_SPATIAL_SEARCH,
    Permission.HOUSEHOLDS_READ,
    Permission.HOUSEHOLDS_WRITE,
    Permission.HOUSEHOLDS_READ_PII,
    Permission.MEMBERS_READ,
    Permission.MEMBERS_WRITE,
    Permission.MEMBERS_READ_PII,
    Permission.INSURANCE_READ,
    Permission.INSURANCE_WRITE,
    Permission.AGENCIES_READ,
    Permission.FORMS_READ,
    Permission.TRAJECTORY_READ,
    Permission.TRAJECTORY_WRITE,
    Permission.TRAJECTORY_READ_PII,
    Permission.REPORTS_READ,
    Permission.OPERATIONS_READ,
    Permission.OPERATIONS_WRITE,
    Permission.OPERATIONS_ASSIGN,
    Permission.DOCUMENTS_READ,
    Permission.DOCUMENTS_WRITE,
    Permission.MESSAGING_SEND,
    Permission.NOTIFICATIONS_READ,
    Permission.NOTIFICATIONS_WRITE,
    Permission.REFERRALS_READ,
    Permission.REFERRALS_WRITE,
    Permission.CONSENTS_READ,
    Permission.CONSENTS_WRITE,
    Permission.PORTAL_MANAGE,
    Permission.FIELD_ACCESS,
  ],
  [SystemRole.ANALYST]: [
    Permission.ORG_READ,
    Permission.AUDIT_READ,
    Permission.NEIGHBORHOODS_READ,
    Permission.FABRICS_READ,
    Permission.GIS_LAYERS_READ,
    Permission.DWELLINGS_READ,
    Permission.GIS_SPATIAL_SEARCH,
    Permission.HOUSEHOLDS_READ,
    Permission.TRAJECTORY_READ,
    Permission.REPORTS_READ,
  ],
  [SystemRole.VIEWER]: [
    Permission.ORG_READ,
    Permission.NEIGHBORHOODS_READ,
    Permission.FABRICS_READ,
    Permission.GIS_LAYERS_READ,
    Permission.DWELLINGS_READ,
    Permission.GIS_SPATIAL_SEARCH,
    Permission.HOUSEHOLDS_READ,
    Permission.MEMBERS_READ,
    Permission.FORMS_READ,
    Permission.TRAJECTORY_READ,
    Permission.REPORTS_READ,
  ],
};

export * from './case-types';
export * from './household-status';
export * from './trajectory-types';
export * from './admin-types';
export * from './analytics-types';
export * from './analytics-report-layout';
export * from './integration-types';
export * from './security-types';
export * from './project-types';
export * from './operations-types';
export * from './regeneration-types';
export * from './collaboration-types';
export * from './share-view-types';
export * from './quality-types';
export * from './ux-config';
export * from './filter-types';
export * from './validation';
export * from './field-meta';
export * from './login-lockout';
export * from './settings-redact';
export * from './user-account';
export * from './presence';
export * from './presence-stream';
export * from './sms-providers';
export * from './sidebar-nav-scroll';
export * from './query-load';
export * from './design-tokens';
export * from './report-registry';
export * from './notification-stream';
export * from './utm';
export * from './persian-digits';
export * from './layer-style';
export * from './gis-attributes';
export * from './gis-map-utils';
export * from './gis-map-core';

export * from './urban-layer-health';

export * from './layer-catalog';
export * from './api-result';
export * from './map-print-layout';
export * from './auth-session';
export * from './dashboard-access';

/** GeoJSON FeatureCollection envelope for map API */
export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

export interface GeoJsonFeature {
  type: 'Feature';
  id?: string | number;
  geometry: GeoJsonGeometry;
  properties: Record<string, unknown>;
}

export type GeoJsonGeometry = {
  type: string;
  coordinates: unknown;
};

export enum GisFeatureType {
  NEIGHBORHOOD = 'neighborhood',
  FABRIC = 'fabric',
  DWELLING = 'dwelling',
  LAYER_FEATURE = 'layer_feature',
}

export * from './urban-layer-category';

export enum SpatialFileFormat {
  GEOJSON = 'geojson',
  KML = 'kml',
  KMZ = 'kmz',
  SHAPEFILE = 'shapefile',
}

export enum IngestTargetType {
  NEIGHBORHOOD = 'neighborhood',
  FABRIC = 'fabric',
  LAYER = 'layer',
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    retryAfterSec?: number;
    contactAdmin?: boolean;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface JwtPayload {
  sub: string;
  email: string;
  orgId: string | null;
  /** System roles plus org-defined custom role codes */
  roles: Array<SystemRole | string>;
  permissions: Permission[];
  /** پورتال شهروند — محدود به یک خانوار */
  householdId?: string;
  portal?: boolean;
}

export * from './constants';
