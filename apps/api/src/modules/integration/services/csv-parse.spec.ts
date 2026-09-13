import { parseCsvRecords } from './csv-parse';

describe('parseCsvRecords', () => {
  it('parses header + rows with quoted commas', () => {
    const text = 'id,name,note\n1,"Ali, Reza",hello\n2,Sara,world\n';
    const rows = parseCsvRecords(text);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ id: '1', name: 'Ali, Reza', note: 'hello' });
    expect(rows[1].name).toBe('Sara');
  });

  it('returns empty for header-only', () => {
    expect(parseCsvRecords('a,b\n')).toEqual([]);
  });
});
