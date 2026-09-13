import { buildSimplePdf } from './simple-pdf';

describe('buildSimplePdf', () => {
  it('returns a valid PDF header', () => {
    const pdf = buildSimplePdf({
      title: 'Demo',
      headers: ['A', 'B'],
      rows: [['1', '2']],
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.toString()).toContain('Demo');
  });
});
