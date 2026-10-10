"use client";

/**
 * <CompareSwipe> - two unmap maps in one frame, with a divider you swipe to reveal one over the
 * other: before and after, light and dark, one style against another.
 *
 * Both maps fill the frame and share one camera: pan, zoom, rotate or tilt either and the other
 * follows in the same frame. The `before` map shows left of the divider (above it when
 * `orientation="horizontal"`) and the `after` map right of it. The divider is a WAI-ARIA window
 * splitter: drag it, or focus it and use the arrow keys, Home and End.
 *
 * `before` and `after` take `<Map>`'s props for their side (style, mode, theme, overlays, lang),
 * and their `children` render inside that map, so a layer can sit on one side only: give it
 * `mapId="before"` or `mapId="after"` (or the ids you pass). The key, camera and camera limits are
 * shared. Each map loads its own style and tiles, and every tile is a request. Only the map holding
 * the top-right corner (the after map, or the before map when horizontal) shows zoom and compass
 * buttons, unless you give the other side its own `controls`.
 *
 * Limits:
 * - A pinch with one finger on each side of the divider is not supported: each map sees one
 *   finger and they pull against each other. Pinch on one side.
 * - Centre, zoom, bearing and pitch are synced; roll is not.
 * - Camera limits passed through one side's `maplibre` options (rather than the shared
 *   `maxBounds`, `minZoom` and `maxZoom`) apply to that side only, so the two cameras can diverge
 *   at the limit.
 *
 * Copied into your project by `npx shadcn add`. Edit freely.
 */

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import type { Map as MapInstance } from "@unmap/maps";
import { GripHorizontalIcon, GripVerticalIcon } from "lucide-react";
import { Map, type MapProps } from "@/components/ui/map";
import { useMap } from "@/lib/map-context";
import { cn } from "@/lib/utils";

// --- compare helpers (kept identical across both lanes) ---

/** `vertical`: a divider line you move left and right. `horizontal`: one you move up and down. */
export type CompareOrientation = "vertical" | "horizontal";

export const COMPARE_COPY = {
  en: { divider: "Swipe between the maps", value: (percent: number) => `${percent}%` },
  // French sets a no-break space before the percent sign.
  fr: { divider: "Glisser entre les cartes", value: (percent: number) => `${percent}\u00a0%` },
} as const;

/** The divider's hit area and its drawn line, per orientation. */
export const COMPARE_DIVIDER = {
  vertical: {
    handle: "inset-y-0 w-6 -translate-x-1/2 cursor-ew-resize",
    line: "inset-y-0 left-1/2 w-0.5 -translate-x-1/2",
  },
  horizontal: {
    handle: "inset-x-0 h-6 -translate-y-1/2 cursor-ns-resize",
    line: "inset-x-0 top-1/2 h-0.5 -translate-y-1/2",
  },
} as const;

/** A position as a percentage of the frame, clamped to 0..100; `fallback` when it is not a finite number. */
export function clampPosition(value: number, fallback = 50): number {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : fallback;
}

/** Where a pointer puts the divider, as a percentage of the frame; null while the frame has no size. */
export function positionAt(
  rect: { left: number; top: number; width: number; height: number },
  pointer: { clientX: number; clientY: number },
  orientation: CompareOrientation,
): number | null {
  const span = orientation === "vertical" ? rect.width : rect.height;
  if (!(span > 0)) return null;
  const offset = orientation === "vertical" ? pointer.clientX - rect.left : pointer.clientY - rect.top;
  return clampPosition((offset / span) * 100);
}

/** Where a key moves the divider (the WAI-ARIA window splitter keys), or null for a key it leaves alone. */
export function positionForKey(key: string, position: number, orientation: CompareOrientation, step: number): number | null {
  const back = orientation === "vertical" ? "ArrowLeft" : "ArrowUp";
  const forward = orientation === "vertical" ? "ArrowRight" : "ArrowDown";
  if (key === back) return clampPosition(position - step);
  if (key === forward) return clampPosition(position + step);
  if (key === "Home") return 0;
  if (key === "End") return 100;
  return null;
}

/** The clip that shows the after map only beyond the divider. A clip also stops its pointer events. */
export function afterClip(position: number, orientation: CompareOrientation): string {
  return orientation === "vertical" ? `inset(0 0 0 ${position}%)` : `inset(${position}% 0 0 0)`;
}

/** Where the divider sits, as an inline style. */
export function dividerStyle(position: number, orientation: CompareOrientation): { left: string } | { top: string } {
  return orientation === "vertical" ? { left: `${position}%` } : { top: `${position}%` };
}

/** The camera calls the sync needs. */
export type CameraMap = Pick<MapInstance, "on" | "off" | "jumpTo" | "stop" | "getCenter" | "getZoom" | "getBearing" | "getPitch">;

/** The events that start a gesture on a map: each stops the other map's ease or inertia. */
const GESTURE_STARTS = ["mousedown", "touchstart", "wheel"] as const;

/**
 * Keep two maps on one camera from now on. A move on either jumps the other to it; that jump
 * fires the other's own `move`, which the `syncing` flag drops, so a move never echoes back. The
 * follower is lined up with the leader at once. Returns the unsubscribe.
 *
 * MapLibre's `jumpTo` stops every gesture on the map it moves. So a gesture starting on one map
 * first stops the other: otherwise the other's inertia would keep jumping this one and drop the
 * grab (or cut the wheel zoom) the reader just started.
 */
export function syncCameras(leader: CameraMap, follower: CameraMap): () => void {
  let syncing = false;
  const copy = (source: CameraMap, target: CameraMap) => () => {
    if (syncing) return;
    syncing = true;
    try {
      const { lng, lat } = source.getCenter();
      target.jumpTo({ center: [lng, lat], zoom: source.getZoom(), bearing: source.getBearing(), pitch: source.getPitch() });
    } finally {
      syncing = false;
    }
  };
  const fromLeader = copy(leader, follower);
  const fromFollower = copy(follower, leader);
  const stopFollower = () => follower.stop();
  const stopLeader = () => leader.stop();
  leader.on("move", fromLeader);
  follower.on("move", fromFollower);
  for (const type of GESTURE_STARTS) {
    leader.on(type, stopFollower);
    follower.on(type, stopLeader);
  }
  fromLeader();
  return () => {
    leader.off("move", fromLeader);
    follower.off("move", fromFollower);
    for (const type of GESTURE_STARTS) {
      leader.off(type, stopFollower);
      follower.off(type, stopLeader);
    }
  };
}

// --- end compare helpers ---

/**
 * What one side shows: `<Map>`'s props, minus what both sides share (key, gateway, camera, camera
 * limits, hash, id, class and style). Its `children` render inside that side's map.
 */
export type CompareSide = Omit<
  MapProps,
  | "apiKey"
  | "gateway"
  | "id"
  | "center"
  | "zoom"
  | "bearing"
  | "pitch"
  | "onViewportChange"
  | "hash"
  | "maxBounds"
  | "minZoom"
  | "maxZoom"
  | "className"
  | "containerStyle"
>;

export interface CompareSwipeProps {
  /** unmap API key (`um_live_...` / `um_test_...`), for both maps. */
  apiKey: string;
  /** Gateway base URL. Defaults to the unmap production gateway. */
  gateway?: string;
  /** The map left of (or above) the divider. */
  before?: CompareSide;
  /** The map right of (or below) the divider. */
  after?: CompareSide;
  /** Map id of the before map, for a layer on that side only. Defaults to "before". */
  beforeId?: string;
  /** Map id of the after map. Defaults to "after". */
  afterId?: string;
  /** Centre as [longitude, latitude], for both maps. Changes move the camera in place. */
  center?: [number, number];
  zoom?: number;
  bearing?: number;
  pitch?: number;
  maxBounds?: MapProps["maxBounds"];
  minZoom?: number;
  maxZoom?: number;
  /** Fires once per camera move, whichever map the reader moved. */
  onViewportChange?: MapProps["onViewportChange"];
  /** Divider position in percent of the frame, controlled. Pair with `onPositionChange`. */
  position?: number;
  /** Divider position to start from, uncontrolled. Defaults to 50. */
  defaultPosition?: number;
  /** Fires with each new divider position. */
  onPositionChange?: (position: number) => void;
  /** `"vertical"` (the default): swipe left and right. `"horizontal"`: up and down. */
  orientation?: CompareOrientation;
  /** Percent per arrow-key press. Defaults to 5. */
  step?: number;
  /** Divider label language. Defaults to "en". */
  lang?: "en" | "fr";
  /** Layout classes for the frame (its height, say). */
  className?: string;
  /**
   * Inline styles for the frame. It keeps a 320px minimum height unless this sets `minHeight`;
   * the maps fill the frame, however short.
   */
  containerStyle?: CSSProperties;
}

/** Hands the map with `mapId` up to the comparison. Rendered inside that map, where `useMap` sees it. */
function MapBridge({ mapId, onMap }: { mapId: string; onMap: (map: MapInstance | null) => void }) {
  const map = useMap(mapId);
  useEffect(() => {
    onMap(map);
  }, [map, onMap]);
  return null;
}

export function CompareSwipe({
  apiKey,
  gateway,
  before,
  after,
  beforeId = "before",
  afterId = "after",
  center,
  zoom,
  bearing,
  pitch,
  maxBounds,
  minZoom,
  maxZoom,
  onViewportChange,
  position,
  defaultPosition = 50,
  onPositionChange,
  orientation = "vertical",
  step = 5,
  lang = "en",
  className,
  containerStyle,
}: CompareSwipeProps) {
  // The before map starts from the camera props and then follows the after map, which alone takes
  // them: its MapProvider recognises a controlled parent's echo, while the before map never
  // reports, so a late echo would jump it back in the middle of a gesture.
  const [initial] = useState(() => ({ center, zoom, bearing, pitch }));
  const [beforeMap, setBeforeMap] = useState<MapInstance | null>(null);
  const [afterMap, setAfterMap] = useState<MapInstance | null>(null);
  const [inner, setInner] = useState(() => clampPosition(defaultPosition));
  const shown = position === undefined ? inner : clampPosition(position, inner);
  const frame = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const beforePane = useId();
  const onPositionChangeRef = useRef(onPositionChange);
  onPositionChangeRef.current = onPositionChange;

  useEffect(() => {
    if (!beforeMap || !afterMap) return;
    return syncCameras(afterMap, beforeMap);
  }, [beforeMap, afterMap]);

  const move = (next: number) => {
    if (next === shown) return;
    if (position === undefined) setInner(next);
    onPositionChangeRef.current?.(next);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || !frame.current) return;
    const next = positionAt(frame.current.getBoundingClientRect(), event, orientation);
    if (next !== null) move(next);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = positionForKey(event.key, shown, orientation, step);
    if (next === null) return;
    event.preventDefault();
    move(next);
  };

  const { children: beforeChildren, ...beforeProps } = before ?? {};
  const { children: afterChildren, ...afterProps } = after ?? {};
  // The frame sets the height, so each map drops its own 320px floor and fills it.
  const shared = { apiKey, gateway, maxBounds, minZoom, maxZoom, containerStyle: { minHeight: 0 } };
  const vertical = orientation === "vertical";
  // One control stack: that of the map holding the top-right corner, where the buttons sit (the
  // after map when vertical, the before map when horizontal). A side's own `controls` wins.
  const Grip = vertical ? GripVerticalIcon : GripHorizontalIcon;

  return (
    <div
      ref={frame}
      data-unmap-compare=""
      data-orientation={orientation}
      className={cn("relative h-full w-full overflow-hidden rounded-lg", className)}
      style={{ minHeight: 320, ...containerStyle }}
    >
      <div id={beforePane} className="absolute inset-0 isolate" data-unmap-compare-before="">
        <Map
          {...beforeProps}
          {...shared}
          {...initial}
          controls={beforeProps.controls ?? (vertical ? false : undefined)}
          id={beforeId}
        >
          {beforeChildren}
          <MapBridge mapId={beforeId} onMap={setBeforeMap} />
        </Map>
      </div>
      <div
        className="absolute inset-0 isolate"
        data-unmap-compare-after=""
        style={{ clipPath: afterClip(shown, orientation) }}
      >
        <Map
          {...afterProps}
          {...shared}
          controls={afterProps.controls ?? (vertical ? undefined : false)}
          center={center}
          zoom={zoom}
          bearing={bearing}
          pitch={pitch}
          onViewportChange={onViewportChange}
          id={afterId}
        >
          {afterChildren}
          <MapBridge mapId={afterId} onMap={setAfterMap} />
        </Map>
      </div>
      {/* A documented exception to the shadcn-primitives rule: shadcn has no splitter that floats
          over two stacked layers (its Resizable lays panels side by side), so the divider is a
          plain element drawn only from your tokens (`--background`, `--border`, `--ring`). */}
      <div
        role="separator"
        tabIndex={0}
        aria-label={COMPARE_COPY[lang].divider}
        aria-orientation={orientation}
        aria-valuenow={Math.round(shown)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={COMPARE_COPY[lang].value(Math.round(shown))}
        aria-controls={beforePane}
        data-unmap-compare-divider=""
        className={cn(
          "absolute z-[5] flex touch-none items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-ring",
          COMPARE_DIVIDER[orientation].handle,
        )}
        style={dividerStyle(shown, orientation)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <span aria-hidden="true" className={cn("absolute bg-background", COMPARE_DIVIDER[orientation].line)} />
        <span
          aria-hidden="true"
          className="relative flex size-6 items-center justify-center rounded-md border border-border bg-background text-foreground"
        >
          <Grip className="size-4" />
        </span>
      </div>
    </div>
  );
}
