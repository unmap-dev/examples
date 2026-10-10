"use client";

/**
 * <HeatmapLayer> - point density as a heatmap. `weight` takes a property name (or a constant) to
 * weigh each point. The ramp is your `--primary` from transparent to solid unless you pass `colors`.
 *
 * Copied into your project by `npx shadcn add`. Edit freely.
 */

import { useId } from "react";
import { accentColor, themeMeta, useLayerSet, withAlpha, type BeforeId, type GeoJSONData, type LayerSpec } from "@/lib/map-layers";

export interface HeatmapLayerProps {
  /** Point features or a URL MapLibre fetches. */
  data: GeoJSONData;
  /** Map id when multiple maps share a page. Defaults to "default". */
  mapId?: string;
  /** Source id and layer-id prefix. Defaults to a generated id. */
  id?: string;
  /** A numeric property to weigh each point by, or a constant weight. Defaults to 1. */
  weight?: string | number;
  /** Radius of each point's influence in pixels. Defaults to 20. */
  radius?: number;
  /** Multiplier on the density. Defaults to 1. */
  intensity?: number;
  /** Layer opacity, 0 to 1. Defaults to 0.8. */
  opacity?: number;
  /** Colours from low to high density. Defaults to your --primary at rising opacity. */
  colors?: string[];
  /** Insertion point. Default: below the labels. `null`: on top. */
  beforeId?: BeforeId;
}

const ALPHAS = [0.25, 0.45, 0.65, 0.85, 1];

export function HeatmapLayer({ data, mapId, id, weight, radius = 20, intensity = 1, opacity = 0.8, colors, beforeId }: HeatmapLayerProps) {
  const generated = `unmap-heatmap-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const sourceId = id ?? generated;

  useLayerSet({
    mapId,
    sourceId,
    data,
    beforeId,
    key: JSON.stringify([weight, radius, intensity, opacity, colors]),
    layers: (live) => {
      const accent = accentColor(live, undefined, themeMeta(live).marker?.color);
      const ramp = colors && colors.length > 0 ? colors : ALPHAS.map((alpha) => withAlpha(accent, alpha));
      const stops = ramp.flatMap((colour, index) => [(index + 1) / ramp.length, colour]);
      return [
        {
          id: `${sourceId}-heat`,
          type: "heatmap",
          source: sourceId,
          paint: {
            // A missing or unparseable value weighs 0; to-number throws without the fallback.
            "heatmap-weight": typeof weight === "string" ? ["to-number", ["get", weight], 0] : (weight ?? 1),
            "heatmap-radius": radius,
            "heatmap-intensity": intensity,
            "heatmap-opacity": opacity,
            "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(0, 0, 0, 0)", ...stops],
          },
        } as LayerSpec,
      ];
    },
  });
  return null;
}
