// Finding candidate walks for Alive Maps. The orchestrator: it asks injected deps for the fastest
// walk, the basemap and the places between the two ends, makes detours two ways (a via routed by the engine,
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
 * The most basemap tiles one search reads. The first wave (the fastest route, the tiles and the
 * two corridor places calls) goes out with no budget check, so this must leave room in
 * CALL_BUDGET for it and at least three detours (six route calls): 1 + 24 + 2 + 6 = 33. Detours,
 * matches and top-ups check the budget as each is sent, so whatever the tiles leave is all they
 * spend.
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
/** A candidate this far from the corridor line leaves the corridor (500 m less the 35-60 m scoring reach). */
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

/** A call's outcome, so a call nobody ends up waiting for cannot surface as an unhandled rejection. */
type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };

/** Sends now (a synchronous throw counts as a rejection) and never rejects. */
function settle<T>(send: () => Promise<T>): Promise<Settled<T>> {
  let sent: Promise<T>;
  try {
    sent = send();
  } catch (e) {
    sent = Promise.reject(e);
  }
  return sent.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
}

/**
 * A turn of the event loop, so the requests just sent leave before the graph build holds the
 * thread (a fetch can need one to go out) and answers already in can be read. Not a timer when
 * anything else will do: a hidden tab holds a 0 ms timer back for up to a second.
 */
function yieldToEvents(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (typeof scheduler?.yield === "function") return scheduler.yield();
  if (typeof MessageChannel === "function") {
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        channel.port1.close();
        resolve();
      };
      channel.port2.postMessage(null);
    });
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}

type Draft = Omit<Candidate, "scores">;

/**
 * Every independent call goes out as soon as what it needs is known, in three waves: the fastest
 * route, the basemap and the corridor places together; then every detour leg at once, with the
 * graph built while they fly and every match sent right after; then a places top-up for each
 * kept candidate that strays, sent as soon as it and every candidate before it have answered (so
 * dedupe has settled whether it is kept). Counting at issue is exact
 * (JS runs one thing at a time), so the budget holds, and it is spent in the same priority as
 * ever: detours, then matches, then top-ups.
 */
export async function findWalks(deps: WalkDeps, from: LngLat, to: LngLat, signal: AbortSignal): Promise<WalkResult> {
  const run = { done: false };
  try {
    return await search(deps, from, to, signal, run);
  } finally {
    // Matches still out when the search settles (a rejection included) must send nothing.
    run.done = true;
  }
}

async function search(deps: WalkDeps, from: LngLat, to: LngLat, signal: AbortSignal, run: { done: boolean }): Promise<WalkResult> {
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
  /** One call, guarded, counted and sent now. */
  const issue = <T>(send: () => Promise<T>): Promise<Settled<T>> => {
    guard();
    calls++;
    return settle(send);
  };

  const P = projector(from);
  guard();
  if (dist(P.to(from), P.to(to)) < TOO_SHORT_M) {
    calls++;
    const fastest = await deps.route(from, to, signal);
    const coords = fastest.geometry.coordinates;
    const empty = prepare({ parks: [], water: [], roads: [], life: [], landmarks: [] }, from);
    return {
      candidates: [{ id: "fastest", method: "fastest", coords, durationS: fastest.durationSeconds, distanceM: fastest.distanceMeters, scores: scoreRoute(empty, coords) }],
      calls,
      placesAvailable: true,
      basemapAvailable: true,
      skipped: 0,
      tooShort: true,
    };
  }

  // Wave 1, all at once. The corridor places run along the straight line rather than the fastest
  // walk so they need not wait for it; at 500 m either way they cover the same neighbourhood, and
  // strays are measured from this same line, so whatever leaves it is topped up below.
  // No budget checks: 1 + MAX_TILES + 2 always fits.
  const corridor: LngLat[] = [from, to];
  const bbox = ellipseBox(P, from, to);
  const fastestP = issue(() => deps.route(from, to, signal));
  guard();
  // Counted when it answers: only the reader knows how many tiles it fetched.
  const tilesP = settle(() => deps.tiles(bbox, signal));
  const lifeP = issue(() => deps.placesAlong(corridor, LIFE_CATEGORIES, CORRIDOR_M, signal));
  const landmarksP = issue(() => deps.placesAlong(corridor, LANDMARK_CATEGORIES, CORRIDOR_M, signal));
  const [fastestR, tilesR, lifeR, landmarksR] = await Promise.all([fastestP, tilesP, lifeP, landmarksP]);

  if (!fastestR.ok) {
    rethrowAbort(fastestR.error);
    throw fastestR.error;
  }
  const fastest = fastestR.value;
  const fastestCandidate: Draft = {
    id: "fastest",
    method: "fastest",
    coords: fastest.geometry.coordinates,
    durationS: fastest.durationSeconds,
    distanceM: fastest.distanceMeters,
  };

  // Basemap. A failure here costs the graph method and the parks, water and quiet scores (the
  // result says so with basemapAvailable); detours need no tiles. The reader's MAX_TILES cap
  // means this lands at MAX_TILES calls at most. A RangeError is refused before any fetch and
  // counts 0; any other failure counts the fetches it made, so the cap still holds.
  let base: Omit<AliveData, "life" | "landmarks"> = { parks: [], water: [], roads: [] };
  let graphSkipped: WalkResult["graphSkipped"];
  if (tilesR.ok) {
    calls += tilesR.value.requests;
    base = dataFromTiles(tilesR.value.features);
  } else {
    rethrowAbort(tilesR.error);
    if (tilesR.error instanceof RangeError) graphSkipped = "too-big";
    else {
      graphSkipped = "tiles-failed";
      calls += requestsOf(tilesR.error) ?? tilesInBox(bbox);
    }
  }

  // Corridor places: cafe clusters and landmarks become vias.
  let placesAvailable = true;
  const life: Poi[] = [];
  const landmarks: Poi[] = [];
  const unavailable = (): void => {
    placesAvailable = false;
    life.length = 0;
    landmarks.length = 0;
  };
  for (const r of [lifeR, landmarksR]) {
    if (r.ok) continue;
    rethrowAbort(r.error);
    if (statusOf(r.error) !== 503) throw r.error;
  }
  if (lifeR.ok && landmarksR.ok) {
    mergePois(life, lifeR.value);
    mergePois(landmarks, landmarksR.value);
  } else unavailable();
  guard();

  let p = prepare({ ...base, life, landmarks }, from);

  // Candidates, in the order they were asked for: the fastest, every detour, every graph path.
  // Each slot fills as its answer arrives; `settleUpTo` walks the filled run from the front,
  // keeping a walk unless it repeats one kept before it, and tops up each one kept. So only a
  // walk the result will show is topped up, the fastest included (the corridor is the straight
  // line, which the fastest walk can bow far off), and in candidate order.
  type Slot = { state: "pending" } | { state: "ok"; draft: Draft } | { state: "failed"; error: unknown };
  const slots: Slot[] = [{ state: "ok", draft: fastestCandidate }];
  const candidates: Draft[] = [];
  let front = 0;
  /** False until every detour and match is out, so a short budget goes to them before top-ups. */
  let topUpsOpen = false;
  const settleUpTo = (): void => {
    if (!topUpsOpen) return;
    while (front < slots.length && slots[front]!.state !== "pending") {
      const slot = slots[front++]!;
      if (slot.state !== "ok") continue;
      const c = slot.draft;
      if (candidates.some((k) => overlap(p, c.coords, k.coords) >= SAME_WALK && overlap(p, k.coords, c.coords) >= SAME_WALK)) continue;
      candidates.push(c);
      topUp(c.coords);
    }
  };
  const fill = (at: number, slot: Slot): void => {
    slots[at] = slot;
    settleUpTo();
  };

  // Top-ups. A candidate that leaves the 500 m corridor would be scored as if its far half had no
  // cafes or landmarks, so places are fetched along it too, once it is kept.
  const corridorXY = corridor.map(P.to);
  const topUps: Promise<[Settled<Poi[]>, Settled<Poi[]>]>[] = [];
  let topUpRefused = false;
  const topUp = (coords: LngLat[]): void => {
    // Often called from an answer's callback: an abort, or a search already settled, stops it
    // quietly (the main flow throws or has returned).
    if (run.done || signal.aborted || !placesAvailable || topUpRefused || !fits(2)) return;
    if (strayM(P, coords, corridorXY) <= STRAY_M) return;
    calls += 2;
    const pair = Promise.all([
      settle(() => deps.placesAlong(coords, LIFE_CATEGORIES, TOP_UP_M, signal)),
      settle(() => deps.placesAlong(coords, LANDMARK_CATEGORIES, TOP_UP_M, signal)),
    ]);
    topUps.push(
      pair.then((both) => {
        // Scoring some candidates with places and some without would rank them unfairly.
        if (both.some((r) => !r.ok && statusOf(r.error) === 503)) topUpRefused = true;
        return both;
      }),
    );
  };

  // Detours: one via each, two routing calls, every leg sent now. A via the engine cannot reach
  // is just skipped.
  const detours: Promise<void>[] = [];
  for (const [i, v] of candidateVias(p, from, to).entries()) {
    if (!fits(2)) break;
    const at = slots.length;
    slots.push({ state: "pending" });
    const leg1 = issue(() => deps.route(from, v.via, signal));
    const leg2 = issue(() => deps.route(v.via, to, signal));
    const detour = Promise.all([leg1, leg2]).then(([r1, r2]): void => {
      if (!r1.ok) return fill(at, { state: "failed", error: r1.error });
      if (!r2.ok) return fill(at, { state: "failed", error: r2.error });
      const [l1, l2] = [r1.value, r2.value];
      const { coords, trimmedM } = joinLegs(p, l1.geometry.coordinates, l2.geometry.coordinates);
      const rawM = l1.distanceMeters + l2.distanceMeters;
      const distanceM = Math.max(rawM - trimmedM, 0);
      // Walking time scales with distance (grade aside), so a trimmed spur takes its share of time.
      const durationS = rawM > 0 ? ((l1.durationSeconds + l2.durationSeconds) * distanceM) / rawM : l1.durationSeconds + l2.durationSeconds;
      fill(at, { state: "ok", draft: { id: `detour-${i + 1}`, method: "detour", coords, durationS, distanceM } });
    });
    // Awaited below; until then a throw elsewhere must not leave it unhandled.
    detour.catch(() => undefined);
    detours.push(detour);
  }

  // Graph paths, built while the detours fly: once, with the default weights; the dials re-rank,
  // they do not re-route.
  const matches: Promise<void>[] = [];
  if (!graphSkipped) {
    await yieldToEvents();
    guard();
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
      const at = slots.length;
      slots.push({ state: "pending" });
      const match = issue(() => deps.match(resampleTo(path, MAX_MATCH_POINTS), signal)).then((r): void => {
        if (!r.ok) return fill(at, { state: "failed", error: r.error });
        const coords = r.value.geometry.coordinates;
        fill(at, { state: "ok", draft: { id: `graph-${gamma}`, method: "graph", coords, durationS: r.value.durationSeconds, distanceM: r.value.distanceMeters, fidelity: overlap(p, path, coords) } });
      });
      match.catch(() => undefined);
      matches.push(match);
    }
  }

  // Every detour and match is out: top-ups may spend what is left, from the fastest walk on.
  topUpsOpen = true;
  settleUpTo();

  // Once every answer is in, every slot is filled, every kept walk is in `candidates` and every
  // top-up that will ever be sent is in `topUps`.
  await Promise.all(detours);
  await Promise.all(matches);
  for (const slot of slots)
    if (slot.state === "failed") {
      rethrowAbort(slot.error);
      skipped++;
    }

  let toppedUp = false;
  for (const [l, k] of await Promise.all(topUps)) {
    if (!placesAvailable) break;
    if (l.ok && k.ok) {
      if (mergePois(life, l.value) + mergePois(landmarks, k.value) > 0) toppedUp = true;
      continue;
    }
    const error = l.ok ? (k as { error: unknown }).error : l.error;
    rethrowAbort(error);
    if (statusOf(error) !== 503) throw error;
    unavailable();
    toppedUp = true;
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
