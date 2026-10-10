"use client";

import { useState } from "react";
import { Map } from "@/components/ui/map";
import { Draw, type DrawValue } from "@/components/ui/draw";
import { cn } from "@/lib/utils";

const COPY = {
  en: {
    noKey: "Add your unmap key to load the map.",
    title: "Draw on the map",
    hint: "Pick a tool and draw on the map. Click or tap the last point again to finish.",
    result: (count: number) => (count === 1 ? "1 shape, ready as GeoJSON" : `${count} shapes, ready as GeoJSON`),
  },
  fr: {
    noKey: "Ajoutez votre clé unmap pour charger la carte.",
    title: "Dessiner sur la carte",
    hint: "Choisissez un outil et dessinez sur la carte. Cliquez ou touchez de nouveau le dernier point pour terminer.",
    result: (count: number) => (count === 1 ? "1 forme, prête en GeoJSON" : `${count} formes, prêtes en GeoJSON`),
  },
} as const;

/**
 * A minimal example: draw points, lines, areas and circles on a map of Calgary, then select,
 * move and delete them. Every change arrives as a GeoJSON FeatureCollection in `onValueChange`,
 * ready to save. Drawing happens in the browser: the only requests are the map's own.
 */
export function MapDraw({
  apiKey,
  lang = "en",
  className,
}: {
  /** Your Unmap browser key. */
  apiKey: string;
  /** Language of the copy, the toolbar and the map labels: "en" (default) or "fr". */
  lang?: "en" | "fr";
  className?: string;
}) {
  const copy = COPY[lang];
  const [drawing, setDrawing] = useState<DrawValue | null>(null);
  const count = drawing?.features.length ?? 0;

  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div role="region" aria-label={copy.title} className="relative h-96">
        <Map apiKey={apiKey} center={[-114.07, 51.05]} zoom={13} lang={lang}>
          {/* `drawing` is the GeoJSON to save or send; here it only counts the shapes. */}
          <Draw lang={lang} onValueChange={setDrawing} />
        </Map>
      </div>
      {/* No key, no map: one line says what to add. */}
      {apiKey.trim() === "" ? <p className="text-xs text-muted-foreground">{copy.noKey}</p> : null}
      <p aria-live="polite" className="text-sm text-muted-foreground tabular-nums">
        {count > 0 ? <span className="font-medium text-foreground">{copy.result(count)}</span> : copy.hint}
      </p>
    </div>
  );
}
