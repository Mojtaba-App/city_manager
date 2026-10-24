declare module '@mapbox/mapbox-gl-draw' {
  import type { Feature, FeatureCollection, Geometry } from 'geojson';
  import type { Map } from 'maplibre-gl';

  interface MapboxDrawOptions {
    displayControlsDefault?: boolean;
    controls?: Record<string, boolean>;
    defaultMode?: string;
    styles?: object[];
    boxSelect?: boolean;
    keybindings?: boolean;
    touchEnabled?: boolean;
    modes?: Record<string, object>;
  }

  export default class MapboxDraw {
    constructor(options?: MapboxDrawOptions);
    onAdd(map: Map): HTMLElement;
    onRemove(map: Map): void;
    changeMode(mode: string, options?: object): void;
    getAll(): FeatureCollection;
    deleteAll(): void;
    add(feature: Feature | FeatureCollection | Geometry): string[];
    delete(ids: string | string[]): this;
    getSelectedIds(): string[];
    getMode(): string;
    static constants: { classes: Record<string, string> };
  }
}
