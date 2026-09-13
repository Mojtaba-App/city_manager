declare module 'shpjs' {
  import { FeatureCollection } from 'geojson';
  function shp(buffer: Buffer | ArrayBuffer | string): Promise<FeatureCollection | FeatureCollection[]>;
  export default shp;
}
