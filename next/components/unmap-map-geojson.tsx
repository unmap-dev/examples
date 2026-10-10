"use client";

import { useEffect, useState } from "react";
import { Map } from "@/components/ui/map";
import { GeoJSONLayer } from "@/components/ui/geojson-layer";
import { useMap } from "@/lib/map-context";
import { cn } from "@/lib/utils";

const COPY = {
  en: {
    noKey: "Add your unmap key to load the map.",
    title: "Service zones",
    hint: "Click a zone to read its properties.",
    data: "Three illustrative zones; the hours are made up.",
  },
  fr: {
    noKey: "Ajoutez votre clé unmap pour charger la carte.",
    title: "Zones de service",
    hint: "Cliquez sur une zone pour lire ses propriétés.",
    data: "Trois zones illustratives ; les heures sont inventées.",
  },
} as const;

type Zone = { name: string; name_fr: string; hours: string; hours_fr: string; ring: [number, number][] };

/**
 * Illustrative data, not a real service: three delivery zones drawn over Calgary's inner city, each
 * with the hours a courier would cover it. The neighbourhoods are real; the zones and hours are not.
 */
const ZONES: Zone[] = [
  {
    name: "Downtown",
    name_fr: "Centre-ville",
    hours: "every day, 7:00 to 22:00",
    hours_fr: "tous les jours, de 7 h à 22 h",
    ring: [[-114.098, 51.054], [-114.07, 51.056], [-114.035, 51.053], [-114.037, 51.036], [-114.072, 51.035], [-114.098, 51.037], [-114.098, 51.054]],
  },
  {
    name: "North Hill",
    name_fr: "North Hill",
    hours: "Monday to Saturday, 8:00 to 20:00",
    hours_fr: "du lundi au samedi, de 8 h à 20 h",
    ring: [[-114.112, 51.081], [-114.072, 51.085], [-114.032, 51.079], [-114.035, 51.06], [-114.075, 51.059], [-114.11, 51.061], [-114.112, 51.081]],
  },
  {
    name: "Beltline South",
    name_fr: "Beltline Sud",
    hours: "weekdays, 9:00 to 18:00",
    hours_fr: "en semaine, de 9 h à 18 h",
    ring: [[-114.103, 51.032], [-114.07, 51.033], [-114.042, 51.031], [-114.045, 51.013], [-114.075, 51.011], [-114.1, 51.015], [-114.103, 51.032]],
  },
];

const DATA = {
  type: "FeatureCollection" as const,
  features: ZONES.map(({ ring, ...properties }, index) => ({
    type: "Feature" as const,
    id: index,
    properties,
    geometry: { type: "Polygon" as const, coordinates: [ring] },
  })),
};

/** Frames the three zones once the map exists, at every width. */
function FitZones() {
  const map = useMap();
  useEffect(() => {
    map?.fitBounds([[-114.112, 51.011], [-114.032, 51.085]], { padding: 24, animate: false });
  }, [map]);
  return null;
}

/**
 * A minimal example: three illustrative service zones over Calgary, drawn in your --primary. Hover
 * a zone to highlight it and click it to read its name and hours. The zones are drawn in the
 * browser: the only requests are the map's own.
 */
export function MapGeojson({
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
  const [zone, setZone] = useState<Record<string, unknown> | null>(null);
  const field = (name: string) => String(zone?.[lang === "fr" ? `${name}_fr` : name] ?? "");

  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div role="region" aria-label={copy.title} className="relative h-96">
        <Map apiKey={apiKey} center={[-114.072, 51.048]} zoom={11} lang={lang}>
          <FitZones />
          <GeoJSONLayer data={DATA} onClick={(event) => setZone(event.feature.properties)} />
        </Map>
      </div>
      {/* No key, no map: one line says what to add. */}
      {apiKey.trim() === "" ? <p className="text-xs text-muted-foreground">{copy.noKey}</p> : null}
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {zone ? (
          <>
            <span className="font-medium text-foreground">{field("name")}</span>
            {lang === "fr" ? " : " : ": "}
            {field("hours")}
          </>
        ) : (
          copy.hint
        )}
      </p>
      <p className="text-xs text-muted-foreground">{copy.data}</p>
    </div>
  );
}
