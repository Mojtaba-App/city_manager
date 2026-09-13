import { designTokens } from './design-tokens';

describe('designTokens', () => {
  it('exposes light and dark palettes with CSS var names', () => {
    expect(designTokens.light.colorPrimary).toBe('#0f4c5c');
    expect(designTokens.dark.colorBg).toBe('#0f161c');
    expect(designTokens.cssVar.primary).toBe('--color-primary');
    expect(designTokens.light.space[4]).toBe('1rem');
  });
});
