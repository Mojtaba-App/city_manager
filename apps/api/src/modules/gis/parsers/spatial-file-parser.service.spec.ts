import { SpatialFileParserService } from './spatial-file-parser.service';

function makeService() {
  return new SpatialFileParserService();
}

const KML_WITH_POLYGON = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Plain Zone</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              48.6,31.3,0
              48.7,31.3,0
              48.7,31.4,0
              48.6,31.4,0
              48.6,31.3,0
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;

describe('SpatialFileParserService', () => {
  const svc = makeService();

  it('parses KML polygons without injecting per-feature colour props', async () => {
    const buf = Buffer.from(KML_WITH_POLYGON, 'utf8');
    const { geojson } = await svc.parse(buf, 'test.kml', 'application/vnd.google-earth.kml+xml');

    expect(geojson.features).toHaveLength(1);
    const props = geojson.features[0].properties;
    expect(props.name).toBe('Plain Zone');
    expect(props['_kmlColorHex']).toBeUndefined();
    expect(props['_kmlFillOpacity']).toBeUndefined();
    expect(props['_kmlStrokeHex']).toBeUndefined();
  });

  it('polygon extraction skips non-polygon features', async () => {
    const buf = Buffer.from(KML_WITH_POLYGON, 'utf8');
    const { geojson } = await svc.parse(buf, 'test.kml');
    const polygons = svc.extractPolygons(geojson);
    expect(polygons.length).toBeGreaterThan(0);
    for (const f of polygons) {
      expect(f.geometry.type.toLowerCase()).toMatch(/polygon/);
    }
  });

  it('scan parser keeps KML balloon description for land-use popups', () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>قطعه</name>
      <description><![CDATA[<table><tr><td>KARBARI</td><td>مسکونی</td></tr></table>]]></description>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>48.6,31.3,0 48.7,31.3,0 48.7,31.4,0 48.6,31.4,0 48.6,31.3,0</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;
    const geojson = (svc as unknown as {
      parseKmlCoordinateScan(input: Buffer): { features: Array<{ properties: Record<string, unknown> }> };
    }).parseKmlCoordinateScan(Buffer.from(kml, 'utf8'));
    const desc = geojson.features[0].properties.description as { '@type'?: string; value?: string };
    expect(desc?.['@type']).toBe('html');
    expect(desc?.value).toContain('KARBARI');
  });
});
