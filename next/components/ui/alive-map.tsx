"use client";

/**
 * The alive-route-explorer block on the map: the walks as layers (the shown one in your --primary
 * over a --card casing, drawing itself in; the fastest dashed in your --muted-foreground; another
 * walk only while its row is hovered), the camera, and the HTML pinned to the map: the start and
 * destination with their names, a time bubble beside each walk, and up to three highlight cards
 * placed so they cover neither the walks, the panel nor each other. Each renders inside <Map>,
 * where useMap() can see it. Installed beside the block. Edit freely.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Coffee, Landmark, Trees, type LucideIcon } from "lucide-react";
import { EndPin, Illustration, StartDot } from "@/components/ui/alive-illustrations";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { LngLat } from "@/lib/alive-signals";
import {
  ALIVE_COPY,
  ALIVE_MAP_ID,
  CAMERA_MS,
  DRAW_MS,
  apexOf,
  boundsOf,
  densify,
  highlightCards,
  pictureFor,
  placeName,
  placeBox,
  placeCard,
  prefersReducedMotion,
  TAIL_INSET,
  type AliveLang,
  type AlivePictures,
  type HighlightCard,
  type Point,
  type RankedWalk,
  type Rect,
  type Side,
} from "@/lib/alive-view";
import { useMap, useMapReady } from "@/lib/map-context";
import { accentColor, tokenColor, useLayerPointer, useLayerSet, type LayerSpec } from "@/lib/map-layers";

const ROUTES_SOURCE = "alive-routes";
const SHOWN_SOURCE = "alive-shown";
const ROUTES_HIT = "alive-routes-hit";
const SHOWN_LINE = "alive-shown-line";

/** The shown walk drawn up to `t` (0-1) of its length, for line-gradient. */
type LineGradient = NonNullable<NonNullable<Extract<LayerSpec, { type: "line" }>["paint"]>["line-gradient"]>;
const drawnTo = (colour: string, t: number): LineGradient => ["step", ["line-progress"], colour, Math.min(Math.max(t, 0.0001), 1.01), "rgba(0, 0, 0, 0)"];

export function AliveLayers(props: {
  rows: RankedWalk[];
  shownId: string | null;
  fastestId: string | null;
  /** A walk whose row is under the pointer: drawn faint while it is. */
  hoveredId: string | null;
  onSelect: (id: string) => void;
}) {
  const { rows, shownId, fastestId, hoveredId } = props;
  const routes = useMemo(
    () => ({
      type: "FeatureCollection",
      features: rows
        .filter((row) => row.id !== shownId && (row.id === fastestId || row.id === hoveredId))
        .map((row) => ({
          type: "Feature",
          properties: { id: row.id, role: row.id === fastestId ? "fastest" : "other" },
          geometry: { type: "LineString", coordinates: row.coords },
        })),
    }),
    [rows, shownId, fastestId, hoveredId],
  );
  const shownRow = rows.find((row) => row.id === shownId);
  const shownLine = useMemo(
    () => ({
      type: "FeatureCollection",
      features: shownRow ? [{ type: "Feature", properties: { id: shownRow.id }, geometry: { type: "LineString", coordinates: shownRow.coords } }] : [],
    }),
    [shownRow],
  );

  const { map, ready } = useLayerSet({
    mapId: ALIVE_MAP_ID,
    sourceId: ROUTES_SOURCE,
    data: routes,
    layers: (live): LayerSpec[] => {
      const muted = tokenColor(live, "--muted-foreground") ?? accentColor(live, undefined, undefined);
      const round = { "line-cap": "round", "line-join": "round" } as const;
      return [
        { id: "alive-routes-other", type: "line", source: ROUTES_SOURCE, filter: ["==", ["get", "role"], "other"], layout: round, paint: { "line-color": muted, "line-width": 5, "line-opacity": 0.55 } },
        { id: "alive-routes-fastest", type: "line", source: ROUTES_SOURCE, filter: ["==", ["get", "role"], "fastest"], layout: round, paint: { "line-color": muted, "line-width": 5, "line-dasharray": [1.4, 1.6] } },
        { id: ROUTES_HIT, type: "line", source: ROUTES_SOURCE, paint: { "line-color": muted, "line-width": 18, "line-opacity": 0 } },
      ];
    },
  });
  useLayerSet({
    mapId: ALIVE_MAP_ID,
    sourceId: SHOWN_SOURCE,
    source: { lineMetrics: true },
    data: shownLine,
    layers: (live): LayerSpec[] => {
      const primary = accentColor(live, undefined, undefined);
      // --card, so the casing stays visible on a dark map as on a light one.
      const casing = tokenColor(live, "--card") ?? tokenColor(live, "--background") ?? "white";
      return [
        { id: "alive-shown-casing", type: "line", source: SHOWN_SOURCE, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": casing, "line-width": 12 } },
        { id: SHOWN_LINE, type: "line", source: SHOWN_SOURCE, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-width": 8, "line-gradient": drawnTo(primary, 1) } },
      ];
    },
  });
  useLayerPointer({
    map,
    layerIds: [ROUTES_HIT],
    enabled: ready,
    onClick: (event) => {
      const id = event.feature.properties.id;
      if (typeof id === "string") props.onSelect(id);
    },
  });

  // The one orchestrated moment: a newly shown walk draws itself from start to finish.
  const drawKey = shownRow ? `${shownRow.id}:${shownRow.coords.length}` : "";
  useEffect(() => {
    if (!map || !ready || !drawKey || !map.getLayer(SHOWN_LINE)) return;
    const primary = accentColor(map, undefined, undefined);
    if (prefersReducedMotion() || typeof requestAnimationFrame === "undefined") {
      map.setPaintProperty(SHOWN_LINE, "line-gradient", drawnTo(primary, 1));
      return;
    }
    let frame = 0;
    const started = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - started) / DRAW_MS, 1);
      if (!map.getLayer(SHOWN_LINE)) return;
      map.setPaintProperty(SHOWN_LINE, "line-gradient", drawnTo(primary, 1 - (1 - t) ** 3));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      if (map.getLayer(SHOWN_LINE)) map.setPaintProperty(SHOWN_LINE, "line-gradient", drawnTo(primary, 1));
    };
  }, [map, ready, drawKey]);
  return null;
}

/**
 * Frames the endpoints, then the walks once they arrive, into the area right of the panel (above
 * the sheet on a phone), with room above and around for the cards and bubbles.
 */
export function AliveCamera({
  frame,
  frameKey,
  panelRef,
  phone,
  roomy = false,
}: {
  frame: LngLat[];
  frameKey: string;
  panelRef: RefObject<HTMLDivElement | null>;
  phone: boolean;
  /** A card found no room: give the walk wider margins above and to the right, where cards go. */
  roomy?: boolean;
}) {
  const map = useMap(ALIVE_MAP_ID);
  const ready = useMapReady(ALIVE_MAP_ID);
  const latest = useRef(frame);
  latest.current = frame;
  useEffect(() => {
    if (!map || !ready || latest.current.length === 0) return;
    const box = map.getContainer().getBoundingClientRect();
    const panel = panelRef.current?.getBoundingClientRect();
    let padding = phone ? { top: 120, right: 40, bottom: 40, left: 40 } : roomy ? { top: 240, right: 200, bottom: 120, left: 96 } : { top: 140, right: 96, bottom: 96, left: 96 };
    if (panel && panel.width > 0 && box.width > 0) {
      if (phone) padding.bottom = Math.max(padding.bottom, Math.round(box.bottom - panel.top + 40));
      else padding.left = Math.round(panel.right - box.left + 48);
    }
    // A window too small for the reference padding gets an even one rather than an empty frame.
    if (box.width - padding.left - padding.right < 160 || box.height - padding.top - padding.bottom < 160) padding = { top: 24, right: 24, bottom: 24, left: 24 };
    map.fitBounds(boundsOf(latest.current), { padding, maxZoom: 17, duration: prefersReducedMotion() ? 0 : CAMERA_MS });
  }, [map, ready, frameKey, panelRef, phone, roomy]);
  return null;
}

/**
 * Re-renders whenever the map moves, so HTML pinned to coordinates follows it; `settled` counts the
 * moves that have ended (and resizes), for work that should wait until the map is still.
 */
function useScreen(): { project: (at: LngLat) => Point; box: DOMRect; settled: number } | null {
  const map = useMap(ALIVE_MAP_ID);
  const ready = useMapReady(ALIVE_MAP_ID);
  const [, setTick] = useState(0);
  const [settled, setSettled] = useState(0);
  useEffect(() => {
    if (!map || !ready) return;
    const bump = () => setTick((n) => n + 1);
    const settle = () => setSettled((n) => n + 1);
    map.on("move", bump);
    map.on("moveend", settle);
    map.on("resize", settle);
    return () => {
      map.off("move", bump);
      map.off("moveend", settle);
      map.off("resize", settle);
    };
  }, [map, ready]);
  if (!map || !ready) return null;
  return { project: ([lng, lat]) => map.project({ lng, lat }), box: map.getContainer().getBoundingClientRect(), settled };
}

/** A highlight card's size in pixels (w-55, a 140 px picture and a caption), for placing it. */
const CARD = { w: 220, h: 196 };
const BUBBLE = { pick: { w: 196, h: 70 }, fastest: { w: 150, h: 60 } };
const KIND_ICON: Record<HighlightCard["kind"], LucideIcon> = { park: Trees, life: Coffee, landmark: Landmark };

/** The tail on a box's edge facing the point it points at. */
const TAIL: Record<Side, string> = {
  top: "-bottom-[7px] left-1/2 -translate-x-1/2 border-r-2 border-b-2",
  bottom: "-top-[7px] left-1/2 -translate-x-1/2 border-t-2 border-l-2",
  left: "top-1/2 -right-[7px] -translate-y-1/2 border-t-2 border-r-2",
  right: "top-1/2 -left-[7px] -translate-y-1/2 border-b-2 border-l-2",
  "top-left": "-bottom-[7px] right-[22px] border-r-2 border-b-2",
  "top-right": "-bottom-[7px] left-[22px] border-r-2 border-b-2",
  "bottom-left": "-top-[7px] right-[22px] border-t-2 border-l-2",
  "bottom-right": "-top-[7px] left-[22px] border-t-2 border-l-2",
};
/** Every side, in the order a card tries them: above first, as in the reference. */
const CARD_SIDES: readonly Side[] = ["top", "top-left", "top-right", "right", "left", "bottom", "bottom-left", "bottom-right"];
const BUBBLE_SIDES: readonly Side[] = ["top", "right", "left", "bottom", "top-left", "top-right", "bottom-left", "bottom-right"];
/** Where a placed box goes: at its anchor, offset by the tail's gap, so the tail meets the point whatever the box's real size. */
function boxStyle(spot: { at: Point; side: Side }, gap: number) {
  const { x, y } = spot.at;
  switch (spot.side) {
    case "top":
      return { left: x, top: y - gap, transform: "translate(-50%, -100%)" };
    case "bottom":
      return { left: x, top: y + gap, transform: "translate(-50%, 0)" };
    case "left":
      return { left: x - gap, top: y, transform: "translate(-100%, -50%)" };
    case "right":
      return { left: x + gap, top: y, transform: "translate(0, -50%)" };
    case "top-left":
      return { left: x + TAIL_INSET, top: y - gap, transform: "translate(-100%, -100%)" };
    case "top-right":
      return { left: x - TAIL_INSET, top: y - gap, transform: "translate(0, -100%)" };
    case "bottom-left":
      return { left: x + TAIL_INSET, top: y + gap, transform: "translate(-100%, 0)" };
    case "bottom-right":
      return { left: x - TAIL_INSET, top: y + gap, transform: "translate(0, 0)" };
  }
}

function Tail({ side, className }: { side: Side; className?: string }) {
  return <span aria-hidden="true" className={["absolute size-3 rotate-45 border-inherit bg-card", TAIL[side], className].filter(Boolean).join(" ")} />;
}

/** A rectangle of the page in the map's own pixels, or null when it is not on screen. */
function within(box: DOMRect, ref?: RefObject<HTMLElement | null>): Rect | null {
  const r = ref?.current?.getBoundingClientRect();
  return r && r.width > 0 ? { x0: r.left - box.left, y0: r.top - box.top, x1: r.right - box.left, y1: r.bottom - box.top } : null;
}

/** Points of a walk ordered from its middle outwards: the bubble's preferred anchors. */
function middleOut<T>(points: T[]): T[] {
  const inner = points.slice(Math.floor(points.length * 0.15), Math.ceil(points.length * 0.85));
  const step = Math.max(1, Math.floor(inner.length / 24));
  const picked = inner.filter((_, i) => i % step === 0);
  const mid = picked.length / 2;
  return picked.map((p, i) => ({ p, d: Math.abs(i - mid) })).sort((a, b) => a.d - b.d).map(({ p }) => p);
}

function CardBody({ lang, card, picture }: { lang: AliveLang; card: HighlightCard; picture: string | undefined }) {
  const copy = ALIVE_COPY[lang];
  const Icon = KIND_ICON[card.kind];
  const detail = card.kind === "park" && card.metres ? copy.through(card.metres) : card.extra > 0 ? copy.more_(card.extra) : null;
  return (
    <>
      <Illustration kind={card.kind} lang={lang} src={picture} alt={copy.pictureAlt(card.kind)} className="h-35 w-full" />
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm leading-tight font-bold">{copy.highlights[card.kind]}</span>
          <span className="truncate text-xs leading-snug text-muted-foreground">
            {card.names.join(", ")}
            {detail ? `, ${detail}` : ""}
          </span>
        </div>
      </div>
    </>
  );
}

/**
 * For the bubbles and the markers, Buttons whose left/top follow the map every frame: no
 * transition-all (they would trail the map by 150 ms), and no press nudge (it replaces the
 * centring translate).
 */
const TRACKS = "transition-colors active:not-aria-[haspopup]:translate-y-0";

/** A marker whose card did not fit, or any marker on a phone: the card opens as a popover. */
function MarkerPopover({ lang, card, picture, name, Icon }: { lang: AliveLang; card: HighlightCard; picture: string | undefined; name: string; Icon: LucideIcon }) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={name}
            className={`pointer-events-auto size-9 rounded-full border bg-card text-primary shadow-md hover:bg-card hover:text-primary dark:hover:bg-card ${TRACKS}`}
          >
            <Icon aria-hidden="true" />
          </Button>
        }
      />
      <PopoverContent side="top" sideOffset={10} className="w-56 gap-0 overflow-hidden rounded-2xl p-0">
        <CardBody lang={lang} card={card} picture={picture} />
      </PopoverContent>
    </Popover>
  );
}

/**
 * Measured sizes of the boxes this overlay places, by key. Every render reads them for placing and
 * then re-measures; a size that changed (a picture loaded, a font arrived, a longer name) re-renders
 * once with the true size. The first render places on estimates.
 */
function useMeasured(): {
  size: (key: string, fallback: { w: number; h: number }) => { w: number; h: number };
  ref: (key: string) => (el: HTMLElement | null) => void;
  version: number;
} {
  const sizes = useRef(new globalThis.Map<string, { w: number; h: number }>());
  const nodes = useRef(new globalThis.Map<string, HTMLElement>());
  const [version, setVersion] = useState(0);
  useLayoutEffect(() => {
    let changed = false;
    for (const [key, el] of nodes.current) {
      // offsetWidth/Height ignore transforms, so an entry animation never shrinks the measure.
      const next = { w: el.offsetWidth, h: el.offsetHeight };
      const was = sizes.current.get(key);
      if (next.w > 0 && (!was || Math.abs(was.w - next.w) > 1 || Math.abs(was.h - next.h) > 1)) {
        sizes.current.set(key, next);
        changed = true;
      }
    }
    if (changed) setVersion((v) => v + 1);
  });
  return {
    version,
    size: (key, fallback) => sizes.current.get(key) ?? fallback,
    ref: (key) => (el) => {
      if (el) nodes.current.set(key, el);
      else nodes.current.delete(key);
    },
  };
}

/** The overlay's placements, made when the map is still and kept, relative to their anchors, while it moves. */
interface Layout {
  bubbles: { key: "pick" | "fastest"; at: LngLat; side: Side }[];
  /** By card index: null when closed by the reader, "folded" when nothing fits, else its spot relative to its marker. */
  cards: (null | "folded" | { dx: number; dy: number; side?: Side; leader?: { x0: number; y0: number; x1: number; y1: number } })[];
}

export function AliveOverlay(props: {
  lang: AliveLang;
  /** The shown walk and the fastest, or null before a search. */
  shown: RankedWalk | null;
  fastest: RankedWalk | null;
  isPick: boolean;
  phone: boolean;
  from: { at: LngLat; label: string };
  to: { at: LngLat; label: string };
  pictures?: AlivePictures;
  panelRef: RefObject<HTMLDivElement | null>;
  whyRef: RefObject<HTMLDivElement | null>;
  onSelect: (id: string) => void;
  /** Some card found no room: the camera may give the walk more margin. */
  onCrowded?: () => void;
}) {
  const { lang, shown, fastest, phone } = props;
  const copy = ALIVE_COPY[lang];
  const screen = useScreen();
  const measured = useMeasured();
  const cards = useMemo(() => (shown ? highlightCards(shown.coords, shown.scores, (place) => placeName(place, lang)) : []), [shown, lang]);
  const [closed, setClosed] = useState<string[]>([]);
  useEffect(() => setClosed([]), [shown?.id]);

  // Each end's name sits to its right, or to its left when the right edge is too close.
  const endsAt = (project: (at: LngLat) => Point, width: number) =>
    [
      { ...props.from, kind: "start" as const, p: project(props.from.at) },
      { ...props.to, kind: "end" as const, p: project(props.to.at) },
    ].map((end) => {
      const pill = measured.size(`pill-${end.kind}`, { w: 28 + end.label.length * 9, h: 36 });
      const flip = end.p.x + 20 + pill.w > width - 8;
      const x0 = flip ? end.p.x - 20 - pill.w : end.p.x + 20;
      const y0 = end.kind === "start" ? end.p.y - pill.h / 2 : end.p.y - 40;
      return { ...end, flip, pill: { x0, y0, x1: x0 + pill.w, y1: y0 + pill.h } };
    });

  // Placing waits for the map to be still: a new walk, a size measured, a move or zoom ended.
  const settled = screen?.settled ?? -1;
  const layout = useMemo<Layout | null>(() => {
    if (!screen || !shown || !fastest) return null;
    const { project, box } = screen;
    const bounds: Rect = { x0: 8, y0: 8, x1: box.width - 8, y1: box.height - 8 };
    const obstacles: Rect[] = [];
    for (const ref of [props.panelRef, props.whyRef]) {
      const r = within(box, ref);
      if (r) obstacles.push({ ...r, weight: 20 });
    }
    for (const end of endsAt(project, box.width)) {
      obstacles.push(end.pill);
      obstacles.push(end.kind === "start" ? { x0: end.p.x - 12, y0: end.p.y - 12, x1: end.p.x + 12, y1: end.p.y + 12 } : { x0: end.p.x - 14, y0: end.p.y - 42, x1: end.p.x + 14, y1: end.p.y + 2 });
    }
    const markers = cards.map((card) => project(card.at));
    const markerRects: Rect[] = markers.map((m) => ({ x0: m.x - 18, y0: m.y - 18, x1: m.x + 18, y1: m.y + 18 }));
    obstacles.push(...markerRects);
    const shownLine = shown.coords.map(project);
    const fastestLine = fastest.id !== shown.id ? fastest.coords.map(project) : [];
    const lines = densify([shownLine, fastestLine], 12);
    const pickPoints = densify([shownLine], 12);

    // Bubbles first: they say the times, the reason the walks are there. Cards then avoid them.
    const bubbles: Layout["bubbles"] = [];
    const bubble = (key: "pick" | "fastest", coords: LngLat[], first: LngLat[]) => {
      const lngLats = [...first, ...middleOut(coords)];
      const anchors = lngLats.map(project);
      const size = measured.size(`bubble-${key}`, BUBBLE[key]);
      const spot = placeBox(anchors, size, BUBBLE_SIDES, obstacles, lines, bounds, 14);
      if (!spot) return;
      obstacles.push(spot.rect);
      bubbles.push({ key, at: lngLats[anchors.indexOf(spot.at)]!, side: spot.side });
    };
    if (fastest.id === shown.id) bubble("pick", shown.coords, []);
    else {
      bubble("pick", shown.coords, [apexOf(shown.coords, fastest.coords)]);
      bubble("fastest", fastest.coords, []);
    }

    // Cards: each on a ring round its marker, clear of everything above and of each other; a card
    // with no such spot folds into its marker, which opens it as a popover.
    const placed: Layout["cards"] = cards.map((card, index) => {
      if (phone || closed.includes(card.kind)) return null;
      const m = markers[index]!;
      const others = obstacles.filter((o) => o !== markerRects[index]);
      const spot = placeCard(m, measured.size(`card-${card.kind}`, CARD), CARD_SIDES, others, pickPoints, bounds);
      if (!spot) return "folded";
      obstacles.push(spot.rect);
      return {
        dx: spot.rect.x0 - m.x,
        dy: spot.rect.y0 - m.y,
        ...(spot.side ? { side: spot.side } : {}),
        ...(spot.leader ? { leader: { x0: spot.leader.x0 - m.x, y0: spot.leader.y0 - m.y, x1: spot.leader.x1 - m.x, y1: spot.leader.y1 - m.y } } : {}),
      };
    });
    return { bubbles, cards: placed };
    // `screen` is read at the moment the map settles, on purpose: placing on every frame would fold
    // and unfold cards mid-gesture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, shown, fastest, cards, phone, closed, measured.version, props.from.label, props.to.label]);

  // A walk is "crowded" only once the camera has framed it (a move has ended since it arrived): the
  // first layout runs against the previous camera, where a card folding says nothing. Once per walk.
  const walkKey = shown ? `${shown.id}|${shown.coords.length}|${shown.coords[0]?.join(",")}` : "";
  const arrived = useRef({ walk: "", settled: -1 });
  const reported = useRef(new Set<string>());
  useEffect(() => {
    if (arrived.current.walk !== walkKey) arrived.current = { walk: walkKey, settled };
  }, [walkKey, settled]);
  const crowded = !!layout && layout.cards.some((c) => c === "folded");
  const onCrowded = props.onCrowded;
  useEffect(() => {
    if (!crowded || !walkKey || arrived.current.walk !== walkKey || settled <= arrived.current.settled || reported.current.has(walkKey)) return;
    reported.current.add(walkKey);
    onCrowded?.();
  }, [crowded, walkKey, settled, onCrowded]);

  if (!screen) return null;
  const { project, box } = screen;
  const place = (p: Point) => ({ left: p.x, top: p.y });
  const ends = endsAt(project, box.width);
  const markers = cards.map((card) => project(card.at));
  const isFastest = !!shown && !!fastest && shown.id === fastest.id;

  return (
    // overflow-clip, not overflow-hidden: focusing a marker near the edge must not scroll this layer
    // off the map underneath it.
    <div className="pointer-events-none absolute inset-0 z-[5] overflow-clip">
      {ends.map((end) => (
        <div key={end.kind} style={place(end.p)} className="absolute">
          {end.kind === "start" ? (
            <StartDot className="absolute size-5 -translate-x-1/2 -translate-y-1/2" />
          ) : (
            <EndPin className="absolute h-10 -translate-x-1/2 -translate-y-full" />
          )}
          <span
            ref={measured.ref(`pill-${end.kind}`)}
            className={[
              "absolute rounded-xl bg-card px-3 py-1.5 text-base font-bold whitespace-nowrap text-card-foreground shadow-md",
              end.flip ? "right-5" : "left-5",
              end.kind === "start" ? "top-0 -translate-y-1/2" : "-top-10",
            ].join(" ")}
          >
            {end.label}
          </span>
        </div>
      ))}

      {/* Leaders, from a marker's rim to its card, under both. */}
      <svg aria-hidden="true" className="absolute inset-0 size-full overflow-visible">
        {cards.map((card, index) => {
          const spot = layout?.cards[index];
          if (!spot || spot === "folded" || !spot.leader) return null;
          const m = markers[index]!;
          return (
            <line
              key={card.kind}
              x1={m.x + spot.leader.x0}
              y1={m.y + spot.leader.y0}
              x2={m.x + spot.leader.x1}
              y2={m.y + spot.leader.y1}
              strokeWidth="2"
              strokeDasharray="3 4"
              strokeLinecap="round"
              className="stroke-foreground/50"
            />
          );
        })}
      </svg>

      {cards.map((card, index) => {
        const Icon = KIND_ICON[card.kind];
        const picture = pictureFor(card, props.pictures, shown?.id ?? "");
        const name = `${copy.highlights[card.kind]}: ${card.names.join(", ")}`;
        const spot = layout?.cards[index];
        return (
          // The wrapper centres the marker, so the button's own press nudge never moves it off its point.
          <div key={`${card.kind}-${card.names[0]}`} style={place(markers[index]!)} className="absolute">
            <div className="absolute -translate-x-1/2 -translate-y-1/2">
              {phone || spot === "folded" ? (
                <MarkerPopover lang={lang} card={card} picture={picture} name={name} Icon={Icon} />
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={name}
                  aria-expanded={!!spot}
                  onClick={() => setClosed((now) => (now.includes(card.kind) ? now.filter((k) => k !== card.kind) : [...now, card.kind]))}
                  className={`pointer-events-auto size-9 rounded-full border bg-card text-primary shadow-md hover:bg-card hover:text-primary dark:hover:bg-card ${TRACKS}`}
                >
                  <Icon aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
        );
      })}
      {cards.map((card, index) => {
        const spot = layout?.cards[index];
        if (!spot || spot === "folded") return null;
        const m = markers[index]!;
        // Kept at its offset from the marker while the map moves, so card and marker move as one.
        return (
          <Card
            key={`card-${card.kind}-${card.names[0]}`}
            ref={measured.ref(`card-${card.kind}`)}
            data-unmap-card={card.kind}
            className="pointer-events-auto absolute w-55 gap-0 overflow-visible rounded-2xl py-0 shadow-lg motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300"
            style={{ left: m.x + spot.dx, top: m.y + spot.dy }}
          >
            <div className="overflow-hidden rounded-2xl">
              <CardBody lang={lang} card={card} picture={pictureFor(card, props.pictures, shown?.id ?? "")} />
            </div>
            {spot.side ? <Tail side={spot.side} className="border-transparent" /> : null}
          </Card>
        );
      })}

      {shown && fastest
        ? (layout?.bubbles ?? []).map(({ key, at, side }) => {
            const pick = key === "pick";
            return (
              <Button
                key={key}
                ref={measured.ref(`bubble-${key}`)}
                type="button"
                variant="ghost"
                onClick={() => props.onSelect(pick ? shown.id : fastest.id)}
                style={boxStyle({ at: project(at), side }, 14)}
                className={[
                  "pointer-events-auto absolute h-auto flex-col items-start gap-0.5 overflow-visible rounded-2xl border-2 bg-card px-4 py-2 text-left whitespace-nowrap shadow-lg hover:bg-card dark:hover:bg-card",
                  TRACKS,
                  pick ? "border-primary text-primary hover:text-primary" : "border-border text-foreground hover:text-foreground",
                  pick ? "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300" : "",
                ].join(" ")}
              >
                {pick ? (
                  <>
                    <span className="block text-lg leading-tight font-semibold">{isFastest ? copy.fastest : props.isPick ? copy.livelier : copy.selected}</span>
                    <span className="block leading-tight tabular-nums">
                      <span className="text-xl font-bold">{copy.minutes(shown.durationS)}</span>
                      {isFastest ? null : <span className="text-sm font-medium"> ({copy.extra(shown.extraMin)})</span>}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="block text-base leading-tight font-semibold">{copy.fastest}</span>
                    <span className="block text-base leading-tight tabular-nums">{copy.minutes(fastest.durationS)}</span>
                  </>
                )}
                <Tail side={side} />
              </Button>
            );
          })
        : null}
    </div>
  );
}
