// Finding candidate walks for Alive Maps. The orchestrator: it asks injected deps for the fastest
// walk, the basemap and the places along it, makes detours two ways (a via routed by the engine,
// and a path from the aliveness-weighted graph snapped by map matching), and scores them all.
// Pure apart from the deps, so the UI adapts the SDK to WalkDeps and tests pass fakes.

import { candidateVias, joinLegs, overlap } from "./alive-candidates";
import { LANDMARK_CATEGORIES, LIFE_CATEGORIES, dataFromTiles, type TileFeature } from "./alive-data";
import { GAMMAS, alivePath, buildWalkGraph, resampleTo } from "./alive-graph";
import { DEFAULT_WEIGHTS } from "./alive-rank";
import { dist, prepare, projector, resample, scoreRoute, segDist, type AliveData, type LngLat, type Poi, type Scores, type XY } from "./alive-signals";

export type Method = "detour" | "graph";

export interface Candidate {
  id: string;
  method: Method | "fastest";
  coords: LngLat[];
  durationS: number;
  distanceM: number;
  /** Graph paths only: the share of the graph path the matched walk actually follows. */
  fidelity?: number;
  scores: Scores;
}

/** What `/route` and `/match` answer, as far as this module reads it. */
export interface WalkLeg {
  geometry: { coordinates: LngLat[] };
  durationSeconds: number;
  distanceMeters: number;
}

export interface WalkDeps {
  route(from: LngLat, to: LngLat, signal: AbortSignal): Promise<WalkLeg>;
  match(coords: LngLat[], signal: AbortSignal): Promise<WalkLeg>;
  /** Throws an object with a numeric `status` on an HTTP error. */
  placesAlong(line: LngLat[], categories: readonly string[], radius: number, signal: AbortSignal): Promise<Poi[]>;
  /**
   * Decoded basemap features by layer, and how many tile requests that took. Rejects with a
   * `RangeError` when the box needs more tiles than the reader allows, before fetching anything.
   * Any other rejection may carry a numeric `requests` (the tile fetches it made); without one,
   * every tile in the box at z14 is assumed fetched, because the reader issues them all at once
   * and fails on the first bad answer. GeoJSON features satisfy
   * `TileFeature`, which is declared in the block so it imports no types.
   */
  tiles(bbox: [number, number, number, number], signal: AbortSignal): Promise<{ features: Record<string, TileFeature[]>; requests: number }>;
}

export interface WalkResult {
  /** Fastest first, then detours, then graph paths, with repeats of the same walk dropped. */
  candidates: Candidate[];
  /** Every route, match, places and tile request made. */
  calls: number;
  /** False after a 503 from placesAlong: street life and landmarks then score 0 everywhere. */
  placesAvailable: boolean;
  /**
   * False when the basemap tiles were refused (`graphSkipped` "too-big") or failed ("tiles-failed").
   * Parks, water and roads are then empty, so every walk scores green 0, water 0 and quiet 1 as if
   * measured; those three scores are unknown, not measured, and a ranking must leave them out.
   */
  basemapAvailable: boolean;
  graphSkipped?: "too-big" | "tiles-failed";
  /** Candidates whose route or match call failed (not aborted), each counted once. Stated, not filled. */
  skipped: number;
  tooShort?: true;
}

export const CALL_BUDGET = 40;

/**
 * The most basemap tiles one search reads. The tile read has no budget check of its own, so this
 * must leave room in CALL_BUDGET for the fastest route, the two corridor places calls and at least
 * three detours (six route calls): 1 + 24 + 2 + 6 = 33. The detour and match loops check the
 * budget before every call, so whatever the tiles leave is all they spend.
 */
export const MAX_TILES = 24;

/** Under this straight-line distance any detour would be most of the walk. */
const TOO_SHORT_M = 200;
/** The ellipse a walker might accept, as in candidateVias. */
const STRETCH = 1.45;
/** Tiles reach past the ellipse so a via on its rim still has streets around it. */
const TILE_MARGIN_M = 150;
/** Corridor places: the widest radius /places/along allows, so most detours stay inside it. */
const CORRIDOR_M = 500;
/** A candidate this far from the fastest line leaves the corridor (500 m less the 35-60 m scoring reach). */
const STRAY_M = 450;
/** Top-up radius: scoring looks at most 60 m off a route, so this is ample. */
const TOP_UP_M = 100;
/** Two walks that each share this much of the other are the same walk. */
const SAME_WALK = 0.92;
/** Two graph paths this alike would match to the same walk, so the second is not worth a call. */
const SAME_PATH = 0.95;
/** /match accepts at most this many points. */
const MAX_MATCH_POINTS = 100;

const abortError = (): DOMException => new DOMException("Aborted", "AbortError");
const isAbort = (e: unknown): boolean => typeof e === "object" && e !== null && (e as { name?: unknown }).name === "AbortError";
const requestsOf = (e: unknown): number | undefined => {
  const n = typeof e === "object" && e !== null && "requests" in e ? (e as { requests: unknown }).requests : undefined;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : undefined;
};
const statusOf = (e: unknown): unknown => (typeof e === "object" && e !== null && "status" in e ? (e as { status: unknown }).status : undefined);

/** The lng/lat box of the A-B ellipse plus a margin, computed in local metres. */
function ellipseBox(P: ReturnType<typeof projector>, from: LngLat, to: LngLat): [number, number, number, number] {
  const A = P.to(from);
  const B = P.to(to);
  const D = dist(A, B);
  const a = (STRETCH * D) / 2;
  const b = Math.sqrt(Math.max(a * a - (D / 2) * (D / 2), 0));
  const th = Math.atan2(B[1] - A[1], B[0] - A[0]);
  const hx = Math.hypot(a * Math.cos(th), b * Math.sin(th)) + TILE_MARGIN_M;
  const hy = Math.hypot(a * Math.sin(th), b * Math.cos(th)) + TILE_MARGIN_M;
  const mx = (A[0] + B[0]) / 2;
  const my = (A[1] + B[1]) / 2;
  const [w, s] = P.from([mx - hx, my - hy]);
  const [e, n] = P.from([mx + hx, my + hy]);
  return [w, s, e, n];
}

/** The zoom the tile reader reads at (the deepest the gateway serves). */
const TILE_ZOOM = 14;

/**
 * How many z14 tiles a box touches, by the same slippy-map formula the tile reader uses. The
 * fallback count for a failed read that did not say how many fetches it made.
 */
function tilesInBox([west, south, east, north]: [number, number, number, number]): number {
  const n = 2 ** TILE_ZOOM;
  const clamp = (v: number) => Math.min(Math.max(v, 0), n - 1);
  const tx = (lng: number) => clamp(Math.floor(((lng + 180) / 360) * n));
  const ty = (lat: number) => clamp(Math.floor(((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * n));
  return (tx(east) - tx(west) + 1) * (ty(south) - ty(north) + 1);
}

/** The farthest any part of `coords` gets from the polyline `ref`, sampled every 50 m. */
function strayM(P: ReturnType<typeof projector>, coords: LngLat[], ref: XY[]): number {
  if (coords.length === 0 || ref.length === 0) return 0;
  const segs = ref.length === 1 ? [[ref[0]!, ref[0]!] as const] : ref.slice(1).map((q, i) => [ref[i]!, q] as const);
  let worst = 0;
  for (const s of resample(coords.map(P.to), 50)) {
    let near = Infinity;
    for (const [a, b] of segs) near = Math.min(near, segDist(s, a, b));
    worst = Math.max(worst, near);
  }
  return worst;
}

function mergePois(into: Poi[], more: Poi[]): number {
  const seen = new Set(into.map((q) => q.id));
  let added = 0;
  for (const q of more)
    if (!seen.has(q.id)) {
      seen.add(q.id);
      into.push(q);
      added++;
    }
  return added;
}

export async function findWalks(deps: WalkDeps, from: LngLat, to: LngLat, signal: AbortSignal): Promise<WalkResult> {
  let calls = 0;
  let skipped = 0;
  const guard = (): void => {
    if (signal.aborted) throw abortError();
  };
  /** A failure from a dep: an abort always propagates; anything else is the caller's to judge. */
  const rethrowAbort = (e: unknown): void => {
    if (signal.aborted) throw abortError();
    if (isAbort(e)) throw e;
  };
  const fits = (n: number): boolean => calls + n <= CALL_BUDGET;
  /**
   * Two calls issued together, each guarded and counted. If the second guard trips, the first
   * call's eventual rejection is swallowed so it does not surface as unhandled.
   */
  const pair = <T>(first: () => Promise<T>, second: () => Promise<T>): Promise<[T, T]> => {
    guard();
    calls++;
    const p1 = first();
    try {
      guard();
    } catch (e) {
      p1.catch(() => undefined);
      throw e;
    }
    calls++;
    return Promise.all([p1, second()]);
  };

  guard();
  calls++;
  const fastest = await deps.route(from, to, signal);
  const fastestCandidate = {
    id: "fastest",
    method: "fastest" as const,
    coords: fastest.geometry.coordinates,
    durationS: fastest.durationSeconds,
    distanceM: fastest.distanceMeters,
  };

  const P = projector(from);
  if (dist(P.to(from), P.to(to)) < TOO_SHORT_M) {
    const empty = prepare({ parks: [], water: [], roads: [], life: [], landmarks: [] }, from);
    return { candidates: [{ ...fastestCandidate, scores: scoreRoute(empty, fastestCandidate.coords) }], calls, placesAvailable: true, basemapAvailable: true, skipped: 0, tooShort: true };
  }

  // Basemap. A failure here costs the graph method and the parks, water and quiet scores (the
  // result says so with basemapAvailable); detours need no tiles. No budget check: the reader's
  // MAX_TILES cap means this lands at 1 + MAX_TILES calls at most. A RangeError is refused before
  // any fetch and counts 0; any other failure counts the fetches it made, so the cap still holds.
  let base: Omit<AliveData, "life" | "landmarks"> = { parks: [], water: [], roads: [] };
  let graphSkipped: WalkResult["graphSkipped"];
  const bbox = ellipseBox(P, from, to);
  guard();
  try {
    const t = await deps.tiles(bbox, signal);
    calls += t.requests;
    base = dataFromTiles(t.features);
  } catch (e) {
    rethrowAbort(e);
    if (e instanceof RangeError) graphSkipped = "too-big";
    else {
      graphSkipped = "tiles-failed";
      calls += requestsOf(e) ?? tilesInBox(bbox);
    }
  }

  // Corridor places, before candidates: cafe clusters and landmarks become vias.
  let placesAvailable = true;
  const life: Poi[] = [];
  const landmarks: Poi[] = [];
  const unavailable = (): void => {
    placesAvailable = false;
    life.length = 0;
    landmarks.length = 0;
  };
  if (fits(2)) {
    try {
      const [l, k] = await pair(
        () => deps.placesAlong(fastest.geometry.coordinates, LIFE_CATEGORIES, CORRIDOR_M, signal),
        () => deps.placesAlong(fastest.geometry.coordinates, LANDMARK_CATEGORIES, CORRIDOR_M, signal),
      );
      mergePois(life, l);
      mergePois(landmarks, k);
    } catch (e) {
      rethrowAbort(e);
      if (statusOf(e) !== 503) throw e;
      unavailable();
    }
  }

  let p = prepare({ ...base, life, landmarks }, from);
  const candidates: Omit<Candidate, "scores">[] = [fastestCandidate];
  const add = (c: Omit<Candidate, "scores">): void => {
    if (candidates.some((k) => overlap(p, c.coords, k.coords) >= SAME_WALK && overlap(p, k.coords, c.coords) >= SAME_WALK)) return;
    candidates.push(c);
  };

  // Detours: one via each, two routing calls. A via the engine cannot reach is just skipped.
  for (const [i, v] of candidateVias(p, from, to).entries()) {
    if (!fits(2)) break;
    let legs: [WalkLeg, WalkLeg];
    try {
      legs = await pair(
        () => deps.route(from, v.via, signal),
        () => deps.route(v.via, to, signal),
      );
    } catch (e) {
      rethrowAbort(e);
      skipped++;
      continue;
    }
    const [l1, l2] = legs;
    const { coords, trimmedM } = joinLegs(p, l1.geometry.coordinates, l2.geometry.coordinates);
    const rawM = l1.distanceMeters + l2.distanceMeters;
    const distanceM = Math.max(rawM - trimmedM, 0);
    // Walking time scales with distance (grade aside), so a trimmed spur takes its share of time.
    const durationS = rawM > 0 ? ((l1.durationSeconds + l2.durationSeconds) * distanceM) / rawM : l1.durationSeconds + l2.durationSeconds;
    add({ id: `detour-${i + 1}`, method: "detour", coords, durationS, distanceM });
  }

  // Graph paths: built once with the default weights; the dials re-rank, they do not re-route.
  if (!graphSkipped) {
    const g = buildWalkGraph(p, base.roads);
    // The plain shortest path on the graph is the fastest walk again, not a candidate; seeding
    // with it means a gamma that does not leave it spends no call.
    const plain = alivePath(p, g, from, to, DEFAULT_WEIGHTS, 0);
    const seen: LngLat[][] = plain ? [plain] : [];
    for (const gamma of GAMMAS) {
      const path = alivePath(p, g, from, to, DEFAULT_WEIGHTS, gamma);
      if (!path || path.length < 2) continue;
      if (seen.some((q) => overlap(p, path, q) >= SAME_PATH && overlap(p, q, path) >= SAME_PATH)) continue;
      seen.push(path);
      if (!fits(1)) break;
      let matched: WalkLeg;
      guard();
      calls++;
      try {
        matched = await deps.match(resampleTo(path, MAX_MATCH_POINTS), signal);
      } catch (e) {
        rethrowAbort(e);
        skipped++;
        continue;
      }
      const coords = matched.geometry.coordinates;
      add({ id: `graph-${gamma}`, method: "graph", coords, durationS: matched.durationSeconds, distanceM: matched.distanceMeters, fidelity: overlap(p, path, coords) });
    }
  }

  // A candidate that leaves the 500 m corridor would be scored as if its far half had no cafes
  // or landmarks; fetch places along it so it competes on the same footing.
  let toppedUp = false;
  if (placesAvailable) {
    const ref = fastest.geometry.coordinates.map(P.to);
    for (const c of candidates.slice(1)) {
      if (strayM(P, c.coords, ref) <= STRAY_M) continue;
      if (!fits(2)) break;
      try {
        const [l, k] = await pair(
          () => deps.placesAlong(c.coords, LIFE_CATEGORIES, TOP_UP_M, signal),
          () => deps.placesAlong(c.coords, LANDMARK_CATEGORIES, TOP_UP_M, signal),
        );
        if (mergePois(life, l) + mergePois(landmarks, k) > 0) toppedUp = true;
      } catch (e) {
        rethrowAbort(e);
        if (statusOf(e) !== 503) throw e;
        // Scoring some candidates with places and some without would rank them unfairly.
        unavailable();
        toppedUp = true;
        break;
      }
    }
  }
  // Once, so every candidate is scored against the same data.
  if (toppedUp) p = prepare({ ...base, life, landmarks }, from);

  guard();
  return {
    candidates: candidates.map((c) => ({ ...c, scores: scoreRoute(p, c.coords) })),
    calls,
    placesAvailable,
    basemapAvailable: !graphSkipped,
    skipped,
    ...(graphSkipped ? { graphSkipped } : {}),
  };
}
