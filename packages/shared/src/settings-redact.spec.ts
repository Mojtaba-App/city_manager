import {
  isSettingsRedactedValue,
  isSettingsSecretField,
  mergeSettingsValuePreservingSecrets,
  redactSettingsValue,
  SETTINGS_REDACTED_PLACEHOLDER,
} from './settings-redact';

describe('settings-redact', () => {
  it('detects secret field names', () => {
    expect(isSettingsSecretField('apiKey')).toBe(true);
    expect(isSettingsSecretField('webhookSecret')).toBe(true);
    expect(isSettingsSecretField('sender')).toBe(false);
  });

  it('redacts nested secret strings', () => {
    expect(
      redactSettingsValue({
        enabled: true,
        apiKey: 'secret-value',
        nested: { token: 'abc' },
      }),
    ).toEqual({
      enabled: true,
      apiKey: SETTINGS_REDACTED_PLACEHOLDER,
      nested: { token: SETTINGS_REDACTED_PLACEHOLDER },
    });
  });

  it('preserves previous secrets when placeholder is posted', () => {
    expect(
      mergeSettingsValuePreservingSecrets(
        { apiKey: 'real-key', sender: '1000' },
        { apiKey: SETTINGS_REDACTED_PLACEHOLDER, sender: '2000', enabled: true },
      ),
    ).toEqual({ apiKey: 'real-key', sender: '2000', enabled: true });
  });

  it('recognizes redacted placeholders', () => {
    expect(isSettingsRedactedValue(SETTINGS_REDACTED_PLACEHOLDER)).toBe(true);
    expect(isSettingsRedactedValue('real')).toBe(false);
  });
});
