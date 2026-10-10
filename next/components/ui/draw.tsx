"use client";

/**
 * <Draw> - draw points, lines, polygons and circles on an unmap map, then select, move, reshape
 * and delete them.
 *
 * The drawing is terra-draw (terra-draw.io) on its MapLibre adapter. The toolbar is your shadcn
 * ToggleGroup, Button and Tooltip, so it takes your radius, palette and focus ring. What is drawn
 * arrives as a GeoJSON FeatureCollection through `onValueChange`; pass `value` to control it, or
 * `defaultValue` to start from some shapes. Each shape keeps `properties.mode`, the tool that drew
 * it, which terra-draw needs to edit it again. Shapes take your `--primary`, outlined in
 * `--background`, and sit above the map's labels so their handles stay in reach.
 *
 * Keys work while the map canvas has focus (click the map first). While drawing, Escape cancels
 * the shape in progress and Enter finishes a line, polygon or circle. With the select tool,
 * Escape deselects and Delete or Backspace removes the selected shape.
 *
 * A change of mode, style or theme swaps the style, which removes every layer: the drawing is
 * rebuilt on the new style with every finished shape and the same tool. A shape still being
 * drawn at that moment is dropped, and panning and rotating come back as the page had them.
 * Drawing makes no requests.
 *
 * Copied into your project by `npx shadcn add`. Edit freely.
 */

import { useEffect, useRef, useState } from "react";
import type { Map } from "@unmap/maps";
import {
  TerraDraw,
  TerraDrawCircleMode,
  TerraDrawLineStringMode,
  TerraDrawPointMode,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
  type GeoJSONStoreFeatures,
} from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import { CircleIcon, MapPinIcon, MousePointer2Icon, PentagonIcon, SplineIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMap, useMapGeneration, useMapReady } from "@/lib/map-context";
import { HELPER_KEY, accentColor, themeMeta, tokenColor, type LayerSpec } from "@/lib/map-layers";
import { cn } from "@/lib/utils";

// --- draw helpers (kept identical across both lanes) ---

/** A drawing tool, named as terra-draw names its modes. Every shape carries it as `properties.mode`. */
export type DrawMode = "point" | "linestring" | "polygon" | "circle";

/** A toolbar tool: a drawing mode, or `select` to pick, move, reshape and delete. */
export type DrawTool = DrawMode | "select";

/** The corner the toolbar sits in. */
export type DrawPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

/** One shape. A circle is a Polygon with `properties.mode: "circle"` and `radiusKilometers`. */
export interface DrawFeature {
  type: "Feature";
  id?: string | number;
  geometry:
    | { type: "Point"; coordinates: number[] }
    | { type: "LineString"; coordinates: number[][] }
    | { type: "Polygon"; coordinates: number[][][] };
  properties: { mode?: DrawMode; [key: string]: unknown };
}

/** Every finished shape, as a GeoJSON FeatureCollection. */
export interface DrawValue {
  type: "FeatureCollection";
  features: DrawFeature[];
}

/** The drawing tools, in toolbar order. */
export const DRAW_MODES: DrawMode[] = ["point", "linestring", "polygon", "circle"];

export const EMPTY_DRAWING: DrawValue = { type: "FeatureCollection", features: [] };

export const DRAW_COPY = {
  en: {
    toolbar: "Drawing tools",
    select: "Select and edit",
    point: "Point",
    linestring: "Line",
    polygon: "Polygon",
    circle: "Circle",
    delete: "Delete selected shape",
  },
  fr: {
    toolbar: "Outils de dessin",
    select: "Sélectionner et modifier",
    point: "Point",
    linestring: "Ligne",
    polygon: "Polygone",
    circle: "Cercle",
    delete: "Supprimer la forme sélectionnée",
  },
} as const;

/** Layout per corner, on MapLibre's 10px control margin. Bottom-right clears the attribution. */
export const DRAW_CORNERS: Record<DrawPosition, string> = {
  "top-left": "top-2.5 left-2.5",
  "top-right": "top-2.5 right-2.5",
  "bottom-left": "bottom-2.5 left-2.5",
  "bottom-right": "bottom-10 right-2.5",
};

/** Toggle items and ghost buttons are transparent, so each toolbar group brings its own surface over the map. */
export const DRAW_SURFACE = "w-fit rounded-lg border bg-background p-0.5 shadow-sm";

/** The outline colour when `--background` is unset or invalid. */
export const FALLBACK_OUTLINE = "#ffffff";

/** terra-draw's bookkeeping on a shape: selection, vertices, guides. Never part of the value. */
const RESERVED = [
  "selected",
  "midPoint",
  "selectionPoint",
  "selectionPointFeatureId",
  "currentlyDrawing",
  "edited",
  "closingPoint",
  "snappingPoint",
  "coordinatePoint",
  "coordinatePointFeatureId",
  "coordinatePointIds",
  "provisionalCoordinateCount",
  "committedCoordinateCount",
  "marker",
];

/** A feature carrying one of these is a guide (a vertex handle, a midpoint, a closing or snapping point), not a shape. */
const GUIDES = ["midPoint", "selectionPoint", "coordinatePoint", "snappingPoint", "closingPoint"];

const MODE_OF_GEOMETRY: Record<string, DrawMode> = { Point: "point", LineString: "linestring", Polygon: "polygon" };

/**
 * Coordinates as terra-draw's store takes them. It rejects a position that is not exactly
 * [lng, lat], so a third or fourth value (elevation and time from GPS or KML) is dropped, and a
 * coordinate with more than 9 decimals, so each is rounded the way it rounds its own. Works at any
 * depth: a Point's position, a LineString's positions, a Polygon's rings.
 */
function storeCoordinates(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  if (typeof value[0] !== "number") return value.map(storeCoordinates);
  return value.slice(0, 2).map((entry: unknown) => (typeof entry === "number" ? Math.round(entry * 1e9) / 1e9 : entry));
}

/**
 * A value as terra-draw's store takes it: a mode inferred from the geometry when none is given,
 * every position trimmed to [lng, lat] and rounded to 9 decimals, terra-draw's own bookkeeping
 * dropped, ids kept.
 */
export function toStoreFeatures(value: DrawValue | undefined): GeoJSONStoreFeatures[] {
  return (value?.features ?? []).map((feature) => {
    const properties: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(feature.properties ?? {})) {
      if (!RESERVED.includes(key)) properties[key] = entry;
    }
    const inferred: DrawMode | undefined = feature.geometry ? MODE_OF_GEOMETRY[feature.geometry.type] : undefined;
    if (typeof properties.mode !== "string" && inferred) properties.mode = inferred;
    const geometry = feature.geometry
      ? { ...feature.geometry, coordinates: storeCoordinates(feature.geometry.coordinates) }
      : feature.geometry;
    return {
      type: "Feature",
      ...(feature.id !== undefined ? { id: feature.id } : {}),
      geometry,
      properties,
    } as unknown as GeoJSONStoreFeatures;
  });
}

/** The finished shapes in a terra-draw snapshot: no guides, no half-drawn shape, no bookkeeping. */
export function fromSnapshot(snapshot: GeoJSONStoreFeatures[]): DrawValue {
  const features: DrawFeature[] = [];
  for (const feature of snapshot) {
    const properties = (feature.properties ?? {}) as Record<string, unknown>;
    if (properties.currentlyDrawing || GUIDES.some((key) => properties[key])) continue;
    const kept: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(properties)) {
      if (!RESERVED.includes(key)) kept[key] = entry;
    }
    features.push({
      type: "Feature",
      id: feature.id as string | number,
      geometry: feature.geometry as DrawFeature["geometry"],
      properties: kept,
    });
  }
  return { type: "FeatureCollection", features };
}

/** JSON with every object's keys sorted, at every depth, so key order never changes the text. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .filter((key) => record[key] !== undefined && typeof record[key] !== "function")
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * Identifies a value's content, so an echo or an unchanged value is recognised. Key order does
 * not count: a parent that round-trips the value through a schema or a database that writes keys
 * in its own order is still echoing it.
 */
export function valueKey(value: DrawValue | undefined): string {
  return stableJson(value?.features ?? []);
}

/** Put a value's shapes into a started drawing. A shape terra-draw cannot hold is skipped with a warning. */
export function loadShapes(draw: TerraDraw, value: DrawValue | undefined): void {
  for (const result of draw.addFeatures(toStoreFeatures(value))) {
    if (!result.valid) {
      console.warn(`unmap: draw skipped a shape (${String(result.id ?? "no id")}): ${result.reason ?? "invalid"}`);
    }
  }
}

/**
 * The map as terra-draw's adapter sees it. A style swap removes the adapter's sources and layers
 * under it; the adapter then calls `getSource(id).setData` on a source that is gone (a TypeError,
 * from a render frame or from `stop()`), and removes layers and sources that are gone (MapLibre
 * throws on a missing source). This skips exactly those calls, and every call once the map fired
 * `remove`. It also marks each layer the adapter adds as a tool's own (`HELPER_KEY` metadata), so
 * the feature inspector and the time slider leave the drawing alone. Everything else is the map
 * itself.
 */
export function drawSafeMap(map: Map, removed: () => boolean): Map {
  const exists = (read: () => unknown) => {
    if (removed()) return false;
    try {
      return Boolean(read());
    } catch {
      return false;
    }
  };
  const detached = { setData() {} };
  return new Proxy(map, {
    get(target, property) {
      if (property === "getSource") {
        return (id: string) => (exists(() => target.getSource(id)) ? target.getSource(id) : detached);
      }
      if (property === "addLayer") {
        return (layer: LayerSpec, beforeId?: string) => {
          const style = layer as LayerSpec & { metadata?: object };
          return target.addLayer({ ...style, metadata: { ...style.metadata, [HELPER_KEY]: true } } as LayerSpec, beforeId);
        };
      }
      if (property === "removeLayer") {
        return (id: string) => {
          if (exists(() => target.getLayer(id))) target.removeLayer(id);
          return target;
        };
      }
      if (property === "removeSource") {
        return (id: string) => {
          if (exists(() => target.getSource(id))) target.removeSource(id);
          return target;
        };
      }
      const value: unknown = Reflect.get(target, property, target);
      return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(target) : value;
    },
  });
}

/**
 * A terra-draw instance on `map` with the five tools, its sources and layers prefixed with `id`.
 * terra-draw types colours as `#rrggbb` but hands them to MapLibre paint as they are, so any CSS
 * colour MapLibre reads works.
 */
export function createDraw(map: Map, id: string, primary: string, outline: string): TerraDraw {
  const fill = primary as `#${string}`;
  const edge = outline as `#${string}`;
  const handles = { closingPointColor: fill, closingPointWidth: 5, closingPointOutlineColor: edge, closingPointOutlineWidth: 2 };
  const area = { fillColor: fill, fillOpacity: 0.2, outlineColor: fill, outlineWidth: 2 };
  const editable = { draggable: true, coordinates: { midpoints: true, draggable: true, deletable: true } };
  let issued = 0;
  return new TerraDraw({
    adapter: new TerraDrawMapLibreGLAdapter({ map, prefixId: id }),
    // terra-draw's default accepts only 36-character UUIDs; your own ids (numbers, slugs) load too.
    idStrategy: {
      isValidId: (candidate) =>
        (typeof candidate === "string" && candidate.length > 0) || (typeof candidate === "number" && Number.isFinite(candidate)),
      getId: () =>
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${id}-${Date.now().toString(36)}-${(issued += 1)}`,
    },
    modes: [
      new TerraDrawSelectMode({
        flags: {
          point: { feature: { draggable: true } },
          linestring: { feature: editable },
          polygon: { feature: editable },
          circle: { feature: { draggable: true, coordinates: { resizable: "center-fixed" } } },
        },
        styles: {
          selectedPointColor: fill,
          selectedPointWidth: 7,
          selectedPointOutlineColor: edge,
          selectedPointOutlineWidth: 2,
          selectedLineStringColor: fill,
          selectedLineStringWidth: 4,
          selectedPolygonColor: fill,
          selectedPolygonFillOpacity: 0.35,
          selectedPolygonOutlineColor: fill,
          selectedPolygonOutlineWidth: 3,
          selectionPointColor: edge,
          selectionPointWidth: 5,
          selectionPointOutlineColor: fill,
          selectionPointOutlineWidth: 2,
          midPointColor: fill,
          midPointWidth: 4,
          midPointOutlineColor: edge,
          midPointOutlineWidth: 2,
        },
      }),
      new TerraDrawPointMode({ styles: { pointColor: fill, pointWidth: 6, pointOutlineColor: edge, pointOutlineWidth: 2 } }),
      new TerraDrawLineStringMode({ styles: { lineStringColor: fill, lineStringWidth: 3, ...handles } }),
      new TerraDrawPolygonMode({ styles: { ...area, ...handles } }),
      new TerraDrawCircleMode({ styles: area }),
    ],
  });
}

// --- end draw helpers ---

const ICONS = {
  select: MousePointer2Icon,
  point: MapPinIcon,
  linestring: SplineIcon,
  polygon: PentagonIcon,
  circle: CircleIcon,
};

export interface DrawProps {
  /** Map id when multiple maps share a page. Defaults to "default". */
  mapId?: string;
  /** Prefix of the sources and layers the drawing adds. Give each `<Draw>` on one map its own. Defaults to "unmap-draw". */
  id?: string;
  /** The drawing tools the toolbar offers. Select and delete are always there. Defaults to all four. */
  modes?: DrawMode[];
  /**
   * The shapes, controlled. Pair with `onValueChange`. It is semi-controlled: a new `value` whose
   * content differs from what the drawing last reported replaces the shapes, but a parent that
   * rejects a change by leaving `value` as it was (the same object) does not snap the drawing
   * back. To undo a change, pass a new object.
   */
  value?: DrawValue;
  /** The shapes to start with, uncontrolled. */
  defaultValue?: DrawValue;
  /**
   * Fires on every change to the finished shapes: when a shape is finished or deleted, and live,
   * on every step, while a shape is dragged or its vertices are edited, not only when the drag
   * ends. Selecting does not fire it. Debounce it yourself before anything expensive, such as a save.
   */
  onValueChange?: (value: DrawValue) => void;
  /** Shape colour. Defaults to your `--primary` (or the theme's accent under `accent="theme"`). */
  color?: string;
  /** The corner the toolbar sits in. Defaults to "top-left". */
  position?: DrawPosition;
  /** Toolbar language. Defaults to "en". */
  lang?: "en" | "fr";
  className?: string;
}

export function Draw({
  mapId,
  id = "unmap-draw",
  modes = DRAW_MODES,
  value,
  defaultValue,
  onValueChange,
  color,
  position = "top-left",
  lang = "en",
  className,
}: DrawProps) {
  const map = useMap(mapId);
  const ready = useMapReady(mapId);
  const generation = useMapGeneration(mapId);
  const copy = DRAW_COPY[lang];
  const [tool, setTool] = useState<DrawTool | null>(null);
  const [selected, setSelected] = useState<string | number | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  // The finished shapes: what a rebuild after a style swap puts back.
  const shapes = useRef<DrawValue>(value ?? defaultValue ?? EMPTY_DRAWING);
  // `inputKey`: the value the parent last gave or was last told, so its echo is not applied again.
  // `storeKey`: what the drawing holds, so a change that leaves the shapes as they were (a
  // selection) is not reported. They differ when terra-draw gave id-less shapes their ids.
  const inputKey = useRef(valueKey(shapes.current));
  const storeKey = useRef(inputKey.current);
  const applying = useRef(false);
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;
  // Panning and rotating as the page had them before the first build. terra-draw turns them off
  // for a drag and back on when it ends; a style swap or unmount mid-drag skips the second half,
  // and the next build would take "off" as how the page wants them.
  const gestures = useRef<{ map: Map; pan: boolean; rotate: boolean } | null>(null);

  // One terra-draw per style: a swap removes its layers, so it is rebuilt on the new one.
  useEffect(() => {
    if (!map || !ready || !map.getStyle()) return;
    let removed = false;
    const onRemove = () => {
      removed = true;
    };
    map.on("remove", onRemove);
    if (gestures.current?.map !== map) {
      gestures.current = { map, pan: map.dragPan.isEnabled(), rotate: map.dragRotate.isEnabled() };
    }
    const initial = gestures.current;
    const restoreGestures = () => {
      if (initial.pan) map.dragPan.enable();
      if (initial.rotate) map.dragRotate.enable();
    };
    // Before the adapter is built: it records these as the state to return to after a drag.
    restoreGestures();
    const primary = accentColor(map, color, themeMeta(map).route?.color);
    const outline = tokenColor(map, "--background") ?? FALLBACK_OUTLINE;
    const draw = createDraw(drawSafeMap(map, () => removed), id, primary, outline);
    draw.start();
    applying.current = true;
    try {
      loadShapes(draw, shapes.current);
      shapes.current = fromSnapshot(draw.getSnapshot());
      storeKey.current = valueKey(shapes.current);
    } finally {
      applying.current = false;
    }
    if (toolRef.current) draw.setMode(toolRef.current);
    const onChange = () => {
      if (applying.current) return;
      const next = fromSnapshot(draw.getSnapshot());
      const key = valueKey(next);
      if (key === storeKey.current) return;
      storeKey.current = key;
      inputKey.current = key;
      shapes.current = next;
      onValueChangeRef.current?.(next);
    };
    const onSelect = (featureId: string | number) => setSelected(featureId);
    const onDeselect = () => setSelected(null);
    draw.on("change", onChange);
    draw.on("select", onSelect);
    draw.on("deselect", onDeselect);
    // terra-draw binds Delete; a Mac laptop has no Delete key, so Backspace removes the selection too.
    const canvas = map.getCanvas();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Backspace" || toolRef.current !== "select") return;
      const chosen = draw.getSnapshot().find((feature) => feature.properties?.selected === true);
      if (!chosen || chosen.id === undefined) return;
      event.preventDefault();
      draw.removeFeatures([chosen.id]);
    };
    canvas.addEventListener("keydown", onKeyDown);
    drawRef.current = draw;
    return () => {
      canvas.removeEventListener("keydown", onKeyDown);
      draw.off("change", onChange);
      draw.off("select", onSelect);
      draw.off("deselect", onDeselect);
      map.off("remove", onRemove);
      if (drawRef.current === draw) drawRef.current = null;
      setSelected(null);
      // No tool first: the tool resets the cursor and drops a half-drawn shape.
      draw.setMode("static");
      draw.stop();
      if (!removed) restoreGestures();
    };
  }, [map, ready, generation, id, color]);

  // A controlled value that differs from what the parent last gave or was told replaces the shapes.
  useEffect(() => {
    if (value === undefined) return;
    const key = valueKey(value);
    if (key === inputKey.current) return;
    inputKey.current = key;
    shapes.current = value;
    const draw = drawRef.current;
    if (!draw) return; // the next build loads it
    applying.current = true;
    try {
      draw.clear();
      loadShapes(draw, value);
      shapes.current = fromSnapshot(draw.getSnapshot());
      storeKey.current = valueKey(shapes.current);
    } finally {
      applying.current = false;
    }
  }, [value]);

  const tools: DrawTool[] = ["select", ...DRAW_MODES.filter((mode) => modes.includes(mode))];
  const busy = !map || !ready;
  const side = position.endsWith("right") ? "left" : "right";

  const choose = (next: DrawTool | null) => {
    setTool(next);
    const draw = drawRef.current;
    if (draw?.enabled) draw.setMode(next ?? "static");
  };

  const remove = () => {
    const draw = drawRef.current;
    if (!draw || selected === null || !draw.hasFeature(selected)) return;
    draw.removeFeatures([selected]);
  };

  return (
    <TooltipProvider>
      <div data-unmap-draw="" className={cn("absolute z-[5] flex flex-col gap-2", DRAW_CORNERS[position], className)}>
        <div className={DRAW_SURFACE}>
          <ToggleGroup
            aria-label={copy.toolbar}
            orientation="vertical"
            value={tool ? [tool] : []}
            onValueChange={(next: unknown[]) => {
              const picked = next[0];
              choose(typeof picked === "string" && (tools as string[]).includes(picked) ? (picked as DrawTool) : null);
            }}
          >
            {tools.map((name) => {
              const Icon = ICONS[name];
              return (
                <Tooltip key={name}>
                  <TooltipTrigger
                    render={
                      <ToggleGroupItem value={name} aria-label={copy[name]} disabled={busy}>
                        <Icon />
                      </ToggleGroupItem>
                    }
                  />
                  <TooltipContent side={side}>{copy[name]}</TooltipContent>
                </Tooltip>
              );
            })}
          </ToggleGroup>
        </div>
        <div className={DRAW_SURFACE}>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={copy.delete}
                  disabled={busy || selected === null}
                  onClick={remove}
                >
                  <Trash2Icon />
                </Button>
              }
            />
            <TooltipContent side={side}>{copy.delete}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
