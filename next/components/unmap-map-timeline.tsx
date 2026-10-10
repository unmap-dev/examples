"use client";

import { useState } from "react";
import { Map } from "@/components/ui/map";
import { GeoJSONLayer } from "@/components/ui/geojson-layer";
import { TimeSlider, type TimeSliderValue } from "@/components/ui/time-slider";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const COPY = {
  en: {
    noKey: "Add your unmap key to load the map.",
    title: "Bike-share docks by year",
    hint: "Press play or drag the slider to add docks year by year.",
    result: (count: number, year: number) => `${count} docks by ${year}`,
  },
  fr: {
    noKey: "Ajoutez votre clé unmap pour charger la carte.",
    title: "Stations de vélopartage par année",
    hint: "Lancez la lecture ou faites glisser le curseur pour ajouter les stations année par année.",
    result: (count: number, year: number) => `${count} stations en service en ${year}`,
  },
} as const;

const FIRST_YEAR = 2019;
const LAST_YEAR = 2025;

/**
 * Sample data, not a real network: 24 bike-share docks in Calgary's inner city, each with the year
 * it opened. The places are real; the docks and years are made up. They sit about 300 m apart
 * inside the part of the map that stays clear of the slider, at every width.
 */
const DOCKS: [string, number, number, number][] = [
  ["Stephen Avenue", -114.066, 51.0465, 2019],
  ["Eau Claire", -114.071, 51.054, 2019],
  ["Beltline", -114.072, 51.041, 2019],
  ["East Village", -114.052, 51.046, 2019],
  ["Chinatown", -114.063, 51.051, 2020],
  ["Downtown West End", -114.084, 51.049, 2020],
  ["Mission", -114.068, 51.037, 2020],
  ["Victoria Park", -114.059, 51.04, 2020],
  ["Connaught", -114.083, 51.041, 2021],
  ["Bridgeland", -114.046, 51.054, 2021],
  ["Inglewood", -114.044, 51.039, 2021],
  ["Hillhurst", -114.086, 51.055, 2022],
  ["Sunnyside", -114.077, 51.057, 2022],
  ["Prince's Island", -114.069, 51.0565, 2022],
  ["Crescent Heights", -114.062, 51.059, 2023],
  ["Calgary Tower", -114.0631, 51.0442, 2023],
  ["Olympic Plaza", -114.0575, 51.0457, 2023],
  ["Central Library", -114.0545, 51.049, 2023],
  ["Kensington Road", -114.087, 51.0525, 2024],
  ["Memorial Park", -114.0715, 51.0385, 2024],
  ["Stampede Park", -114.054, 51.037, 2024],
  ["Riverfront", -114.0565, 51.0525, 2025],
  ["Fort Calgary", -114.0455, 51.0455, 2025],
  ["Cliff Bungalow", -114.077, 51.0365, 2025],
];

const DATA = {
  type: "FeatureCollection" as const,
  features: DOCKS.map(([name, lng, lat, year]) => ({
    type: "Feature" as const,
    properties: { name, year },
    geometry: { type: "Point" as const, coordinates: [lng, lat] },
  })),
};

/** The year a slider value ends on: the value itself, or the end of a range. */
function yearOf(value: TimeSliderValue): number {
  return typeof value === "number" ? value : value[1];
}

/**
 * A minimal example: sample bike-share docks on a map of Calgary, added year by year as the
 * slider plays or moves. Filtering happens in the browser: the only requests are the map's own.
 */
export function MapTimeline({
  apiKey,
  lang = "en",
  className,
}: {
  /** Your Unmap browser key. */
  apiKey: string;
  /** Language of the copy, the slider and the map labels: "en" (default) or "fr". */
  lang?: "en" | "fr";
  className?: string;
}) {
  const copy = COPY[lang];
  const [year, setYear] = useState(FIRST_YEAR);
  const [moved, setMoved] = useState(false);
  const count = DOCKS.filter((dock) => dock[3] <= year).length;

  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div role="region" aria-label={copy.title} className="relative h-96">
        <Map apiKey={apiKey} center={[-114.065, 51.04]} zoom={12} lang={lang}>
          <GeoJSONLayer id="docks" data={DATA} />
          {/* Above the attribution, across the bottom on a phone, at the left on a wider screen. */}
          <Card size="sm" className="absolute inset-x-3 bottom-10 z-10 sm:right-auto sm:w-80">
            <CardContent>
              <TimeSlider
                layers={["docks-*"]}
                property="year"
                min={FIRST_YEAR}
                max={LAST_YEAR}
                value={year}
                onValueChange={(value) => {
                  setYear(yearOf(value));
                  setMoved(true);
                }}
                cumulative
                interval={800}
                lang={lang}
              />
            </CardContent>
          </Card>
        </Map>
      </div>
      {/* No key, no map: one line says what to add. */}
      {apiKey.trim() === "" ? <p className="text-xs text-muted-foreground">{copy.noKey}</p> : null}
      <p aria-live="polite" className="text-sm text-muted-foreground tabular-nums">
        {moved ? <span className="font-medium text-foreground">{copy.result(count, year)}</span> : copy.hint}
      </p>
    </div>
  );
}
