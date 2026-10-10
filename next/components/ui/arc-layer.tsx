"use client";

/**
 * <ArcLayer> - curved connections between pairs of places: flights, trade routes, referrals.
 * Each datum is `{ id, from, to, ...anything }`; the extra fields reach your handlers and can drive
 * paint through `["get", field]`. Opposite directions bow apart, so A to B and B to A never overlap.
 *
 * Colour defaults to your `--primary` (or the theme accent, per the Map's accent). Pass `onClick` or
 * `onHover` (or `interactive`) to highlight and report the arc under the pointer.
 *
 * Copied into your project by `npx shadcn add`. Edit freely.
 */

import { useId, useMemo } from "react";
import {
  accentColor,
  arcLine,
  themeMeta,
  useLayerPointer,
  useLayerSet,
  type BeforeId,
  type LayerSpec,
  type MapFeatureEvent,
} from "@/lib/map-layers";

export interface ArcDatum {
  id: string | number;
  /** Start as [longitude, latitude]. */
  from: [number, number];
  /** End as [longitude, latitude]. */
  to: [number, number];
  [property: string]: unknown;
}

export interface ArcLayerProps {
  data: ArcDatum[];
  mapId?: string;
  /** Source id and layer-id prefix. Defaults to a generated id. */
  id?: string;
  /** How far arcs bow, as a fraction of their length. 0 draws straight lines. Defaults to 0.2. */
  curvature?: number;
  /** Points per arc. Defaults to 64. */
  samples?: number;
  /** Arc colour. Defaults to your --primary (or the theme accent). */
  color?: string;
  /** Width in pixels. Defaults to 2. */
  width?: number;
  /** Opacity, 0 to 1. Defaults to 0.85. */
  opacity?: number;
  /** Line paint merged over the defaults; values may be expressions over your datum fields. */
  paint?: Record<string, unknown>;
  /** Highlight and report the arc under the pointer. Defaults to true when a handler is passed. */
  interactive?: boolean;
  onClick?: (event: MapFeatureEvent) => void;
  onHover?: (event: MapFeatureEvent | null) => void;
  /** Insertion point. Default: below the labels. `null`: on top. */
  beforeId?: BeforeId;
}

function hovered(on: unknown, off: unknown): unknown[] {
  return ["case", ["boolean", ["feature-state", "hover"], false], on, off];
}

export function ArcLayer({
  data,
  mapId,
  id,
  curvature = 0.2,
  samples = 64,
  color,
  width = 2,
  opacity = 0.85,
  paint,
  interactive,
  onClick,
  onHover,
  beforeId,
}: ArcLayerProps) {
  const generated = `unmap-arcs-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const sourceId = id ?? generated;
  const lineId = `${sourceId}-line`;
  const active = interactive ?? (onClick !== undefined || onHover !== undefined);

  const collection = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: data.map(({ from, to, ...properties }) => ({
        type: "Feature" as const,
        properties,
        geometry: { type: "LineString" as const, coordinates: arcLine(from, to, curvature, samples) },
      })),
    }),
    [data, curvature, samples],
  );

  const { map } = useLayerSet({
    mapId,
    sourceId,
    source: { promoteId: "id" },
    data: collection,
    beforeId,
    key: JSON.stringify([color, width, opacity, paint]),
    layers: (live) => [
      {
        id: lineId,
        type: "line",
        source: sourceId,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": accentColor(live, color, themeMeta(live).marker?.color),
          "line-width": hovered(width + 1.5, width),
          "line-opacity": hovered(1, opacity),
          ...paint,
        },
      } as LayerSpec,
    ],
  });

  useLayerPointer({ map, layerIds: [lineId], enabled: active, hoverSource: sourceId, onClick, onHover });
  return null;
}
