"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Map } from "@/components/ui/map";
import { FeatureInspector, featureLabel, type InspectedFeature } from "@/components/ui/feature-inspector";
import { useMap } from "@/lib/map-context";
import { cn } from "@/lib/utils";

const COPY = {
  en: {
    noKey: "Add your unmap key to load the map.",
    title: "Inspect map features",
    hint: "Click anything on the map to see what it is.",
    result: (name: string, layer: string) => `${name} on the ${layer} layer`,
    unnamed: (kind: string | null, layer: string) =>
      kind ? `An unnamed ${kind} on the ${layer} layer` : `An unnamed feature on the ${layer} layer`,
  },
  fr: {
    noKey: "Ajoutez votre clé unmap pour charger la carte.",
    title: "Inspecter les entités de la carte",
    hint: "Cliquez sur un élément de la carte pour voir ce que c'est.",
    result: (name: string, layer: string) => `${name}, couche ${layer}`,
    unnamed: (kind: string | null, layer: string) =>
      kind ? `Entité sans nom (${kind}), couche ${layer}` : `Entité sans nom, couche ${layer}`,
  },
} as const;

/** A name worth showing: non-blank text, or a number. */
function hasName(value: unknown): boolean {
  return (typeof value === "string" && value.trim() !== "") || typeof value === "number";
}

/**
 * The line under the map for `feature`: its name and layer, or, for the usual click on a park, a
 * building or the ground, what kind of thing it is rather than an id.
 */
function describe(feature: InspectedFeature, lang: "en" | "fr"): string {
  const copy = COPY[lang];
  const { properties, layer } = feature;
  if (hasName(properties[`name:${lang}`]) || hasName(properties.name)) return copy.result(featureLabel(feature, lang), layer);
  // Protomaps kinds are snake_case ("minor_road"); a sentence reads them with spaces.
  const kind = typeof properties.kind === "string" && properties.kind !== layer ? properties.kind.replace(/_/g, " ") : null;
  return copy.unnamed(kind, layer);
}

/** Calls `onClick` on every map click: the inspector's card stays out of the way until the first. */
function OnMapClick({ onClick }: { onClick: () => void }) {
  const map = useMap();
  const latest = useRef(onClick);
  latest.current = onClick;
  useEffect(() => {
    if (!map) return;
    const click = () => latest.current();
    map.on("click", click);
    return () => {
      map.off("click", click);
    };
  }, [map]);
  return null;
}

/**
 * Renders `children` into `slot`, below the map, while keeping them inside `<Map>`'s React tree
 * (a portal keeps context), so the inspector reaches the map without a card over it.
 */
function BelowMap({ slot, children }: { slot: HTMLElement | null; children: ReactNode }) {
  return slot ? createPortal(children, slot) : null;
}

/**
 * A minimal example: click anything on a map of Ottawa's Parliament Hill and the features there
 * are listed below the map, the topmost selected and outlined. Pick another row to read its
 * properties. Inspecting reads what the map already drew: the only requests are the map's own.
 */
export function MapInspect({
  apiKey,
  lang = "en",
  className,
}: {
  /** Your Unmap browser key. */
  apiKey: string;
  /** Language of the copy, the inspector and the map labels: "en" (default) or "fr". */
  lang?: "en" | "fr";
  className?: string;
}) {
  const copy = COPY[lang];
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const [clicked, setClicked] = useState(false);
  const [selected, setSelected] = useState<InspectedFeature | null>(null);

  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div role="region" aria-label={copy.title} className="relative h-96">
        <Map apiKey={apiKey} center={[-75.6995, 45.4236]} zoom={15} lang={lang}>
          <OnMapClick onClick={() => setClicked(true)} />
          <BelowMap slot={slot}>
            {/* Hidden, not unmounted, until the first click: the inspector listens from the start. */}
            <FeatureInspector lang={lang} onSelect={setSelected} className={cn(!clicked && "hidden")} />
          </BelowMap>
        </Map>
      </div>
      {/* No key, no map: one line says what to add. */}
      {apiKey.trim() === "" ? <p className="text-xs text-muted-foreground">{copy.noKey}</p> : null}
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {selected ? (
          <span className="font-medium text-foreground">{describe(selected, lang)}</span>
        ) : (
          copy.hint
        )}
      </p>
      <div ref={setSlot} className="min-w-0" />
    </div>
  );
}
