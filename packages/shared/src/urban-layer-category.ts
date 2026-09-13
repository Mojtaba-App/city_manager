/** دسته‌بندی لایه‌های اطلاعاتی شهری — پایه GIS + طرح‌های فرادست تا اجرایی */

export enum UrbanLayerCategory {
  // پایه GIS
  CITY_BOUNDARY = 'city_boundary',
  DISTRICT = 'district',
  URBAN_PLAN = 'urban_plan',
  ZONING = 'zoning',
  INFRASTRUCTURE = 'infrastructure',
  CUSTOM = 'custom',

  // ۱) فرادست (ملی/منطقه‌ای)
  PLAN_SPATIAL = 'plan_spatial',
  PLAN_NATIONAL = 'plan_national',
  PLAN_METRO = 'plan_metro',

  // ۲) جامع (شهر)
  PLAN_MASTER = 'plan_master',
  PLAN_STRATEGIC = 'plan_strategic',

  // ۳) تفصیلی (محله/منطقه)
  PLAN_DETAILED = 'plan_detailed',
  PLAN_HADI = 'plan_hadi',

  // ۴) موضوعی / ویژه
  PLAN_REGENERATION = 'plan_regeneration',
  PLAN_RENEWAL = 'plan_renewal',
  PLAN_IMPROVEMENT = 'plan_improvement',
  PLAN_RESTORATION = 'plan_restoration',
  PLAN_INFILL = 'plan_infill',
  PLAN_TOD = 'plan_tod',

  // ۵) اجرایی / موضعی
  PLAN_SPECIAL = 'plan_special',
  PLAN_LAND_PREP = 'plan_land_prep',
  PLAN_PLACEMAKING = 'plan_placemaking',
}

export const URBAN_LAYER_CATEGORY_LABELS: Record<UrbanLayerCategory, string> = {
  [UrbanLayerCategory.CITY_BOUNDARY]: 'مرز شهر',
  [UrbanLayerCategory.DISTRICT]: 'منطقه / ناحیه',
  [UrbanLayerCategory.URBAN_PLAN]: 'طرح شهری (عمومی)',
  [UrbanLayerCategory.ZONING]: 'پهنه‌بندی',
  [UrbanLayerCategory.INFRASTRUCTURE]: 'زیرساخت',
  [UrbanLayerCategory.CUSTOM]: 'سفارشی',

  [UrbanLayerCategory.PLAN_SPATIAL]: 'آمایش سرزمین',
  [UrbanLayerCategory.PLAN_NATIONAL]: 'کالبدی ملی',
  [UrbanLayerCategory.PLAN_METRO]: 'مجموعه شهری / منطقه‌ای',

  [UrbanLayerCategory.PLAN_MASTER]: 'طرح جامع شهری',
  [UrbanLayerCategory.PLAN_STRATEGIC]: 'راهبردی-ساختاری',

  [UrbanLayerCategory.PLAN_DETAILED]: 'طرح تفصیلی',
  [UrbanLayerCategory.PLAN_HADI]: 'طرح هادی',

  [UrbanLayerCategory.PLAN_REGENERATION]: 'بازآفرینی شهری',
  [UrbanLayerCategory.PLAN_RENEWAL]: 'نوسازی بافت فرسوده',
  [UrbanLayerCategory.PLAN_IMPROVEMENT]: 'بهسازی',
  [UrbanLayerCategory.PLAN_RESTORATION]: 'مرمت شهری',
  [UrbanLayerCategory.PLAN_INFILL]: 'توسعه میان‌افزا',
  [UrbanLayerCategory.PLAN_TOD]: 'توسعه مبتنی بر حمل‌ونقل (TOD)',

  [UrbanLayerCategory.PLAN_SPECIAL]: 'طرح ویژه',
  [UrbanLayerCategory.PLAN_LAND_PREP]: 'آماده‌سازی زمین',
  [UrbanLayerCategory.PLAN_PLACEMAKING]: 'شهرسازی محله‌محور',
};

export type UrbanLayerCategoryGroupId =
  | 'base'
  | 'faradast'
  | 'comprehensive'
  | 'detailed'
  | 'thematic'
  | 'executive';

export interface UrbanLayerCategoryGroup {
  id: UrbanLayerCategoryGroupId;
  label: string;
  categories: UrbanLayerCategory[];
}

/** گروه‌بندی کوتاه برای select دسته لایه */
export const URBAN_LAYER_CATEGORY_GROUPS: UrbanLayerCategoryGroup[] = [
  {
    id: 'base',
    label: 'پایه GIS',
    categories: [
      UrbanLayerCategory.CITY_BOUNDARY,
      UrbanLayerCategory.DISTRICT,
      UrbanLayerCategory.URBAN_PLAN,
      UrbanLayerCategory.ZONING,
      UrbanLayerCategory.INFRASTRUCTURE,
      UrbanLayerCategory.CUSTOM,
    ],
  },
  {
    id: 'faradast',
    label: 'طرح‌های فرادست',
    categories: [
      UrbanLayerCategory.PLAN_SPATIAL,
      UrbanLayerCategory.PLAN_NATIONAL,
      UrbanLayerCategory.PLAN_METRO,
    ],
  },
  {
    id: 'comprehensive',
    label: 'طرح‌های جامع',
    categories: [
      UrbanLayerCategory.PLAN_MASTER,
      UrbanLayerCategory.PLAN_STRATEGIC,
    ],
  },
  {
    id: 'detailed',
    label: 'طرح‌های تفصیلی',
    categories: [
      UrbanLayerCategory.PLAN_DETAILED,
      UrbanLayerCategory.PLAN_HADI,
    ],
  },
  {
    id: 'thematic',
    label: 'طرح‌های موضوعی / ویژه',
    categories: [
      UrbanLayerCategory.PLAN_REGENERATION,
      UrbanLayerCategory.PLAN_RENEWAL,
      UrbanLayerCategory.PLAN_IMPROVEMENT,
      UrbanLayerCategory.PLAN_RESTORATION,
      UrbanLayerCategory.PLAN_INFILL,
      UrbanLayerCategory.PLAN_TOD,
    ],
  },
  {
    id: 'executive',
    label: 'طرح‌های اجرایی / موضعی',
    categories: [
      UrbanLayerCategory.PLAN_SPECIAL,
      UrbanLayerCategory.PLAN_LAND_PREP,
      UrbanLayerCategory.PLAN_PLACEMAKING,
    ],
  },
];

export function urbanLayerCategoryLabel(category: string | null | undefined): string {
  if (!category) return '—';
  return URBAN_LAYER_CATEGORY_LABELS[category as UrbanLayerCategory] ?? category;
}

export function isUrbanLayerCategory(value: unknown): value is UrbanLayerCategory {
  return typeof value === 'string' && Object.values(UrbanLayerCategory).includes(value as UrbanLayerCategory);
}
