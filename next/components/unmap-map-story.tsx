"use client";

/**
 * <MapStory> - tell a story the map can follow. The chapters scroll past a map that stays in view,
 * and as each one reaches the middle of the screen the camera flies to it and the map reveals that
 * chapter's route or travel-time areas. Unlike LocalGuide, which steps through its stops with
 * previous and next buttons, the reader's scroll is the only control here (or Tab, chapter by
 * chapter).
 *
 * Requests: the map's style and tiles, plus one /route or /isochrone request per chapter the
 * first time it opens. Each is one metered request; scrolling back redraws what the story
 * already has. Under reduced motion the camera jumps and routes appear whole.
 *
 * The chapters live in lib/map-story-01-data.ts. Edit freely.
 */

import { useEffect, useId, useMemo, useRef, useState, type ComponentProps } from "react";
import { Router } from "@unmap/routing";
import { Map } from "@/components/ui/map";
import { Marker } from "@/components/ui/marker-popup";
import { RouteLine } from "@/components/ui/route-line";
import { GeoJSONLayer } from "@/components/ui/geojson-layer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { prefersReducedMotion, TemplateMapStatus } from "@/components/unmap-map-template";
import { useMap, useMapReady } from "@/lib/map-context";
import { cn } from "@/lib/utils";
import {
  storyLabels,
  templateLabels,
  type StoryChapter,
  type StoryContent,
  type StoryReveal,
  type TemplateBlockProps,
  type TemplateLang,
} from "@/lib/map-template";
import { mapStoryData } from "@/lib/map-story-01-data";

export type MapStoryProps = Omit<TemplateBlockProps, "data"> & {
  /** Your story. Defaults to the Calgary to the Rockies sample in lib/map-story-01-data.ts. */
  data?: StoryContent;
};

/** How long a route takes to draw in, and a chapter's flight, in milliseconds. */
export const ROUTE_DRAW_MS = 1600;
const FLY_MS = 2400;

/** Travel-time areas: the nearest band strongest, fading outward. Colour is your --primary. */
const AREA_FILL = {
  "fill-opacity": ["interpolate", ["linear"], ["get", "contour"], 10, 0.35, 60, 0.1],
};

/** The first chapter, in story order, crossing the middle of the screen; else the previous one. */
export function activeChapter(order: string[], visible: ReadonlySet<string>, previous: string): string {
  return order.find((id) => visible.has(id)) ?? previous;
}

/** How much of a route is drawn `elapsed` ms into a `duration` ms reveal: eased out, 0 to 1. */
export function progressAt(elapsed: number, duration: number): number {
  if (duration <= 0) return 1;
  const t = Math.min(1, Math.max(0, elapsed / duration));
  return 1 - (1 - t) ** 3;
}

/**
 * Why a chapter's reveal failed, in the reader's language: the place or the key or the rate when
 * the gateway says so; a service that did not answer for a 5xx or a request with no HTTP answer.
 */
export function revealError(caught: unknown, lang: TemplateLang): string {
  const t = storyLabels[lang];
  const failure = typeof caught === "object" && caught !== null ? (caught as { code?: unknown; status?: unknown }) : {};
  const status = typeof failure.status === "number" && failure.status > 0 ? failure.status : null;
  if (failure.code === "outside_coverage") return t.outside;
  if (failure.code === "no_route") return t.noRoute;
  if (status === 429) return t.busy;
  if (status === 401 || status === 403) return t.keyRefused;
  if (status === null || status >= 500) return t.unavailable;
  return t.failed;
}

/** Every [longitude, latitude] position in a line or a GeoJSON value. */
export function positionsOf(value: unknown): [number, number][] {
  const found: [number, number][] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      if (typeof node[0] === "number" && typeof node[1] === "number") found.push([node[0], node[1]]);
      else node.forEach(visit);
    } else if (node && typeof node === "object") {
      const object = node as { features?: unknown; geometry?: unknown; coordinates?: unknown };
      visit(object.features ?? object.geometry ?? object.coordinates);
    }
  };
  visit(value);
  return found;
}

export interface FrameView {
  /** The map's size in CSS pixels. */
  width: number;
  height: number;
  bearing: number;
  pitch: number;
  /** Room to keep clear on each side, in pixels. */
  padding: { top: number; right: number; bottom: number; left: number };
  maxZoom: number;
}

/** MapLibre's world: 512 px tiles, Web Mercator, y down. */
const mercator = ([lng, lat]: [number, number]): [number, number] => {
  const sin = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  return [(lng + 180) / 360, 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)];
};
const lngLat = ([x, y]: [number, number]): [number, number] => [
  x * 360 - 180,
  (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI,
];

/**
 * Where a ground point lands on screen, in pixels from the centre (y down), for a camera at
 * `centre`, `zoom`, `bearing` and `pitch`. MapLibre's camera sits 1.5 map heights back (its 36.87°
 * field of view), so a tilted map magnifies what is near the bottom edge and shrinks what is far.
 * Null for a point at or past the horizon.
 */
export function screenOf(point: [number, number], centre: [number, number], zoom: number, view: FrameView): [number, number] | null {
  const scale = 512 * 2 ** zoom;
  const dx = (point[0] - centre[0]) * scale;
  const dy = (point[1] - centre[1]) * scale;
  const b = (view.bearing * Math.PI) / 180;
  const x = dx * Math.cos(b) + dy * Math.sin(b);
  const forward = dx * Math.sin(b) - dy * Math.cos(b);
  const p = (view.pitch * Math.PI) / 180;
  const depth = 1 + (forward * Math.sin(p)) / (1.5 * view.height);
  if (depth < 0.05) return null;
  return [x / depth, -(forward * Math.cos(p)) / depth];
}

/**
 * The camera that shows every point inside the padded map at the chapter's bearing and pitch, as
 * close as it can (up to `maxZoom`). MapLibre's own cameraForBounds ignores pitch, which on a
 * tilted chapter cut the near end of the route off the bottom and sides.
 */
export function frameReveal(points: [number, number][], view: FrameView): { center: [number, number]; zoom: number } | null {
  const width = view.width - view.padding.left - view.padding.right;
  const height = view.height - view.padding.top - view.padding.bottom;
  if (points.length === 0 || width <= 0 || height <= 0) return null;
  const world = points.map(mercator);
  const xs = world.map((point) => point[0]);
  const ys = world.map((point) => point[1]);
  let centre: [number, number] = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  const left = -view.width / 2 + view.padding.left;
  const right = view.width / 2 - view.padding.right;
  const top = -view.height / 2 + view.padding.top;
  const bottom = view.height / 2 - view.padding.bottom;
  /** The on-screen box of every point, or null when one falls past the horizon. */
  const box = (zoom: number) => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const point of world) {
      const at = screenOf(point, centre, zoom, view);
      if (!at) return null;
      minX = Math.min(minX, at[0]);
      maxX = Math.max(maxX, at[0]);
      minY = Math.min(minY, at[1]);
      maxY = Math.max(maxY, at[1]);
    }
    return { minX, maxX, minY, maxY };
  };
  const fits = (zoom: number) => {
    const at = box(zoom);
    return !!at && at.maxX - at.minX <= width && at.maxY - at.minY <= height;
  };
  let zoom = 0;
  // Fit the size, slide the centre so the shape sits in the padded middle, and fit again: tilt
  // makes size depend on where the centre is, so a few rounds settle it.
  for (let round = 0; round < 4; round++) {
    let low = 0;
    let high = view.maxZoom;
    if (fits(high)) low = high;
    else {
      for (let step = 0; step < 24; step++) {
        const middle = (low + high) / 2;
        if (fits(middle)) low = middle;
        else high = middle;
      }
    }
    zoom = low;
    const at = box(zoom);
    if (!at) break;
    const shiftX = (at.minX + at.maxX) / 2 - (left + right) / 2;
    const shiftY = (at.minY + at.maxY) / 2 - (top + bottom) / 2;
    const p = (view.pitch * Math.PI) / 180;
    const b = (view.bearing * Math.PI) / 180;
    // Undo the tilt (roughly, at the centre) and the bearing, back to world units.
    const x = shiftX;
    const forward = -shiftY / Math.cos(p);
    const scale = 512 * 2 ** zoom;
    centre = [
      centre[0] + (x * Math.cos(b) + forward * Math.sin(b)) / scale,
      centre[1] + (x * Math.sin(b) - forward * Math.cos(b)) / scale,
    ];
  }
  if (!fits(zoom)) {
    // The last slide nudged the shape out; back off until it fits again.
    while (zoom > 0 && !fits(zoom)) zoom = Math.max(0, zoom - 0.05);
  }
  return { center: lngLat(centre), zoom };
}

/**
 * Room round a revealed route or area: a margin on every side that grows with the map, plus the
 * key's height at the top and the attribution's at the bottom.
 */
function revealPadding(width: number, height: number) {
  return {
    top: 44 + Math.round(height * 0.06),
    right: 16 + Math.round(width * 0.06),
    bottom: 28 + Math.round(height * 0.06),
    left: 16 + Math.round(width * 0.06),
  };
}

function isAbort(caught: unknown): boolean {
  return typeof caught === "object" && caught !== null && (caught as { name?: unknown }).name === "AbortError";
}

/** True when the browser would draw a focus ring here: focus from the keyboard, not a click. */
function focusVisible(element: Element): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
}

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match));
}

type AreaData = ComponentProps<typeof GeoJSONLayer>["data"];

type Reveal =
  | { status: "loading" }
  | { status: "error"; caught: unknown }
  | { status: "route"; coordinates: [number, number][]; meters: number; seconds: number }
  | { status: "area"; data: AreaData };

/** "128 km · 1 h 32 min by car": what the route chapter adds to the map. */
function routeSummary(meters: number, seconds: number, mode: StoryReveal["mode"], lang: TemplateLang): string {
  const t = storyLabels[lang];
  const km = new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { maximumFractionDigits: 0 }).format(meters / 1000);
  const total = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const time = hours > 0 ? `${hours} ${t.hours}${minutes ? ` ${minutes} ${t.minutes}` : ""}` : `${minutes} ${t.minutes}`;
  return `${km} km · ${time} ${t.modes[mode]}`;
}

export function MapStory({ apiKey, lang: language = "en", data = mapStoryData, theme, className }: MapStoryProps) {
  const mapId = useId();
  const t = storyLabels[language];
  const copy = data.content[language];
  const chapters = data.chapters;
  const hasKey = apiKey.trim() !== "";
  const [active, setActive] = useState(chapters[0]?.id ?? "");
  const [reveals, setReveals] = useState<Record<string, Reveal>>({});
  const [announcement, setAnnouncement] = useState("");
  const spoken = useRef(active);
  const listRef = useRef<HTMLOListElement | null>(null);
  // In-flight requests by chapter id, so an abort can forget exactly what it cancelled.
  const controllers = useRef(new globalThis.Map<string, AbortController>());
  // Chapters already asked for, so React's development double effects never ask twice.
  const requested = useRef(new Set<string>());
  const mounted = useRef(false);
  // No client, and so no request, without a key.
  const router = useMemo(() => (hasKey ? new Router({ key: apiKey }) : null), [apiKey, hasKey]);
  const index = Math.max(0, chapters.findIndex((chapter) => chapter.id === active));
  const chapter = chapters[index];
  const reveal = chapter ? reveals[chapter.id] : undefined;
  const order = chapters.map((entry) => entry.id).join("\n");

  // The chapter crossing the middle of the viewport is active. Without IntersectionObserver the
  // first chapter stays, and Tab still moves through them.
  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof IntersectionObserver === "undefined") return;
    const ids = order.split("\n");
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.unmapStoryChapter ?? "";
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        setActive((previous) => activeChapter(ids, visible, previous));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    list.querySelectorAll<HTMLElement>("[data-unmap-story-chapter]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [order]);

  // One announcement per change of chapter, never on first load.
  useEffect(() => {
    if (spoken.current === active || !chapter) return;
    spoken.current = active;
    setAnnouncement(fill(t.announce, { n: index + 1, total: chapters.length, title: chapter.content[language].title }));
  }, [active, chapter, chapters.length, index, language, t.announce]);

  // A chapter's reveal is asked for the first time it opens, and kept. One the reader scrolled
  // past is still wanted on the way back, so only unmounting aborts a request in flight.
  useEffect(() => {
    if (!router || !chapter?.reveal || requested.current.has(chapter.id)) return;
    const { id, reveal: wanted } = chapter;
    requested.current.add(id);
    const controller = new AbortController();
    controllers.current.set(id, controller);
    setReveals((current) => ({ ...current, [id]: { status: "loading" } }));
    const request: Promise<Reveal> =
      wanted.kind === "route"
        ? router.route(wanted.from, wanted.to, { mode: wanted.mode, signal: controller.signal }).then((result) => ({
            status: "route",
            coordinates: result.geometry.coordinates,
            meters: result.distanceMeters,
            seconds: result.durationSeconds,
          }))
        : router
            .isochrone(wanted.center, { minutes: wanted.minutes, mode: wanted.mode, signal: controller.signal })
            .then((area) => ({ status: "area", data: area as AreaData }));
    request
      .then(
        (state) => {
          if (!controller.signal.aborted) setReveals((current) => ({ ...current, [id]: state }));
        },
        (caught: unknown) => {
          if (!controller.signal.aborted && !isAbort(caught)) {
            setReveals((current) => ({ ...current, [id]: { status: "error", caught } }));
          }
        },
      )
      .finally(() => {
        if (controllers.current.get(id) === controller) controllers.current.delete(id);
      });
  }, [chapter, reveals, router]);

  // Abort what is in flight only on a real unmount. React's development remount runs this
  // cleanup and the setup back to back, so the abort waits a microtask and stands down if the
  // story mounted again in between. An aborted chapter is forgotten, loading state and all, so a
  // story that mounts again with its state kept (React's <Activity>) asks for it afresh.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      queueMicrotask(() => {
        if (mounted.current) return;
        const cancelled = [...controllers.current.keys()];
        for (const controller of controllers.current.values()) controller.abort();
        controllers.current.clear();
        if (cancelled.length === 0) return;
        for (const id of cancelled) requested.current.delete(id);
        setReveals((current) => {
          const next = { ...current };
          for (const id of cancelled) if (next[id]?.status === "loading") delete next[id];
          return next;
        });
      });
    };
  }, []);

  const retry = (id: string) => {
    requested.current.delete(id);
    setReveals((current) => {
      const { [id]: _failed, ...rest } = current;
      return rest;
    });
  };

  const first = chapters[0]?.camera;
  return (
    <Card
      data-unmap-template="map-story"
      // overflow-clip, not hidden: a hidden overflow would trap the sticky map inside the card.
      className={cn("min-w-0 overflow-clip", className)}
    >
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{copy.lead}</CardDescription>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-start lg:gap-8">
        <ol ref={listRef} aria-label={copy.title} className="flex min-w-0 max-w-prose flex-col">
          {chapters.map((entry, i) => {
            const isActive = entry.id === active;
            return (
              <li key={entry.id}>
                <article
                  data-unmap-story-chapter={entry.id}
                  data-active={isActive}
                  aria-current={isActive ? "step" : undefined}
                  aria-labelledby={`${mapId}-${entry.id}`}
                  tabIndex={0}
                  onFocus={(event) => {
                    setActive(entry.id);
                    // A keyboard reader lands the chapter where the scroll would have: mid-screen,
                    // clear of the map strip on a phone. A click leaves the page where it is.
                    if (focusVisible(event.currentTarget)) {
                      event.currentTarget.scrollIntoView?.({
                        block: "center",
                        behavior: prefersReducedMotion() ? "auto" : "smooth",
                      });
                    }
                  }}
                  className="flex min-h-[70dvh] scroll-mt-[45dvh] flex-col justify-center gap-3 rounded-r-md border-l-2 border-border py-8 pr-2 pl-5 outline-none transition-colors duration-300 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[active=true]:border-primary motion-reduce:transition-none lg:scroll-mt-0 lg:pl-6"
                >
                  <Badge variant="secondary" className="w-fit tabular-nums">
                    {fill(t.chapter, { n: i + 1, total: chapters.length })}
                  </Badge>
                  <h3 id={`${mapId}-${entry.id}`} className="text-xl font-semibold text-balance lg:text-2xl">
                    {entry.content[language].title}
                  </h3>
                  <p
                    data-active={isActive}
                    className="text-base leading-relaxed text-pretty text-muted-foreground transition-colors duration-300 data-[active=true]:text-foreground motion-reduce:transition-none"
                  >
                    {entry.content[language].body}
                  </p>
                </article>
              </li>
            );
          })}
        </ol>
        <div
          role="region"
          aria-label={`${templateLabels[language].map}: ${copy.title}`}
          className="sticky top-0 z-10 order-first h-[45dvh] min-w-0 bg-card pt-3 pb-3 lg:top-4 lg:order-none lg:h-[calc(100dvh-2rem)] lg:p-0"
        >
          <Map
            id={mapId}
            apiKey={apiKey}
            center={first?.center}
            zoom={first?.zoom}
            bearing={first?.bearing}
            pitch={first?.pitch}
            style={data.style}
            theme={theme}
            lang={language}
            accent="system"
            // The reader's scroll drives the camera; a draggable map would steal it.
            interactive={false}
            controls={false}
            className="h-full"
            containerStyle={{ minHeight: 0 }}
          >
            <TemplateMapStatus mapId={mapId} lang={language} unavailable={!hasKey} message={t.mapUnavailable} />
            {chapter && <StoryStage mapId={mapId} chapter={chapter} reveal={reveal} />}
            {chapter && (
              <StoryState mapId={mapId} chapter={chapter} reveal={reveal} lang={language} onRetry={() => retry(chapter.id)} />
            )}
          </Map>
        </div>
      </CardContent>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <CardFooter>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t.creditLead}{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            className="underline underline-offset-4 hover:text-foreground"
          >
            {t.osm}
          </a>
          ,{" "}
          <a
            href="https://opendatacommons.org/licenses/odbl/"
            className="underline underline-offset-4 hover:text-foreground"
          >
            ODbL
          </a>
          . {templateLabels[language].sample}
        </p>
      </CardFooter>
    </Card>
  );
}

/**
 * What the active chapter's reveal is doing, over the map: loading, its key once drawn, or why it
 * failed with a way to ask again. It renders inside <Map> so it can wait for the map: until the
 * map is ready its own status line has the top edge, so a failure sits at the bottom instead.
 */
function StoryState({
  mapId,
  chapter,
  reveal,
  lang,
  onRetry,
}: {
  mapId: string;
  chapter: StoryChapter;
  reveal?: Reveal;
  lang: TemplateLang;
  onRetry: () => void;
}) {
  const ready = useMapReady(mapId);
  const t = storyLabels[lang];
  if (reveal?.status === "error") {
    return (
      <Alert
        role="alert"
        className={cn(
          "absolute inset-x-3 z-20 flex w-auto flex-col items-start gap-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200 sm:right-auto sm:max-w-sm",
          ready ? "top-3" : "bottom-3",
        )}
      >
        <AlertDescription>{revealError(reveal.caught, lang)}</AlertDescription>
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t.retry}
        </Button>
      </Alert>
    );
  }
  if (!ready || !reveal || !chapter.reveal) return null;
  // The key sits top-left: MapLibre's attribution owns the bottom edge.
  return (
    <div className="pointer-events-none absolute top-3 left-3 z-20 max-w-[calc(100%-1.5rem)]">
      {reveal.status === "loading" ? (
        <Badge role="status" variant="secondary">
          {t.revealing}
        </Badge>
      ) : (
        <Badge
          key={chapter.id}
          variant="outline"
          className="h-auto gap-1.5 bg-background/90 py-1 whitespace-normal tabular-nums backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-200"
        >
          <RevealKey reveal={chapter.reveal} />
          <span>
            {reveal.status === "route"
              ? routeSummary(reveal.meters, reveal.seconds, chapter.reveal.mode, lang)
              : `${chapter.reveal.kind === "isochrone" ? chapter.reveal.minutes.join(", ") : ""} ${t.minutes} ${t.modes[chapter.reveal.mode]}`}
          </span>
        </Badge>
      )}
    </div>
  );
}

/**
 * A key drawn the way the map draws it: a line for a route; for travel times, one disc per band,
 * nested and layered at the map's own opacities, so the inner band reads darker as it does there.
 */
function RevealKey({ reveal }: { reveal: StoryReveal }) {
  if (reveal.kind === "route") {
    return (
      <svg aria-hidden="true" viewBox="0 0 16 8" className="h-2 w-4 shrink-0 text-primary">
        <path d="M1 6 C5 6 6 2 9 2 S13 4 15 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  const largest = Math.max(...reveal.minutes);
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5 shrink-0 text-primary">
      {[...reveal.minutes]
        .sort((a, b) => b - a)
        .map((minutes) => (
          <circle
            key={minutes}
            cx="8"
            cy="8"
            r={(7 * minutes) / largest}
            fill="currentColor"
            fillOpacity={0.35 - ((Math.min(60, Math.max(10, minutes)) - 10) * 0.25) / 50}
          />
        ))}
    </svg>
  );
}

/** The camera and the active chapter's reveal. It renders inside <Map>, where useMap() sees it. */
function StoryStage({ mapId, chapter, reveal }: { mapId: string; chapter: StoryChapter; reveal?: Reveal }) {
  const map = useMap(mapId);
  const ready = useMapReady(mapId);
  const flown = useRef<{ map: unknown; target: string } | null>(null);
  const layerId = `unmap-story-${mapId.replace(/[^a-zA-Z0-9-]/g, "")}`;
  const points = useMemo(
    () => (reveal?.status === "route" ? reveal.coordinates : reveal?.status === "area" ? positionsOf(reveal.data) : []),
    [reveal],
  );

  // One flight per chapter. Before its reveal arrives the chapter's own camera; once it is here,
  // the camera frames it, route ends and every band in view with room to spare, at the chapter's
  // bearing and pitch. A reveal the story already has goes straight to its frame. Under reduced
  // motion the camera jumps.
  useEffect(() => {
    if (!map || !ready) return;
    let camera = { bearing: 0, pitch: 0, ...chapter.camera };
    const container = map.getContainer();
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (points.length > 0 && width > 0 && height > 0) {
      const framed = frameReveal(points, {
        width,
        height,
        bearing: camera.bearing,
        pitch: camera.pitch,
        padding: revealPadding(width, height),
        maxZoom: camera.zoom + 1,
      });
      if (framed) camera = { ...camera, ...framed };
    }
    const target = JSON.stringify(camera);
    if (flown.current?.map === map && flown.current.target === target) return;
    flown.current = { map, target };
    if (prefersReducedMotion()) map.jumpTo(camera);
    else map.flyTo({ ...camera, duration: FLY_MS, essential: false });
  }, [map, ready, chapter, points]);

  // The route draws in each time its chapter opens; whole at once under reduced motion.
  const routeKey = reveal?.status === "route" ? chapter.id : "";
  const [drawn, setDrawn] = useState<{ key: string; progress: number }>({ key: "", progress: 0 });
  useEffect(() => {
    if (!routeKey) {
      // Forget the last draw, so opening the chapter again starts from nothing, not a full line.
      setDrawn((current) => (current.key ? { key: "", progress: 0 } : current));
      return;
    }
    if (prefersReducedMotion() || typeof requestAnimationFrame !== "function") {
      setDrawn({ key: routeKey, progress: 1 });
      return;
    }
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      start ??= now;
      const progress = progressAt(now - start, ROUTE_DRAW_MS);
      setDrawn({ key: routeKey, progress });
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [routeKey]);
  const progress = drawn.key === routeKey ? drawn.progress : prefersReducedMotion() ? 1 : 0;

  const dot = <span aria-hidden="true" className="block size-3 rounded-full border-2 border-background bg-primary" />;
  if (reveal?.status === "route" && chapter.reveal?.kind === "route") {
    return (
      <>
        <RouteLine mapId={mapId} id={`${layerId}-route`} coordinates={reveal.coordinates} progress={progress} />
        <Marker mapId={mapId} lngLat={chapter.reveal.from} markerContent={dot} />
        <Marker mapId={mapId} lngLat={chapter.reveal.to} markerContent={dot} />
      </>
    );
  }
  if (reveal?.status === "area" && chapter.reveal?.kind === "isochrone") {
    return (
      <>
        <GeoJSONLayer mapId={mapId} id={`${layerId}-area`} data={reveal.data} fillPaint={AREA_FILL} circlePaint={false} />
        <Marker mapId={mapId} lngLat={chapter.reveal.center} markerContent={dot} />
      </>
    );
  }
  return null;
}
