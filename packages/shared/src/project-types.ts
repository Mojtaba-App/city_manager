export type AreaProjectTargetType = 'neighborhood' | 'fabric';
export type AreaProjectKind = 'executive' | 'study';
export type AreaProjectPartyRole = 'consultant' | 'contractor';

export interface AreaProjectDto {
  id: string;
  organizationId: string;
  targetType: AreaProjectTargetType;
  targetId: string;
  name: string;
  projectKind: AreaProjectKind | string;
  partyRole?: AreaProjectPartyRole | string;
  partyName?: string;
  amount?: string | number;
  currency?: string;
  status: string;
  contractNumber?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  programId?: string;
  contractorName?: string;
  progressPercent?: number;
  budgetSpent?: string | number;
  householdsAffected?: number;
}

export const AREA_PROJECT_KIND_LABELS: Record<string, string> = {
  executive: 'اجرایی',
  study: 'مطالعاتی',
};

export const AREA_PROJECT_PARTY_LABELS: Record<string, string> = {
  consultant: 'مشاور',
  contractor: 'پیمانکار',
};

export const AREA_PROJECT_STATUS_LABELS: Record<string, string> = {
  planned: 'برنامه‌ریزی‌شده',
  active: 'در حال اجرا',
  completed: 'تکمیل‌شده',
  cancelled: 'لغو شده',
};
