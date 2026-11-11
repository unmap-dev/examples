// Pure scoring for Alive Maps: how green, watery, far from traffic, lively and notable a walking route is.
// No React, no I/O. Everything is projected to local metres around one origin, which is exact
// enough at walking scale (a few km) and keeps the maths to plain Euclid.

export type LngLat = [number, number];
export type XY = [number, number];

export interface Poi {
  id: string;
  name: string;
  category: string;
  at: LngLat;
}

export interface AliveData {
  parks: { name?: string; rings: LngLat[][] }[];
  water: { lines: LngLat[][] }[];
  roads: { kind: string; detail?: string; line: LngLat[] }[];
  life: Poi[];
  landmarks: Poi[];
}

export interface Highlights {
  /** `at`: where the route first enters the park, so a map can point at it. */
  parks: { name: string; metres: number; at: LngLat }[];
  life: Poi[];
  landmarks: Poi[];
}

export interface Scores {
  lengthM: number;
  green: number;
  water: number;
  quiet: number;
  life: number;
  landmarks: number;
  highlights: Highlights;
}

export interface Projector {
  to: (p: LngLat) => XY;
  from: (p: XY) => LngLat;
}

/** A line segment in projected metres. */
export interface Seg {
  a: XY;
  b: XY;
}

export interface Grid<T> {
  addBox(item: T, x0: number, y0: number, x1: number, y1: number): void;
  near(p: XY, r: number): Set<T>;
}

export interface PreparedPark {
  id: number;
  name?: string;
  rings: XY[][];
  area: number;
  /** [minX, minY, maxX, maxY] of the outer ring. */
  box: [number, number, number, number];
}

export interface PreparedPoi extends Poi {
  xy: XY;
}

/**
 * The data, projected and indexed once per origin. The fields are internal: later modules (the
 * walking graph, candidate generation) read the projector and grids, nothing outside this
 * package should depend on their layout.
 */
export interface Prepared {
  P: Projector;
  segs: Grid<Seg & { quiet: number }>;
  parks: PreparedPark[];
  parkGrid: Grid<PreparedPark>;
  waterGrid: Grid<Seg>;
  life: PreparedPoi[];
  lifeGrid: Grid<PreparedPoi>;
  landmarks: PreparedPoi[];
  landmarkGrid: Grid<PreparedPoi>;
}

export const SCORE_RADII = { park: 20, water: 80, life: 35, landmark: 60, road: 18 };

// ---------------------------------------------------------------------------------------------
// Projection and geometry

export function projector([lng0, lat0]: LngLat): Projector {
  const kx = Math.cos((lat0 * Math.PI) / 180) * 111320;
  const ky = 110540;
  return {
    to: ([lng, lat]) => [(lng - lng0) * kx, (lat - lat0) * ky],
    from: ([x, y]) => [x / kx + lng0, y / ky + lat0],
  };
}

export const dist = (a: XY, b: XY): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function segDist(p: XY, a: XY, b: XY): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

export function inRing(p: XY, ring: XY[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function ringArea(ring: XY[]): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j]![0] + ring[i]![0]) * (ring[j]![1] - ring[i]![1]);
  return Math.abs(a / 2);
}

export function lineLength(xy: XY[]): number {
  let d = 0;
  for (let i = 1; i < xy.length; i++) d += dist(xy[i - 1]!, xy[i]!);
  return d;
}

/** Points every `step` metres along a projected polyline. */
export function resample(xy: XY[], step: number): XY[] {
  const out: XY[] = [xy[0]!];
  let carry = 0;
  for (let i = 1; i < xy.length; i++) {
    const a = xy[i - 1]!;
    const b = xy[i]!;
    const seg = dist(a, b);
    let t = step - carry;
    while (t <= seg) {
      out.push([a[0] + ((b[0] - a[0]) * t) / seg, a[1] + ((b[1] - a[1]) * t) / seg]);
      t += step;
    }
    carry = (carry + seg) % step;
  }
  return out;
}

/** A spatial hash, so a 200-sample route against 20k road segments stays in the low milliseconds. */
export function grid<T>(cell: number): Grid<T> {
  const m = new Map<string, T[]>();
  return {
    addBox(item, x0, y0, x1, y1) {
      for (let x = Math.floor(x0 / cell); x <= Math.floor(x1 / cell); x++)
        for (let y = Math.floor(y0 / cell); y <= Math.floor(y1 / cell); y++) {
          const k = `${x},${y}`;
          const list = m.get(k);
          if (list) list.push(item);
          else m.set(k, [item]);
        }
    },
    near(p, r) {
      const seen = new Set<T>();
      for (let x = Math.floor((p[0] - r) / cell); x <= Math.floor((p[0] + r) / cell); x++)
        for (let y = Math.floor((p[1] - r) / cell); y <= Math.floor((p[1] + r) / cell); y++)
          for (const it of m.get(`${x},${y}`) ?? []) seen.add(it);
      return seen;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Preparing the data

/**
 * How pleasant a street is to walk on, 0-1, from the Protomaps road classes. The weakest signal
 * here: road class stands in for traffic and noise, which it only roughly is.
 */
export function quietness(kind: string, detail?: string): number {
  if (kind === "path") return detail === "cycleway" ? 0.8 : 1;
  if (kind === "minor_road") return detail === "service" ? 0.6 : 0.75;
  if (kind === "medium_road") return 0.35;
  if (kind === "major_road") return 0.1;
  if (kind === "highway") return 0;
  return 0.6;
}

export function prepare(data: AliveData, origin: LngLat): Prepared {
  const P = projector(origin);
  const segs = grid<Seg & { quiet: number }>(40);
  const parkGrid = grid<PreparedPark>(80);
  const waterGrid = grid<Seg>(60);
  const lifeGrid = grid<PreparedPoi>(60);
  const landmarkGrid = grid<PreparedPoi>(80);

  for (const r of data.roads) {
    const xy = r.line.map(P.to);
    const quiet = quietness(r.kind, r.detail);
    for (let i = 1; i < xy.length; i++) {
      const a = xy[i - 1]!;
      const b = xy[i]!;
      segs.addBox({ a, b, quiet }, Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]));
    }
  }

  const parks: PreparedPark[] = [];
  data.parks.forEach((p, id) => {
    const rings = p.rings.map((r) => r.map(P.to));
    const outer = rings[0];
    if (!outer || outer.length === 0) return;
    const xs = outer.map((q) => q[0]);
    const ys = outer.map((q) => q[1]);
    const park: PreparedPark = {
      id,
      name: p.name,
      rings,
      area: ringArea(outer),
      box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    };
    parkGrid.addBox(park, ...park.box);
    parks.push(park);
  });

  for (const w of data.water)
    for (const line of w.lines) {
      const xy = line.map(P.to);
      for (let i = 1; i < xy.length; i++) {
        const a = xy[i - 1]!;
        const b = xy[i]!;
        waterGrid.addBox({ a, b }, Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]));
      }
    }

  const points = (list: Poi[], g: Grid<PreparedPoi>): PreparedPoi[] =>
    list.map((p) => {
      const xy = P.to(p.at);
      const it = { ...p, xy };
      g.addBox(it, xy[0], xy[1], xy[0], xy[1]);
      return it;
    });

  return {
    P,
    segs,
    parks,
    parkGrid,
    waterGrid,
    life: points(data.life, lifeGrid),
    lifeGrid,
    landmarks: points(data.landmarks, landmarkGrid),
    landmarkGrid,
  };
}

// ---------------------------------------------------------------------------------------------
// Scoring one route

export function parksAt(p: Prepared, s: XY): PreparedPark[] {
  const r = SCORE_RADII.park;
  const out: PreparedPark[] = [];
  for (const park of p.parkGrid.near(s, r)) {
    const [x0, y0, x1, y1] = park.box;
    if (s[0] < x0 - r || s[0] > x1 + r || s[1] < y0 - r || s[1] > y1 + r) continue;
    const outer = park.rings[0]!;
    let hit = inRing(s, outer);
    for (let i = 1; i < outer.length && !hit; i++) hit = segDist(s, outer[i - 1]!, outer[i]!) <= r;
    if (hit) out.push(park);
  }
  return out;
}

/**
 * The loudest road within 18 m, not the way underfoot. Maps often draw a sidewalk as a separate
 * footway, so "the nearest way" would call a sidewalk beside a major road a quiet path. No road in
 * reach means off-street, which walks quiet.
 */
export function quietAt(p: Prepared, xy: XY): number {
  let q = 1;
  for (const seg of p.segs.near(xy, SCORE_RADII.road)) if (seg.quiet < q && segDist(xy, seg.a, seg.b) <= SCORE_RADII.road) q = seg.quiet;
  return q;
}

export function nearWater(p: Prepared, s: XY): boolean {
  for (const w of p.waterGrid.near(s, SCORE_RADII.water)) if (segDist(s, w.a, w.b) <= SCORE_RADII.water) return true;
  return false;
}

const toPoi = ({ id, name, category, at }: PreparedPoi): Poi => ({ id, name, category, at });

/**
 * Sub-scores, each 0-1, plus the named things the route passes, which is what makes a
 * recommendation explainable ("+2 min, past Central Memorial Park and 11 cafes").
 */
export function scoreRoute(p: Prepared, coords: LngLat[]): Scores {
  const xy = coords.map(p.P.to);
  const length = xy.length > 0 ? lineLength(xy) : 0;
  const samples = xy.length > 0 ? resample(xy, 15) : [];
  let green = 0;
  let water = 0;
  let quiet = 0;
  const parksHit = new Map<string, number>();
  const parkEntry = new Map<string, XY>();
  const lifeHit = new Map<string, PreparedPoi>();
  const landmarkHit = new Map<string, PreparedPoi>();

  for (const s of samples) {
    const here = parksAt(p, s);
    if (here.length) green++;
    for (const park of here)
      if (park.name) {
        parksHit.set(park.name, (parksHit.get(park.name) ?? 0) + 15);
        if (!parkEntry.has(park.name)) parkEntry.set(park.name, s);
      }
    if (nearWater(p, s)) water++;
    quiet += quietAt(p, s);
    for (const q of p.lifeGrid.near(s, SCORE_RADII.life)) if (dist(s, q.xy) <= SCORE_RADII.life) lifeHit.set(q.id, q);
    for (const q of p.landmarkGrid.near(s, SCORE_RADII.landmark)) if (dist(s, q.xy) <= SCORE_RADII.landmark) landmarkHit.set(q.id, q);
  }

  const n = Math.max(samples.length, 1);
  const km = Math.max(length / 1000, 0.3);
  return {
    lengthM: Math.round(length),
    green: green / n,
    water: water / n,
    quiet: samples.length ? quiet / n : 1,
    // Per km, saturating: a street "full of cafes" is ~20 storefronts a km within 35 m. Per km
    // rather than in total, so a long detour cannot win just for being long.
    life: Math.min(lifeHit.size / km / 20, 1),
    // Per km too: downtown is dense with public art, so a raw count saturated on every route.
    landmarks: Math.min(landmarkHit.size / km / 5, 1),
    highlights: {
      // Named once the route covers 45 m of the park, so a corner graze is not a visit.
      parks: [...parksHit.entries()]
        .filter(([, m]) => m >= 45)
        .sort((a, b) => b[1] - a[1])
        .map(([name, metres]) => ({ name, metres, at: p.P.from(parkEntry.get(name)!) })),
      life: [...lifeHit.values()].map(toPoi),
      landmarks: [...landmarkHit.values()].map(toPoi),
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Words

const WORDS = {
  en: {
    past: "past",
    and: " and ",
    river: "the river",
    storefronts: "storefronts",
    cafes: "cafés",
    quiet: "streets away from traffic",
    none: "busy streets, little to see",
    unknown: "no highlights found",
  },
  fr: {
    past: "en passant par",
    and: " et ",
    river: "la rivière",
    storefronts: "commerces",
    cafes: "cafés",
    quiet: "rues loin de la circulation",
    none: "rues passantes, peu à voir",
    unknown: "aucun point marquant trouvé",
  },
} as const;

/**
 * A label from what the route actually passes, never from where it was aimed: a "via" label that
 * never enters the park would be a lie. With `basemap: false` the basemap tiles were not read, so
 * parks, the river and traffic are unknown: the label claims none of them, busy streets included.
 */
export function describe(s: Scores, lang: "en" | "fr", known: { basemap?: boolean } = {}): string {
  const w = WORDS[lang];
  const basemap = known.basemap ?? true;
  const h = s.highlights;
  const parts: string[] = [];
  if (basemap && h.parks.length) parts.push(h.parks.slice(0, 2).map((p) => p.name).join(w.and));
  if (basemap && s.water >= 0.25) parts.push(w.river);
  const cafes = h.life.filter((p) => p.category === "food.cafe" || p.category === "food.bakery").length;
  if (h.life.length >= 10) parts.push(`${h.life.length} ${w.storefronts}${cafes ? ` (${cafes} ${w.cafes})` : ""}`);
  if (basemap && s.quiet >= 0.85) parts.push(w.quiet);
  return parts.length ? `${w.past} ${parts.join(", ")}` : basemap ? w.none : w.unknown;
}
