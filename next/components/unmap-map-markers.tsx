"use client";

import { Map } from "@/components/ui/map";
import { Marker, Popup } from "@/components/ui/marker-popup";
import { Button } from "@/components/ui/button";

/** A minimal example: an accessible marker with a click-to-open popup. */
export function MapMarkers({
  apiKey,
  lang: language = "en",
}: {
  apiKey: string;
  /** Language of the copy and the map labels: "en" (default) or "fr". */
  lang?: "en" | "fr";
}) {
  const name = language === "fr" ? "Parc de l’Île" : "Prince's Island Park";
  return (
    <div role="region" aria-label={name} className="h-96">
      <Map apiKey={apiKey} center={[-114.0705, 51.055]} zoom={14} lang={language}>
        <Marker
          lngLat={[-114.0705, 51.055]}
          markerContent={<Button variant="outline">{name}</Button>}
        >
          <Popup>
            <p className="text-sm">
              {language === "fr"
                ? "Un arrêt au bord de la rivière Bow, à Calgary."
                : "A stop beside the Bow River in Calgary."}
            </p>
          </Popup>
        </Marker>
      </Map>
    </div>
  );
}
