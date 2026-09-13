import {
  flattenGisAttributes,
  gisAttributeRows,
  parseHtmlAttributeTable,
  stripHtmlToText,
} from './gis-attributes';

describe('gis-attributes', () => {
  it('parses ArcGIS KML balloon tables into fields', () => {
    const html = `
      <html><body><table>
        <tr style="font-weight:bold"><td>کاربری اراضی</td></tr>
        <tr><td>FID</td><td>12</td></tr>
        <tr><td>KARBARI</td><td>مسکونی</td></tr>
        <tr><td>ZONE</td><td>R2</td></tr>
      </table></body></html>`;
    const table = parseHtmlAttributeTable(html);
    expect(table.KARBARI).toBe('مسکونی');
    expect(table.ZONE).toBe('R2');
    expect(table.FID).toBeUndefined();
  });

  it('unpacks togeojson HTML description objects that ingest used to drop', () => {
    const flat = flattenGisAttributes({
      name: 'قطعه ۱۲',
      fill: '#ff0000',
      description: {
        '@type': 'html',
        value: '<table><tr><td>KARBARI</td><td>تجاری</td></tr><tr><td>DENSITY</td><td>120</td></tr></table>',
      },
    });
    expect(flat).toEqual(
      expect.objectContaining({
        name: 'قطعه ۱۲',
        KARBARI: 'تجاری',
        DENSITY: '120',
      }),
    );
    expect(flat?.fill).toBeUndefined();
  });

  it('keeps shapefile scalars and nested Data value objects', () => {
    const flat = flattenGisAttributes({
      LandUse: 'فضای سبز',
      AREA: 4012.5,
      note: { value: 'باغ عمومی', displayName: 'توضیح' },
    });
    expect(flat?.LandUse).toBe('فضای سبز');
    expect(flat?.AREA).toBe(4012.5);
    expect(flat?.note).toBe('باغ عمومی');
  });

  it('builds popup rows with Persian labels and skips title/style keys', () => {
    const rows = gisAttributeRows({
      name: 'x',
      KARBARI: 'آموزشی',
      fill: '#00ff00',
    });
    expect(rows).toEqual([{ key: 'KARBARI', label: 'کاربری', value: 'آموزشی' }]);
  });

  it('strips tags from leftover balloon text', () => {
    expect(stripHtmlToText('<b>باغ</b><br/>ملک وقفی')).toMatch(/باغ/);
  });
});
