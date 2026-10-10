"use client";

import { useEffect, useRef, useState } from "react";
import { Map } from "@/components/ui/map";
import { Measure, isRepeatClick, measureClick, type MapPointer, type MeasureChange, type MeasureClick } from "@/components/ui/measure";
import { useMap } from "@/lib/map-context";
import { cn } from "@/lib/utils";

const COPY = {
  en: {
    noKey: "Add your unmap key to load the map.",
    title: "Measure a distance",
    hint: "Click the map to measure. Double-click or double-tap to finish.",
    result: (distance: string, points: number) => `${distance} over ${points} points`,
    done: "Done. Undo to keep going, or Clear to start over.",
  },
  fr: {
    noKey: "Ajoutez votre clé unmap pour charger la carte.",
    title: "Mesurer une distance",
    hint: "Cliquez sur la carte pour mesurer. Double-cliquez ou touchez deux fois pour terminer.",
    result: (distance: string, points: number) => `${distance} sur ${points} points`,
    done: "Terminé. Annulez pour continuer, ou effacez pour recommencer.",
  },
} as const;

/** Metres under 1 km, kilometres with one decimal above, written the English or the French way. */
function distance(metres: number, lang: "en" | "fr"): string {
  const number = new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { maximumFractionDigits: 1 });
  return metres < 999.5 ? `${number.format(Math.round(metres))} m` : `${number.format(metres / 1000)} km`;
}

/**
 * Calls `onFinish` on a double-click or double-tap, read the way `<Measure>` reads one: two clicks
 * a few pixels and half a second apart. `<Measure>` adds one point for the pair; this ends the line.
 * `onFinish` says whether it did (a line needs two points). Ending the line hands the map its
 * double-click zoom back, so the browser's `dblclick` that follows the pair is cancelled here, or
 * finishing would also zoom in.
 */
function FinishOnDoubleClick({ onFinish }: { onFinish: () => boolean }) {
  const map = useMap();
  const finish = useRef(onFinish);
  finish.current = onFinish;
  useEffect(() => {
    if (!map) return;
    let last: MeasureClick | null = null;
    let finished = false;
    const onClick = (event: MapPointer) => {
      const click = measureClick(event);
      finished = isRepeatClick(last, click) && finish.current();
      last = click;
    };
    const onDoubleClick = (event: { preventDefault: () => void }) => {
      if (finished) event.preventDefault();
      finished = false;
    };
    map.on("click", onClick);
    map.on("dblclick", onDoubleClick);
    return () => {
      map.off("click", onClick);
      map.off("dblclick", onDoubleClick);
    };
  }, [map]);
  return null;
}

/**
 * A minimal example: click points on a map of Calgary and read the distance as you go. A
 * double-click ends the line; Undo reopens it and Clear starts again. Measuring happens in the
 * browser: the only requests are the map's own.
 */
export function MapMeasure({
  apiKey,
  lang = "en",
  className,
}: {
  /** Your Unmap browser key. */
  apiKey: string;
  /** Language of the copy, the distances and the map labels: "en" (default) or "fr". */
  lang?: "en" | "fr";
  className?: string;
}) {
  const copy = COPY[lang];
  const [measured, setMeasured] = useState<MeasureChange>({ points: [], metres: 0 });
  const [finished, setFinished] = useState(false);
  const count = measured.points.length;

  const onChange = (change: MeasureChange) => {
    setMeasured(change);
    // Only Undo and Clear report while the line is finished: either one reopens it.
    setFinished(false);
  };

  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div role="region" aria-label={copy.title} className="relative h-96">
        <Map apiKey={apiKey} center={[-114.07, 51.05]} zoom={13} lang={lang}>
          <Measure
            lang={lang}
            // The label on the line and the result below it read the same number.
            format={(metres) => distance(metres, lang)}
            active={!finished}
            onChange={onChange}
            // The line below the map reads the total, so the tool's own readout is hidden, and
            // Undo and Clear stay out of the way until there is something to undo.
            className={cn(
              "absolute top-3 left-3 z-10 [&_[data-unmap-measure-total]]:hidden",
              count === 0 && "invisible",
            )}
          />
          <FinishOnDoubleClick
            onFinish={() => {
              if (finished || count < 2) return false;
              setFinished(true);
              return true;
            }}
          />
        </Map>
      </div>
      {/* No key, no map: one line says what to add. */}
      {apiKey.trim() === "" ? <p className="text-xs text-muted-foreground">{copy.noKey}</p> : null}
      <p aria-live="polite" className="text-sm text-muted-foreground tabular-nums">
        {count < 2 ? (
          copy.hint
        ) : (
          <>
            <span className="font-medium text-foreground">{copy.result(distance(measured.metres, lang), count)}</span>
            {finished && <span> {copy.done}</span>}
          </>
        )}
      </p>
    </div>
  );
}
