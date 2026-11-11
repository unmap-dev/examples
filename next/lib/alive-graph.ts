// An aliveness-weighted walking graph, built from the basemap's road lines. Pleasant streets
// get cheaper, and a shortest-path search finds the route. Pure: no React, no I/O.
//
// The graph is good enough to find a path, not to time one; the engine re-routes through it so
// durations and geometry stay the engine's.

import { aliveness, type Weights } from "./alive-rank";
import {
  SCORE_RADII,
  dist,
  grid,
  nearWater,
  parksAt,
  quietAt,
  resample,
  segDist,
  type AliveData,
  type LngLat,
  type Prepared,
  type XY,
} from "./alive-signals";

/** Snap tolerance for joining vertices, and the reach for joining a dangling end to a segment. */
const SNAP_M = 1.5;
const DANGLE_M = 4;

/** Gamma ladder: how hard each candidate route leans toward pleasant streets. */
export const GAMMAS = [0.5, 1, 1.5, 2, 3] as const;

interface Signals {
  green: number;
  water: number;
  quiet: number;
  life: number;
  landmarks: number;
}

interface Edge {
  a: number;
  b: number;
  len: number;
  dead: boolean;
  sig: Signals;
}

export interface WalkGraph {
  nodes: number;
  edges: number;
  joined: number;
}

interface GraphInternals extends WalkGraph {
  xy: XY[];
  adj: Edge[][];
  nodeGrid: ReturnType<typeof grid<number>>;
}

export function buildWalkGraph(p: Prepared, roads: AliveData["roads"]): GraphInternals {
  const xy: XY[] = [];
  const adj: Edge[][] = [];
  const nodeGrid = grid<number>(10);
  const noSig: Signals = { green: 0, water: 0, quiet: 1, life: 0, landmarks: 0 };

  const addNode = (q: XY): number => {
    const id = xy.length;
    xy.push(q);
    adj.push([]);
    nodeGrid.addBox(id, q[0], q[1], q[0], q[1]);
    return id;
  };
  const nodeAt = (q: XY): number => {
    for (const id of nodeGrid.near(q, SNAP_M)) if (dist(xy[id]!, q) <= SNAP_M) return id;
    return addNode(q);
  };

  const edges: Edge[] = [];
  const link = (a: number, b: number): Edge | null => {
    if (a === b) return null;
    const e: Edge = { a, b, len: dist(xy[a]!, xy[b]!), dead: false, sig: noSig };
    edges.push(e);
    adj[a]!.push(e);
    adj[b]!.push(e);
    return e;
  };

  // Highways are not walkable, so they never become edges (they still count as loud roads in
  // quietAt, which reads the prepared segments).
  for (const r of roads) {
    if (r.kind === "highway") continue;
    const line = r.line.map(p.P.to);
    for (let i = 1; i < line.length; i++) link(nodeAt(line[i - 1]!), nodeAt(line[i]!));
  }

  // Tile clipping and line simplification leave T-junctions and tile seams unjoined: a way's end
  // sits a metre or two off the street it meets. Split that street and join them.
  const boxOf = (e: Edge): [number, number, number, number] => {
    const a = xy[e.a]!;
    const b = xy[e.b]!;
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
  };
  const edgeGrid = grid<Edge>(30);
  for (const e of edges) edgeGrid.addBox(e, ...boxOf(e));

  let joined = 0;
  const dangling: number[] = [];
  adj.forEach((list, id) => {
    if (list.length === 1) dangling.push(id);
  });
  for (const id of dangling) {
    const q = xy[id]!;
    let best: Edge | null = null;
    let bestD = DANGLE_M;
    for (const e of edgeGrid.near(q, DANGLE_M)) {
      if (e.dead || e.a === id || e.b === id) continue;
      const d = segDist(q, xy[e.a]!, xy[e.b]!);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    if (!best) continue;
    const a = xy[best.a]!;
    const b = xy[best.b]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    const foot: XY = [a[0] + t * dx, a[1] + t * dy];
    const end = dist(foot, a) <= SNAP_M ? best.a : dist(foot, b) <= SNAP_M ? best.b : null;
    if (end !== null) {
      link(id, end);
    } else {
      best.dead = true;
      adj[best.a] = adj[best.a]!.filter((e) => e !== best);
      adj[best.b] = adj[best.b]!.filter((e) => e !== best);
      const m = addNode(foot);
      link(best.a, m);
      link(m, best.b);
      link(id, m);
      for (const e of adj[m]!) edgeGrid.addBox(e, ...boxOf(e));
    }
    joined++;
  }

  // Per-edge signals, the same five as scoreRoute, computed once. Weights apply later.
  const live = edges.filter((e) => !e.dead);
  for (const e of live) {
    const pts = resample([xy[e.a]!, xy[e.b]!], 10);
    let green = 0;
    let water = 0;
    let quiet = 0;
    const life = new Set<string>();
    const landmarks = new Set<string>();
    for (const s of pts) {
      quiet += quietAt(p, s);
      if (parksAt(p, s).length) green++;
      if (nearWater(p, s)) water++;
      for (const q of p.lifeGrid.near(s, SCORE_RADII.life)) if (dist(s, q.xy) <= SCORE_RADII.life) life.add(q.id);
      for (const q of p.landmarkGrid.near(s, SCORE_RADII.landmark)) if (dist(s, q.xy) <= SCORE_RADII.landmark) landmarks.add(q.id);
    }
    // Storefront density smoothed over 100 m, so a 5 m edge beside one cafe is not "100%".
    const km = e.len / 1000 + 0.1;
    e.sig = {
      green: green / pts.length,
      water: water / pts.length,
      quiet: quiet / pts.length,
      life: Math.min(life.size / km / 20, 1),
      landmarks: Math.min(landmarks.size / km / 5, 1),
    };
  }
  return { xy, adj, nodeGrid, nodes: xy.length, edges: live.length, joined };
}

function nearestNode(g: GraphInternals, q: XY): number {
  for (let r = 10; r <= 640; r *= 2) {
    let best = -1;
    let bestD = Infinity;
    for (const id of g.nodeGrid.near(q, r)) {
      const d = dist(g.xy[id]!, q);
      if (d < bestD && g.adj[id]!.length) {
        bestD = d;
        best = id;
      }
    }
    if (best >= 0) return best;
  }
  return -1;
}

/**
 * Cheapest path where an edge costs `len * exp(-gamma * aliveness)`. gamma 0 is the plain
 * shortest walk; gamma 2 makes a perfect street cost 14% of its length and an average one (0.3)
 * 55%. A linear `len * (1 - beta * p)` barely moved the path: a 25% longer detour needs a
 * pleasantness gap the data rarely shows. Null if the graph does not connect the two ends.
 */
export function alivePath(p: Prepared, g: GraphInternals, from: LngLat, to: LngLat, w: Weights, gamma: number): LngLat[] | null {
  const s = nearestNode(g, p.P.to(from));
  const t = nearestNode(g, p.P.to(to));
  if (s < 0 || t < 0) return null;

  const cost = new Float64Array(g.nodes).fill(Infinity);
  const prev = new Int32Array(g.nodes).fill(-1);
  cost[s] = 0;

  // Binary min-heap on [cost, node].
  const heap: [number, number][] = [[0, s]];
  const push = (item: [number, number]) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent]![0] <= heap[i]![0]) break;
      [heap[parent], heap[i]] = [heap[i]!, heap[parent]!];
      i = parent;
    }
  };
  const pop = (): [number, number] => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l]![0] < heap[m]![0]) m = l;
        if (r < heap.length && heap[r]![0] < heap[m]![0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i]!, heap[m]!];
        i = m;
      }
    }
    return top;
  };

  while (heap.length) {
    const [c, u] = pop();
    if (c > cost[u]!) continue;
    if (u === t) break;
    for (const e of g.adj[u]!) {
      const v = e.a === u ? e.b : e.a;
      const nc = c + e.len * Math.exp(-gamma * aliveness(e.sig, w));
      if (nc < cost[v]!) {
        cost[v] = nc;
        prev[v] = u;
        push([nc, v]);
      }
    }
  }
  if (cost[t] === Infinity) return null;
  const ids: number[] = [];
  for (let u = t; u !== -1; u = prev[u]!) ids.push(u);
  return ids.reverse().map((id) => p.P.from(g.xy[id]!));
}

/** At most `maxPoints` points, evenly spaced by index, always keeping both ends. */
export function resampleTo(coords: LngLat[], maxPoints: number): LngLat[] {
  if (coords.length <= maxPoints || maxPoints < 2) return coords.length <= maxPoints ? coords : [coords[0]!, coords[coords.length - 1]!];
  const out: LngLat[] = [];
  for (let i = 0; i < maxPoints; i++) out.push(coords[Math.round((i * (coords.length - 1)) / (maxPoints - 1))]!);
  return out;
}
