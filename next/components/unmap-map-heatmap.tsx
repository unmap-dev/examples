"use client";

import { useState } from "react";
import { Map } from "@/components/ui/map";
import { HeatmapLayer } from "@/components/ui/heatmap-layer";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

const COPY = {
  en: {
    noKey: "Add your unmap key to load the map.",
    title: "Point density",
    hint: "Switch weighting to see where the heaviest points gather.",
    group: "How points count",
    even: "Each point once",
    weighted: "By weight",
    data: "60 illustrative points across Toronto, weighted 1 to 5.",
  },
  fr: {
    noKey: "Ajoutez votre clé unmap pour charger la carte.",
    title: "Densité des points",
    hint: "Activez la pondération pour voir où se concentrent les points les plus lourds.",
    group: "Comment les points comptent",
    even: "Chaque point une fois",
    weighted: "Selon le poids",
    data: "60 points illustratifs répartis dans Toronto, pondérés de 1 à 5.",
  },
} as const;

/** Deterministic sample points around a centre: the same 60 points on every load. */
function samplePoints(center: [number, number], count: number, spread: number) {
  let seed = 7;
  const next = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  return {
    type: "FeatureCollection" as const,
    features: Array.from({ length: count }, (_, i) => ({
      type: "Feature" as const,
      id: i,
      properties: { weight: 1 + Math.round(next() * 4) },
      geometry: { type: "Point" as const, coordinates: [center[0] + (next() - 0.5) * spread, center[1] + (next() - 0.5) * spread * 0.7] },
    })),
  };
}

/** Illustrative data: 60 points north of downtown Toronto, clear of the lake, with a `weight` from 1 to 5, not real places. */
const POINTS = samplePoints([-79.4, 43.71], 60, 0.16);

type Weighting = "even" | "weighted";

/**
 * A minimal example: a heatmap of 60 illustrative points around Toronto, in your --primary. Switch
 * between counting each point once and weighing it by its `weight`, and the hot spots move to where
 * the heaviest points are. The heatmap is drawn in the browser: the only requests are the map's own.
 */
export function MapHeatmap({
  apiKey,
  lang = "en",
  className,
}: {
  /** Your Unmap browser key. */
  apiKey: string;
  /** Language of the copy and the map labels: "en" (default) or "fr". */
  lang?: "en" | "fr";
  className?: string;
}) {
  const copy = COPY[lang];
  const [weighting, setWeighting] = useState<Weighting>("even");

  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div role="region" aria-label={copy.title} className="relative h-96">
        <Map apiKey={apiKey} center={[-79.4, 43.71]} zoom={10.75} lang={lang}>
          {/* One radius in both states; weighted, the intensity is divided by the mean weight (about 3),
              so the switch moves the hot spots rather than just heating the whole map up. */}
          <HeatmapLayer
            data={POINTS}
            weight={weighting === "weighted" ? "weight" : 1}
            intensity={weighting === "weighted" ? 1 / 3 : 1}
            radius={44}
          />
        </Map>
      </div>
      {/* No key, no map: one line says what to add. */}
      {apiKey.trim() === "" ? <p className="text-xs text-muted-foreground">{copy.noKey}</p> : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <ToggleGroup
          aria-label={copy.group}
          variant="outline"
          size="sm"
          value={[weighting]}
          onValueChange={(next: unknown[]) => {
            // One option is always on: pressing the pressed one keeps it.
            if (next[0] === "even" || next[0] === "weighted") setWeighting(next[0]);
          }}
        >
          <ToggleGroupItem value="even">{copy.even}</ToggleGroupItem>
          <ToggleGroupItem value="weighted">{copy.weighted}</ToggleGroupItem>
        </ToggleGroup>
        <p className="text-sm text-muted-foreground">{copy.hint}</p>
      </div>
      <p className="text-xs text-muted-foreground">{copy.data}</p>
    </div>
  );
}
