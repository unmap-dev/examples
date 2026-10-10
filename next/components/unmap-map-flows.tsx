"use client";

import { useEffect, useState } from "react";
import { Map } from "@/components/ui/map";
import { FlowLayer, type Flow, type FlowLocation } from "@/components/ui/flow-layer";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { MapFeatureEvent } from "@/lib/map-layers";
import { useMap } from "@/lib/map-context";
import { cn } from "@/lib/utils";

const COPY = {
  en: {
    noKey: "Add your unmap key to load the map.",
    title: "Migration between the western provinces",
    hint: "Hover or tap a province for its totals in and out.",
    pick: "Province",
    place: (name: string, arrived: string, left: string) =>
      `${name}: ${arrived} arrived from the other three provinces, ${left} left for them`,
    flow: (from: string, to: string, people: string) => `${from} to ${to}: ${people} people`,
    credit:
      "Adapted from Statistics Canada, Table 17-10-0022-01 Estimates of interprovincial migrants by province or territory of origin and destination, annual, 2024/2025. This does not constitute an endorsement by Statistics Canada of this product. Capitals: Canadian Geographical Names Database. Contains information licensed under the Open Government Licence – Canada.",
  },
  fr: {
    noKey: "Ajoutez votre clé unmap pour charger la carte.",
    title: "Migration entre les provinces de l'Ouest",
    hint: "Survolez ou touchez une province pour voir ses totaux entrants et sortants.",
    pick: "Province",
    place: (name: string, arrived: string, left: string) =>
      `${name} : ${arrived} arrivées des trois autres provinces, ${left} départs vers elles`,
    flow: (from: string, to: string, people: string) => `${from} vers ${to} : ${people} personnes`,
    credit:
      "Adapté de Statistique Canada, Tableau 17-10-0022-01 Estimations des migrants interprovinciaux selon la province ou territoire d'origine et de destination, annuelles, 2024/2025. Cela ne constitue pas une approbation de ce produit par Statistique Canada. Capitales : Base de données toponymiques du Canada. Contient de l'information visée par la Licence du gouvernement ouvert – Canada.",
  },
} as const;

const NAMES_FR: Record<string, string> = { BC: "Colombie-Britannique", AB: "Alberta", SK: "Saskatchewan", MB: "Manitoba" };

/**
 * Real data, a small extract: interprovincial migrants between the four western provinces, 1 July
 * 2024 to 30 June 2025. Adapted from Statistics Canada, Table 17-10-0022-01 Estimates of
 * interprovincial migrants by province or territory of origin and destination, annual
 * (DOI 10.25318/1710002201-eng), Statistics Canada Open Licence. Each province sits at its capital,
 * from the Canadian Geographical Names Database (Natural Resources Canada), Open Government Licence,
 * Canada.
 */
const PROVINCES: FlowLocation[] = [
  { id: "BC", name: "British Columbia", lat: 48.42833, lon: -123.36472 },
  { id: "AB", name: "Alberta", lat: 53.53444, lon: -113.49028 },
  { id: "SK", name: "Saskatchewan", lat: 50.45484, lon: -104.60661 },
  { id: "MB", name: "Manitoba", lat: 49.88444, lon: -97.14639 },
];
const MIGRANTS: Flow[] = (
  [
    ["MB", "SK", 1111], ["MB", "AB", 4607], ["MB", "BC", 3404],
    ["SK", "MB", 1142], ["SK", "AB", 7502], ["SK", "BC", 3333],
    ["AB", "MB", 2152], ["AB", "SK", 4300], ["AB", "BC", 19245],
    ["BC", "MB", 2172], ["BC", "SK", 2931], ["BC", "AB", 23456],
  ] as const
).map(([origin, dest, count]) => ({ origin, dest, count }));

/** A province's totals in and out, from the same flows the map draws: what a picked province reports. */
function provinceTotals(place: FlowLocation): Record<string, unknown> {
  const arrived = MIGRANTS.filter((flow) => flow.dest === place.id).reduce((sum, flow) => sum + flow.count, 0);
  const left = MIGRANTS.filter((flow) => flow.origin === place.id).reduce((sum, flow) => sum + flow.count, 0);
  return { id: place.id, name: place.name, in: arrived, out: left, total: arrived + left };
}

/** Frames the four capitals once the map exists, so the flows fit a phone as well as a desktop. */
function FitProvinces() {
  const map = useMap();
  useEffect(() => {
    map?.fitBounds([[-125, 45.8], [-95.5, 55]], { padding: 32, animate: false });
  }, [map]);
  return null;
}

/**
 * A minimal example: a year of migration between British Columbia, Alberta, Saskatchewan and
 * Manitoba, from Statistics Canada, as flows whose width follows the number of people. Hover (or
 * tap) a province for its totals in and out, or a flow for its count; or pin a province below the
 * map (a keyboard cannot reach a circle on a canvas). The flows are drawn in the browser: the only
 * requests are the map's own.
 */
export function MapFlows({
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
  // A hover shows while the pointer is there; a click (or a tap, which has no hover) stays.
  const [hovered, setHovered] = useState<Record<string, unknown> | null>(null);
  const [pinned, setPinned] = useState<Record<string, unknown> | null>(null);
  const over = hovered ?? pinned;
  const pinnedProvince = pinned && "in" in pinned ? String(pinned.id) : null;
  const number = new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA");
  const name = (id: unknown, fallback: unknown) => (lang === "fr" ? NAMES_FR[String(id)] : undefined) ?? String(fallback ?? id);

  let result: string | null = null;
  if (over && "in" in over) result = copy.place(name(over.id, over.name), number.format(Number(over.in)), number.format(Number(over.out)));
  else if (over && "origin" in over)
    result = copy.flow(name(over.origin, over.originName), name(over.dest, over.destName), number.format(Number(over.count)));

  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div role="region" aria-label={copy.title} className="relative h-96">
        <Map apiKey={apiKey} center={[-108, 51]} zoom={4.5} lang={lang}>
          <FitProvinces />
          <FlowLayer
            locations={PROVINCES}
            flows={MIGRANTS}
            onHover={(event: MapFeatureEvent | null) => setHovered(event?.feature.properties ?? null)}
            onClick={(event: MapFeatureEvent) => setPinned(event.feature.properties)}
          />
        </Map>
      </div>
      {/* No key, no map: one line says what to add. */}
      {apiKey.trim() === "" ? <p className="text-xs text-muted-foreground">{copy.noKey}</p> : null}
      <ToggleGroup
        aria-label={copy.pick}
        variant="outline"
        size="sm"
        className="flex-wrap"
        value={pinnedProvince ? [pinnedProvince] : []}
        onValueChange={(next: unknown[]) => {
          const place = PROVINCES.find((entry) => entry.id === next[0]);
          setPinned(place ? provinceTotals(place) : null);
        }}
      >
        {PROVINCES.map((place) => (
          <ToggleGroupItem key={place.id} value={place.id}>
            {name(place.id, place.name)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p aria-live="polite" className="text-sm text-muted-foreground tabular-nums">
        {result ? <span className="font-medium text-foreground">{result}</span> : copy.hint}
      </p>
      <p className="text-xs text-muted-foreground">{copy.credit}</p>
    </div>
  );
}
