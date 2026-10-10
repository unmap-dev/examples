"use client";

import { useEffect, useState } from "react";
import { Map } from "@/components/ui/map";
import { ArcLayer, type ArcDatum } from "@/components/ui/arc-layer";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useMap } from "@/lib/map-context";
import { cn } from "@/lib/utils";

const COPY = {
  en: {
    noKey: "Add your unmap key to load the map.",
    title: "Arcs from Winnipeg",
    hint: "Click an arc or pick a city.",
    pick: "Destination",
    result: (city: string, km: string) => `Winnipeg to ${city}, ${km} km as the crow flies`,
    credit:
      "Capitals: Canadian Geographical Names Database. Contains information licensed under the Open Government Licence – Canada.",
  },
  fr: {
    noKey: "Ajoutez votre clé unmap pour charger la carte.",
    title: "Arcs depuis Winnipeg",
    hint: "Cliquez sur un arc ou choisissez une ville.",
    pick: "Destination",
    result: (city: string, km: string) => `Winnipeg vers ${city}, ${km} km à vol d'oiseau`,
    credit:
      "Capitales : Base de données toponymiques du Canada. Contient de l'information visée par la Licence du gouvernement ouvert – Canada.",
  },
} as const;

/**
 * Illustrative links: Winnipeg to six provincial capitals. The capitals' positions are from the
 * Canadian Geographical Names Database (Natural Resources Canada), Open Government Licence, Canada;
 * the links themselves stand for whatever yours carry (routes, shipments, calls).
 */
const WINNIPEG: [number, number] = [-97.14639, 49.88444];
const CAPITALS: { id: string; name: string; name_fr: string; at: [number, number] }[] = [
  { id: "victoria", name: "Victoria", name_fr: "Victoria", at: [-123.36472, 48.42833] },
  { id: "edmonton", name: "Edmonton", name_fr: "Edmonton", at: [-113.49028, 53.53444] },
  { id: "regina", name: "Regina", name_fr: "Regina", at: [-104.60661, 50.45484] },
  { id: "toronto", name: "Toronto", name_fr: "Toronto", at: [-79.3733, 43.7417] },
  { id: "quebec", name: "Québec City", name_fr: "Québec", at: [-71.208, 46.81382] },
  { id: "halifax", name: "Halifax", name_fr: "Halifax", at: [-63.59065, 44.6474] },
];

const LINKS: ArcDatum[] = CAPITALS.map(({ id, name, name_fr, at }) => ({ id, from: WINNIPEG, to: at, name, name_fr }));

/** Great-circle distance in kilometres. */
function kilometres(a: [number, number], b: [number, number]): number {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b[1] - a[1]) * rad) / 2) ** 2 +
    Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(((b[0] - a[0]) * rad) / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.sqrt(h));
}

/** Frames every capital once the map exists, so the links fit a phone as well as a desktop. */
function FitLinks() {
  const map = useMap();
  useEffect(() => {
    map?.fitBounds([[-124.5, 43], [-62.5, 54.5]], { padding: 24, animate: false });
  }, [map]);
  return null;
}

/**
 * A minimal example: arcs from Winnipeg to six provincial capitals in your --primary. Click an
 * arc, or pick its city below the map (a thin line is hard to hit with a finger, and a keyboard
 * cannot reach one), and the link is drawn again on top with its straight-line distance. The arcs
 * are drawn in the browser: the only requests are the map's own.
 */
export function MapArcs({
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
  const [picked, setPicked] = useState<string | null>(null);
  const capital = CAPITALS.find((entry) => entry.id === picked);
  // To the nearest 10 km: the arcs end at a city's reference point, not its edge.
  const km = capital
    ? new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA").format(Math.round(kilometres(WINNIPEG, capital.at) / 10) * 10)
    : "";

  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div role="region" aria-label={copy.title} className="relative h-96">
        <Map apiKey={apiKey} center={[-94, 49.5]} zoom={3.5} lang={lang}>
          <FitLinks />
          <ArcLayer data={LINKS} onClick={(event) => setPicked(String(event.feature.properties.id ?? ""))} />
          {/* The picked link again, wider, on top: the item's own colour, only the width changes. */}
          <ArcLayer id="picked" data={LINKS.filter((link) => link.id === picked)} width={4} />
        </Map>
      </div>
      {/* No key, no map: one line says what to add. */}
      {apiKey.trim() === "" ? <p className="text-xs text-muted-foreground">{copy.noKey}</p> : null}
      <ToggleGroup
        aria-label={copy.pick}
        variant="outline"
        size="sm"
        className="flex-wrap"
        value={picked ? [picked] : []}
        onValueChange={(next: unknown[]) => setPicked(typeof next[0] === "string" ? next[0] : null)}
      >
        {CAPITALS.map((entry) => (
          <ToggleGroupItem key={entry.id} value={entry.id}>
            {lang === "fr" ? entry.name_fr : entry.name}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p aria-live="polite" className="text-sm text-muted-foreground tabular-nums">
        {capital ? (
          <span className="font-medium text-foreground">{copy.result(lang === "fr" ? capital.name_fr : capital.name, km)}</span>
        ) : (
          copy.hint
        )}
      </p>
      <p className="text-xs text-muted-foreground">{copy.credit}</p>
    </div>
  );
}
