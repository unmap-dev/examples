// Turning decoded basemap tiles and /places results into AliveData. Pure: the caller decodes the
// tiles (for example with `tileFeatures` from @unmap/maps) and fetches the places.

import type { AliveData, LngLat, Poi } from "./alive-signals";

export const LIFE_CATEGORIES = ["food.cafe", "food.bakery", "food.restaurant", "food.bar", "food.pub", "food.ice_cream", "shop.books", "shop.clothes"] as const;
export const LANDMARK_CATEGORIES = ["culture.museum", "culture.gallery", "culture.theatre", "culture.arts_centre", "culture.library", "tourism.attraction", "tourism.viewpoint", "tourism.artwork"] as const;

const PARK_KINDS = new Set(["park", "garden", "nature_reserve", "forest", "wood", "village_green", "dog_park", "playground"]);
const NOT_WATER = new Set(["swimming_pool", "fountain"]);
const NOT_ROADS = new Set(["rail", "ferry"]);

/** The part of a GeoJSON feature this module reads, declared here so the block imports no types. */
export interface TileFeature {
  properties?: Record<string, unknown> | null;
  geometry: { type: string; coordinates?: unknown } | null;
}

type Pos = number[];

const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const asRing = (r: Pos[]): LngLat[] => r.map((p) => [p[0]!, p[1]!]);

function inRingLngLat(p: LngLat, ring: LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function dataFromTiles(features: Record<string, TileFeature[]>): Omit<AliveData, "life" | "landmarks"> {
  const parks: AliveData["parks"] = [];
  const water: AliveData["water"] = [];
  const roads: AliveData["roads"] = [];

  for (const f of features.landuse ?? []) {
    const kind = str(f.properties?.kind);
    if (!kind || !PARK_KINDS.has(kind) || !f.geometry) continue;
    const c = f.geometry.coordinates;
    const polys = f.geometry.type === "Polygon" ? [c as Pos[][]] : f.geometry.type === "MultiPolygon" ? (c as Pos[][][]) : [];
    for (const rings of polys) parks.push({ name: str(f.properties?.name), rings: rings.map(asRing) });
  }

  for (const f of features.water ?? []) {
    const kind = str(f.properties?.kind);
    if ((kind && NOT_WATER.has(kind)) || !f.geometry) continue;
    const c = f.geometry.coordinates;
    const t = f.geometry.type;
    const lines =
      t === "Polygon" ? (c as Pos[][]) : t === "MultiPolygon" ? (c as Pos[][][]).flat() : t === "LineString" ? [c as Pos[]] : t === "MultiLineString" ? (c as Pos[][]) : [];
    if (lines.length) water.push({ lines: lines.map(asRing) });
  }

  for (const f of features.roads ?? []) {
    const kind = str(f.properties?.kind);
    if (!kind || NOT_ROADS.has(kind) || !f.geometry) continue;
    const c = f.geometry.coordinates;
    const lines = f.geometry.type === "LineString" ? [c as Pos[]] : f.geometry.type === "MultiLineString" ? (c as Pos[][]) : [];
    for (const line of lines) roads.push({ kind, detail: str(f.properties?.kind_detail), line: asRing(line) });
  }

  // Protomaps landuse polygons carry no name; a park's name rides on a pois point inside it.
  const named: { name: string; at: LngLat }[] = [];
  for (const f of features.pois ?? []) {
    const kind = str(f.properties?.kind);
    const name = str(f.properties?.name);
    if (kind && PARK_KINDS.has(kind) && name && f.geometry?.type === "Point") {
      const [x, y] = f.geometry.coordinates as Pos;
      named.push({ name, at: [x!, y!] });
    }
  }
  for (const p of parks) {
    const outer = p.rings[0];
    if (!p.name && outer) p.name = named.find((n) => inRingLngLat(n.at, outer))?.name;
  }

  return { parks, water, roads };
}

export function poisFromPlaces(places: { id: string; name: string; category: string | null; coordinates: [number, number] }[]): Poi[] {
  return places.map((p) => ({ id: p.id, name: p.name, category: p.category ?? "", at: p.coordinates }));
}
