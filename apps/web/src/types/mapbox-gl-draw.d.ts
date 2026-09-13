declare module '@mapbox/mapbox-gl-draw' {
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
    onAdd(map: maplibregl.Map): HTMLElement;
    onRemove(map: maplibregl.Map): void;
    changeMode(mode: string, options?: object): void;
    getAll(): GeoJSON.FeatureCollection;
    deleteAll(): void;
    add(feature: GeoJSON.Feature | GeoJSON.FeatureCollection | GeoJSON.Geometry): string[];
    delete(ids: string | string[]): this;
    getSelectedIds(): string[];
    getMode(): string;
    static constants: { classes: Record<string, string> };
  }
}
