"use client";

import { CompareSwipe } from "@/components/ui/compare-swipe";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const COPY = {
  en: {
    noKey: "Add your unmap key to load the map.",
    title: "Compare two styles",
    hint: "Drag the divider to compare the base and outdoor styles.",
    before: "Base",
    after: "Outdoor",
  },
  fr: {
    noKey: "Ajoutez votre clé unmap pour charger la carte.",
    title: "Comparer deux styles",
    hint: "Faites glisser le séparateur pour comparer les styles base et outdoor.",
    before: "Base",
    after: "Outdoor",
  },
} as const;

/**
 * A minimal example: Vancouver in the base style left of the divider and the outdoor style right
 * of it, on one shared camera. Drag the divider, or focus it and use the arrow keys. Each side
 * names its style in a corner of its own map, so the name slides away with it.
 */
export function MapCompare({
  apiKey,
  lang = "en",
  className,
}: {
  /** Your Unmap browser key. */
  apiKey: string;
  /** Language of the copy, the divider's label and the map labels: "en" (default) or "fr". */
  lang?: "en" | "fr";
  className?: string;
}) {
  const copy = COPY[lang];
  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div role="region" aria-label={copy.title} className="relative h-96">
        <CompareSwipe
          apiKey={apiKey}
          center={[-123.12, 49.28]}
          zoom={12}
          lang={lang}
          before={{
            style: "base",
            lang,
            children: (
              <Badge variant="secondary" className="absolute top-2.5 left-2.5 z-10">
                {copy.before}
              </Badge>
            ),
          }}
          after={{
            style: "outdoor",
            lang,
            // Clear of the zoom and compass buttons in the after map's top-right corner.
            children: (
              <Badge variant="secondary" className="absolute top-2.5 right-12 z-10">
                {copy.after}
              </Badge>
            ),
          }}
          className="h-full"
        />
      </div>
      {/* No key, no map: one line says what to add. */}
      {apiKey.trim() === "" ? <p className="text-xs text-muted-foreground">{copy.noKey}</p> : null}
      <p className="text-sm text-muted-foreground">{copy.hint}</p>
    </div>
  );
}
