"use client";

import { Map } from "@/components/ui/map";
import { ClusterLayer } from "@/components/ui/cluster-layer";
import { cn } from "@/lib/utils";

const COPY = {
  en: {
    noKey: "Add your unmap key to load the map.",
    title: "Clustered points",
    hint: "Click a cluster to zoom in until it splits.",
    data: "60 illustrative points across Montréal.",
  },
  fr: {
    noKey: "Ajoutez votre clé unmap pour charger la carte.",
    title: "Points regroupés",
    hint: "Cliquez sur un groupe pour zoomer jusqu'à ce qu'il se sépare.",
    data: "60 points illustratifs répartis dans Montréal.",
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

/** Illustrative data: 60 points scattered over the island of Montréal around the Plateau, not real places. */
const POINTS = samplePoints([-73.64, 45.52], 60, 0.09);

/**
 * A minimal example: 60 illustrative points around Montréal, grouped into clusters that show how
 * many points they hold. Click a cluster and the map zooms in until it splits. Clustering happens
 * in the browser: the only requests are the map's own.
 */
export function MapClusters({
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
  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div role="region" aria-label={copy.title} className="relative h-96">
        <Map apiKey={apiKey} center={[-73.64, 45.52]} zoom={11} lang={lang}>
          <ClusterLayer data={POINTS} />
        </Map>
      </div>
      {/* No key, no map: one line says what to add. */}
      {apiKey.trim() === "" ? <p className="text-xs text-muted-foreground">{copy.noKey}</p> : null}
      <p className="text-sm text-muted-foreground">
        {copy.hint} {copy.data}
      </p>
    </div>
  );
}
