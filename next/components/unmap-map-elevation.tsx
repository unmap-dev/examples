"use client";

import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Map } from "@/components/ui/map";
import { GeoJSONLayer } from "@/components/ui/geojson-layer";
import { ElevationProfile, formatElevation, type ElevationProfileData } from "@/components/ui/elevation-profile";
import { cn } from "@/lib/utils";

const COPY = {
  en: {
    noKey: "Add your unmap key to load the map.",
    title: "Trail elevation profile",
    hint: "Hover the chart to find that point on the trail. Heights from the unmap elevation API.",
    result: (climb: string) => `${climb} of climb.`,
  },
  fr: {
    noKey: "Ajoutez votre clé unmap pour charger la carte.",
    title: "Profil d'altitude d'un sentier",
    hint: "Survolez le graphique pour trouver ce point sur le sentier. Altitudes de l'API d'élévation unmap.",
    result: (climb: string) => `${climb} de montée.`,
  },
} as const;

/**
 * Sample data, not a surveyed trail: six vertices that climb Tunnel Mountain in Banff from the
 * St. Julien Road side to the summit ridge, a steady 250 m or so, without every switchback.
 */
const TRAIL: [number, number][] = [
  [-115.5645, 51.1733],
  [-115.5618, 51.1744],
  [-115.56, 51.1756],
  [-115.5584, 51.1764],
  [-115.5566, 51.1771],
  [-115.5551, 51.1776],
];

const TRAIL_LINE = {
  type: "Feature" as const,
  properties: {},
  geometry: { type: "LineString" as const, coordinates: TRAIL },
};

/**
 * Renders `children` into `slot`, below the map, while keeping them inside `<Map>`'s React tree
 * (a portal keeps context), so the chart answers the map without covering it.
 */
function BelowMap({ slot, children }: { slot: HTMLElement | null; children: ReactNode }) {
  return slot ? createPortal(children, slot) : null;
}

/**
 * A minimal example: a sample trail up Tunnel Mountain on an outdoor map of Banff, with its
 * elevation profile below. Hover the chart and a marker finds that point on the trail; hover the
 * trail and the chart follows. The trail never changes, so it makes one /elevation request when
 * it mounts.
 */
export function MapElevation({
  apiKey,
  lang = "en",
  className,
}: {
  /** Your Unmap browser key. */
  apiKey: string;
  /** Language of the copy, the chart and the map labels: "en" (default) or "fr". */
  lang?: "en" | "fr";
  className?: string;
}) {
  const copy = COPY[lang];
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const [profile, setProfile] = useState<ElevationProfileData | null>(null);
  const climb = profile?.stats ? formatElevation(profile.stats.gain, lang) : null;

  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div role="region" aria-label={copy.title} className="relative h-80">
        <Map apiKey={apiKey} style="outdoor" center={[-115.5598, 51.1755]} zoom={13.75} lang={lang}>
          <GeoJSONLayer data={TRAIL_LINE} />
          <BelowMap slot={slot}>
            <ElevationProfile apiKey={apiKey} line={TRAIL} lang={lang} onProfile={setProfile} />
          </BelowMap>
        </Map>
      </div>
      {/* No key, no map: one line says what to add. */}
      {apiKey.trim() === "" ? <p className="text-xs text-muted-foreground">{copy.noKey}</p> : null}
      {/* No live region: the profile announces its distance and climb itself. */}
      <p className="text-sm text-muted-foreground tabular-nums">
        {climb && <span className="font-medium text-foreground">{copy.result(climb)} </span>}
        {copy.hint}
      </p>
      <div ref={setSlot} className="@container min-w-0" />
    </div>
  );
}
