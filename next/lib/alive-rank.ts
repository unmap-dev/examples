// Ranking: the only part the UI re-runs when a slider moves. Pure.

import type { Scores } from "./alive-signals";

export type Weights = { green: number; water: number; quiet: number; life: number; landmarks: number };

export const DEFAULT_WEIGHTS: Weights = { green: 1, water: 0.6, quiet: 0.8, life: 1, landmarks: 0.5 };

export function aliveness(s: Pick<Scores, keyof Weights>, w: Weights): number {
  const total = w.green + w.water + w.quiet + w.life + w.landmarks || 1;
  return (w.green * s.green + w.water * s.water + w.quiet * s.quiet + w.life * s.life + w.landmarks * s.landmarks) / total;
}

export interface Ranked<C> {
  rows: (C & { extraMin: number; score: number; eligible: boolean })[];
  pickId: string;
}

/**
 * The best route within `budgetMin` extra minutes of the fastest. The fastest route is always
 * eligible, so with a zero budget, or when no detour beats it, the answer is the fastest route.
 * A detour must also beat the fastest by `minGain` (0-1): a minute's detour for a one-point gain
 * is not something anyone would notice on the street.
 *
 * "The fastest" is the candidate whose `method` is "fastest" (the route the engine called fastest),
 * when there is one; only without it is it the shortest duration. A detour that comes back a few
 * seconds quicker than the engine's fastest walk (a snapped spur, a rounding) must not take its
 * place as the baseline, or the extra minutes and the gain would be measured against a detour.
 */
export function rank<C extends { id: string; durationS: number; scores: Scores; method?: string }>(
  candidates: C[],
  w: Weights,
  budgetMin: number,
  minGain = 0.05,
): Ranked<C> {
  const fastest = candidates.find((c) => c.method === "fastest") ?? candidates.reduce((a, b) => (b.durationS < a.durationS ? b : a));
  const base = aliveness(fastest.scores, w);
  const rows = candidates.map((c) => {
    const extraMin = (c.durationS - fastest.durationS) / 60;
    const score = aliveness(c.scores, w);
    const eligible = extraMin <= budgetMin + 1e-9 && (c === fastest || score - base >= minGain);
    return { ...c, extraMin, score, eligible };
  });
  rows.sort((a, b) => b.score - a.score);
  const pick = rows.find((r) => r.eligible) ?? rows[0]!;
  return { rows, pickId: pick.id };
}
