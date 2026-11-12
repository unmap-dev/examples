// Candidate detours for Alive Maps: where a walk could go out of its way, how two routing legs
// join into one walk, and how much two walks share. Pure: no React, no I/O.

import { dist, grid, lineLength, resample, segDist, type LngLat, type Prepared, type Seg, type XY } from "./alive-signals";

export type ViaKind = "park" | "life" | "landmark" | "water";

export interface Via {
  kind: ViaKind;
  label: string;
  via: LngLat;
}

/** A via this close to either end is not a detour, just a slightly different start. */
const END_CLEARANCE_M = 120;
/** Parks smaller than this (about a city lot) are not worth walking to. */
const MIN_PARK_M2 = 4000;
/** How far a park via is pulled from its nearest edge toward its centroid, so the walk enters it. */
const PARK_PULL = 0.35;
const LIFE_CELL_M = 120;
const LIFE_MIN_PLACES = 5;
const RIVER_CELL_M = 300;
/** Two vias closer than this produce nearly the same walk, so only the better one is routed. */
const VIA_DEDUPE_M = 150;
/** Joining legs: consecutive points this close on both legs are one out-and-back spur. */
const SPUR_M = 12;
/** Overlap: a point of one walk within this of the other is shared. */
const SHARED_M = 15;

function centroid(pts: XY[]): XY {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p[0];
    y += p[1];
  }
  return [x / pts.length, y / pts.length];
}

/**
 * Places worth walking past, as via points, inside the ellipse a walker might accept
 * (|PA| + |PB| <= stretch * |AB|). Each becomes one A to via to B walk. Ordered most promising
 * first and capped at `max`, because every via costs two routing calls.
 */
export function candidateVias(p: Prepared, from: LngLat, to: LngLat, opts: { stretch?: number; max?: number } = {}): Via[] {
  const stretch = opts.stretch ?? 1.45;
  const max = opts.max ?? 6;
  const A = p.P.to(from);
  const B = p.P.to(to);
  const D = dist(A, B);
  const inEllipse = (q: XY): boolean => dist(q, A) + dist(q, B) <= D * stretch && dist(q, A) > END_CLEARANCE_M && dist(q, B) > END_CLEARANCE_M;
  const out: { kind: ViaKind; label: string; xy: XY; value: number }[] = [];

  // Parks: the park vertex nearest the straight line, pulled toward the centroid, so the route
  // goes into the park rather than grazing its fence.
  for (const park of p.parks) {
    const outer = park.rings[0];
    if (park.area < MIN_PARK_M2 || !outer || outer.length === 0) continue;
    const c = centroid(outer);
    let nearest = c;
    let bestD = Infinity;
    for (const v of outer) {
      const d = segDist(v, A, B);
      if (d < bestD) {
        bestD = d;
        nearest = v;
      }
    }
    const xy: XY = [nearest[0] + (c[0] - nearest[0]) * PARK_PULL, nearest[1] + (c[1] - nearest[1]) * PARK_PULL];
    if (!inEllipse(xy)) continue;
    out.push({ kind: "park", label: park.name ?? "unnamed park", xy, value: Math.min(park.area / 40000, 1.5) });
  }

  // Lively blocks: cells dense with cafes and shops. A lone cafe is not a reason to detour.
  const cells = new Map<string, XY[]>();
  for (const q of p.life) {
    if (!inEllipse(q.xy)) continue;
    const k = `${Math.floor(q.xy[0] / LIFE_CELL_M)},${Math.floor(q.xy[1] / LIFE_CELL_M)}`;
    const list = cells.get(k);
    if (list) list.push(q.xy);
    else cells.set(k, [q.xy]);
  }
  for (const pts of cells.values()) {
    if (pts.length < LIFE_MIN_PLACES) continue;
    out.push({ kind: "life", label: `${pts.length} cafés and shops`, xy: centroid(pts), value: Math.min(pts.length / 10, 1.5) });
  }

  for (const q of p.landmarks) if (inEllipse(q.xy)) out.push({ kind: "landmark", label: q.name, xy: q.xy, value: 0.6 });

  // Riverside: water edge midpoints inside the ellipse, at most one per cell, so a long river
  // does not crowd out everything else.
  const riverCells = new Map<string, XY>();
  for (const w of p.waterGrid.near([(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], D * stretch)) {
    const m: XY = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2];
    if (!inEllipse(m)) continue;
    const k = `${Math.floor(m[0] / RIVER_CELL_M)},${Math.floor(m[1] / RIVER_CELL_M)}`;
    if (!riverCells.has(k)) riverCells.set(k, m);
  }
  for (const m of riverCells.values()) out.push({ kind: "water", label: "riverside", xy: m, value: 0.8 });

  // Prefer high value and a small detour, then drop anything near a better pick.
  const ranked = out
    .map((c) => ({ ...c, rank: c.value / ((dist(c.xy, A) + dist(c.xy, B)) / (D || 1)) }))
    .sort((a, b) => b.rank - a.rank);
  const kept: typeof ranked = [];
  for (const c of ranked) {
    if (kept.length >= max) break;
    if (kept.some((k) => dist(k.xy, c.xy) < VIA_DEDUPE_M)) continue;
    kept.push(c);
  }
  return kept.map((c) => ({ kind: c.kind, label: c.label, via: p.P.from(c.xy) }));
}

/**
 * Join A to via and via to B, trimming the out-and-back spur the router adds when the via snaps
 * to a dead end or the far side of a block. Returns the joined line and the metres trimmed.
 */
export function joinLegs(p: Prepared, a: LngLat[], b: LngLat[]): { coords: LngLat[]; trimmedM: number } {
  if (a.length === 0) return { coords: b, trimmedM: 0 };
  if (b.length === 0) return { coords: a, trimmedM: 0 };
  const ax = a.map(p.P.to);
  const bx = b.map(p.P.to);
  let i = ax.length - 1;
  let j = 0;
  while (i > 0 && j < bx.length - 1 && dist(ax[i - 1]!, bx[j + 1]!) < SPUR_M) {
    i--;
    j++;
  }
  const trimmedM = lineLength(ax.slice(i)) + lineLength(bx.slice(0, j + 1));
  return { coords: [...a.slice(0, i + 1), ...b.slice(j + 1)], trimmedM };
}

/** Share of `a` within 15 m of `b`: 1 means `a` walks entirely along `b`. Not symmetric. */
export function overlap(p: Prepared, a: LngLat[], b: LngLat[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const r = grid<Seg>(30);
  const bx = b.map(p.P.to);
  // A one-point reference is a zero-length segment, so a lone point still counts as shared.
  if (bx.length === 1) bx.push(bx[0]!);
  for (let i = 1; i < bx.length; i++) {
    const s = bx[i - 1]!;
    const e = bx[i]!;
    r.addBox({ a: s, b: e }, Math.min(s[0], e[0]), Math.min(s[1], e[1]), Math.max(s[0], e[0]), Math.max(s[1], e[1]));
  }
  const samples = resample(a.map(p.P.to), 20);
  let hit = 0;
  for (const q of samples)
    for (const seg of r.near(q, SHARED_M))
      if (segDist(q, seg.a, seg.b) <= SHARED_M) {
        hit++;
        break;
      }
  return hit / samples.length;
}
