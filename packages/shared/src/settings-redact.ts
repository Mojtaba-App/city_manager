/** Placeholder returned by GET settings for secret fields (never the real value). */
export const SETTINGS_REDACTED_PLACEHOLDER = '********';

const SECRET_KEY_RE =
  /^(api[_-]?key|password|secret|token|webhook[_-]?secret|client[_-]?secret|access[_-]?key|private[_-]?key|auth[_-]?token)$/i;

export function isSettingsSecretField(key: string): boolean {
  return SECRET_KEY_RE.test(key.trim());
}

export function isSettingsRedactedValue(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  return v === SETTINGS_REDACTED_PLACEHOLDER || v === '__REDACTED__' || /^•+$/.test(v);
}

/** Deep-redact secret-like string fields for API responses. */
export function redactSettingsValue(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value ?? {})) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = redactSettingsValue(v as Record<string, unknown>);
      continue;
    }
    if (isSettingsSecretField(k) && typeof v === 'string' && v.length > 0) {
      out[k] = SETTINGS_REDACTED_PLACEHOLDER;
      continue;
    }
    out[k] = v;
  }
  return out;
}

/**
 * When client posts a redacted placeholder for a secret field, keep the previous stored value.
 */
export function mergeSettingsValuePreservingSecrets(
  previous: Record<string, unknown> | undefined | null,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const prev = previous ?? {};
  const out: Record<string, unknown> = { ...incoming };
  for (const [k, v] of Object.entries(incoming)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const prevChild = (prev[k] && typeof prev[k] === 'object' && !Array.isArray(prev[k]))
        ? (prev[k] as Record<string, unknown>)
        : undefined;
      out[k] = mergeSettingsValuePreservingSecrets(prevChild, v as Record<string, unknown>);
      continue;
    }
    if (isSettingsSecretField(k) && isSettingsRedactedValue(v)) {
      out[k] = typeof prev[k] === 'string' ? prev[k] : '';
    }
  }
  return out;
}
