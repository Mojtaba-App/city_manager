/** Browser globals expected by some GIS libs (e.g. shpjs) when running under Node */
const g = globalThis as Record<string, unknown>;
if (typeof g.self === 'undefined') {
  g.self = globalThis;
}
