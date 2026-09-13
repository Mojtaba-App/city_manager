/** Preset reasons when an admin deactivates or deletes a user account. */
export const USER_INACTIVE_REASON_PRESETS = [
  { id: 'left_org', label: 'ترک سازمان / پایان همکاری' },
  { id: 'security', label: 'نقض مقررات امنیتی' },
  { id: 'user_request', label: 'درخواست خود کاربر' },
  { id: 'duplicate', label: 'حساب تکراری یا اشتباه' },
  { id: 'custom', label: 'سایر (توضیح دستی)' },
] as const;

export type UserInactiveReasonPresetId = (typeof USER_INACTIVE_REASON_PRESETS)[number]['id'];

export type ClientPlatform = 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'unknown';

export const CLIENT_PLATFORM_LABELS: Record<ClientPlatform, string> = {
  windows: 'ویندوز',
  macos: 'macOS',
  linux: 'لینوکس',
  android: 'اندروید',
  ios: 'iOS',
  unknown: 'نامشخص',
};

export function validateInactiveReason(value: unknown): string | undefined {
  const s = String(value ?? '').trim();
  if (s.length < 3) return 'ذکر دلیل الزامی است (حداقل ۳ کاراکتر)';
  if (s.length > 500) return 'دلیل نباید بیشتر از ۵۰۰ کاراکتر باشد';
  return undefined;
}

export function resolveInactiveReason(
  presetId: string,
  customText?: string,
): { reason?: string; error?: string } {
  const preset = USER_INACTIVE_REASON_PRESETS.find((p) => p.id === presetId);
  if (!preset) return { error: 'گزینه دلیل نامعتبر است' };
  if (presetId === 'custom') {
    const err = validateInactiveReason(customText);
    return err ? { error: err } : { reason: String(customText).trim() };
  }
  return { reason: preset.label };
}

/** Best-effort OS detection from User-Agent for admin profile view. */
export function parseClientPlatform(userAgent?: string | null): {
  platform: ClientPlatform;
  label: string;
} {
  const ua = String(userAgent ?? '');
  if (!ua.trim()) {
    return { platform: 'unknown', label: CLIENT_PLATFORM_LABELS.unknown };
  }
  if (/Android/i.test(ua)) {
    return { platform: 'android', label: CLIENT_PLATFORM_LABELS.android };
  }
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return { platform: 'ios', label: CLIENT_PLATFORM_LABELS.ios };
  }
  if (/Windows NT|Win64|Win32/i.test(ua)) {
    return { platform: 'windows', label: CLIENT_PLATFORM_LABELS.windows };
  }
  if (/Mac OS X|Macintosh/i.test(ua)) {
    return { platform: 'macos', label: CLIENT_PLATFORM_LABELS.macos };
  }
  if (/Linux/i.test(ua)) {
    return { platform: 'linux', label: CLIENT_PLATFORM_LABELS.linux };
  }
  return { platform: 'unknown', label: CLIENT_PLATFORM_LABELS.unknown };
}
