"use client";

import { useEffect, useId, useState } from "react";
import { maplibregl } from "@unmap/maps";
import { Map } from "@/components/ui/map";
import { Marker } from "@/components/ui/marker-popup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { useMap, useMapReady } from "@/lib/map-context";
import { cn } from "@/lib/utils";
import {
  templateLabels,
  type TemplateContent,
  type TemplateLang,
  type TemplateBlockProps,
  type TemplatePlace,
} from "@/lib/map-template";

/** Shared composition copied with each block. Uses Base UI shadcn components. */
export function MapTemplate({
  apiKey,
  lang: language = "en",
  data,
  theme,
  className,
  guided = false,
}: Omit<TemplateBlockProps, "data"> & {
  data: TemplateContent;
  guided?: boolean;
}) {
  const mapId = useId();
  const t = templateLabels[language];
  const copy = data.content[language];
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedId, setSelectedId] = useState(data.places[0]?.id ?? "");
  const [overview, setOverview] = useState(0);
  const visible = data.places.filter(
    (place) =>
      (guided || category === "all" || String(place.category) === category) &&
      (guided ||
        `${place.content[language].name} ${place.content[language].detail}`
          .toLocaleLowerCase(language)
          .includes(query.trim().toLocaleLowerCase(language))),
  );
  // A filtered-out selection never leaves hidden details or an off-list map focus behind.
  const selected =
    visible.find((place) => place.id === selectedId) ?? visible[0];
  const index = selected
    ? data.places.findIndex((place) => place.id === selected.id)
    : -1;
  const selection = selected?.content[language];
  const select = (id: string) => {
    setSelectedId(id);
    setOverview(0);
  };

  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{copy.lead}</CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)]">
        <div className="order-2 flex min-w-0 flex-col gap-5 md:order-1">
          {!guided && (
            <>
              <Field>
                <FieldLabel htmlFor={`${mapId}-search`}>{t.search}</FieldLabel>
                <Input
                  id={`${mapId}-search`}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setOverview((value) => value + 1);
                  }}
                />
              </Field>
              <ToggleGroup
                aria-label={t.filters}
                value={[category]}
                onValueChange={(values) => {
                  if (typeof values[0] === "string") {
                    setCategory(values[0]);
                    setOverview((value) => value + 1);
                  }
                }}
                variant="outline"
                className="flex-wrap"
              >
                <ToggleGroupItem value="all">{t.all}</ToggleGroupItem>
                {copy.categories.map((name, i) => (
                  <ToggleGroupItem key={i} value={String(i)}>
                    {name}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <p role="status" className="text-sm text-muted-foreground">
                {visible.length}{" "}
                {visible.length === 1 ? t.location : t.locations}
              </p>
            </>
          )}
          {visible.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{t.empty}</EmptyTitle>
                <EmptyDescription>{t.emptyHint}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              {guided ? (
                <p role="status" className="text-sm text-muted-foreground">
                  {t.stop} {index + 1} {t.of} {data.places.length}
                </p>
              ) : (
                <div
                  className="flex max-h-56 flex-col gap-2 overflow-y-auto"
                  aria-label={copy.title}
                >
                  {visible.map((place) => (
                    <Button
                      key={place.id}
                      variant={
                        place.id === selected?.id ? "secondary" : "outline"
                      }
                      aria-pressed={place.id === selected?.id}
                      className="justify-start"
                      onClick={() => select(place.id)}
                    >
                      {place.content[language].name}
                    </Button>
                  ))}
                </div>
              )}
              {selected && selection && (
                <section
                  aria-label={t.details}
                  aria-live="polite"
                  className="flex flex-col gap-3"
                >
                  <Badge variant="secondary">
                    {copy.categories[selected.category]}
                  </Badge>
                  <h3 className="text-lg font-semibold">{selection.name}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {selection.detail}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selection.meta}
                  </p>
                </section>
              )}
              {guided ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={index <= 0}
                    onClick={() => select(data.places[index - 1]!.id)}
                  >
                    {t.previous}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={index < 0 || index >= data.places.length - 1}
                    onClick={() => select(data.places[index + 1]!.id)}
                  >
                    {t.next}
                  </Button>
                </div>
              ) : null}
            </>
          )}
          {!guided && (
            <Button
              variant="outline"
              onClick={() => {
                setQuery("");
                setCategory("all");
                setOverview((value) => value + 1);
              }}
            >
              {t.reset}
            </Button>
          )}
        </div>
        <div
          role="region"
          aria-label={`${t.map}: ${copy.title}`}
          className="order-1 h-80 min-w-0 md:order-2 md:h-[560px]"
        >
          <Map
            id={mapId}
            apiKey={apiKey}
            center={data.center}
            zoom={data.zoom}
            style={data.style}
            theme={theme}
            lang={language}
            accent="system"
          >
            <TemplateMapContents
              mapId={mapId}
              places={visible}
              selected={selected}
              onSelect={select}
              lang={language}
              overview={overview}
            />
          </Map>
        </div>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">{t.sample}</p>
      </CardFooter>
    </Card>
  );
}

/**
 * The map's own status line: loading, then a plain explanation if it never becomes ready.
 * `unavailable` gives the explanation at once, for a map that cannot load (no key, say).
 */
export function TemplateMapStatus({
  mapId,
  lang,
  unavailable = false,
  message,
}: {
  mapId: string;
  lang: TemplateLang;
  unavailable?: boolean;
  /** What to say when the map cannot load, in place of the place templates' own line. */
  message?: string;
}) {
  const ready = useMapReady(mapId);
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (ready || unavailable) return;
    const timer = window.setTimeout(() => setTimedOut(true), 25000);
    return () => window.clearTimeout(timer);
  }, [ready, unavailable]);
  if (ready && !unavailable) return null;
  return (
    <p
      role="status"
      className="absolute inset-x-0 top-4 px-4 text-center text-sm text-muted-foreground"
    >
      {timedOut || unavailable
        ? (message ?? templateLabels[lang].unavailable)
        : templateLabels[lang].loading}
    </p>
  );
}

/** True when the reader asked for less motion: the camera jumps and routes appear whole. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true
  );
}

function TemplateMapContents({
  mapId,
  places,
  selected,
  onSelect,
  lang,
  overview,
}: {
  mapId: string;
  places: TemplatePlace[];
  selected?: TemplatePlace;
  onSelect: (id: string) => void;
  lang: TemplateLang;
  overview: number;
}) {
  const map = useMap(mapId);
  const ready = useMapReady(mapId);
  // Keep the camera dependent on values, not the freshly filtered array on each render.
  const boundsKey = places
    .map((place) => place.coordinates.join(","))
    .join(";");
  const selectedKey = selected?.coordinates.join(",");
  useEffect(() => {
    if (!map || !ready || !boundsKey) return;
    const duration = prefersReducedMotion() ? 0 : 400;
    const frame = () => {
      map.resize();
      if (overview === 0 && selectedKey) {
        map.easeTo({
          center: selectedKey.split(",").map(Number) as [number, number],
          duration,
        });
      } else {
        const bounds = new maplibregl.LngLatBounds();
        boundsKey
          .split(";")
          .forEach((point) =>
            bounds.extend(point.split(",").map(Number) as [number, number]),
          );
        map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration });
      }
    };
    frame();
    const observer = new ResizeObserver(frame);
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map, ready, boundsKey, selectedKey, overview]);

  return (
    <>
      <TemplateMapStatus mapId={mapId} lang={lang} />
      {places.map((place, i) => (
        <Marker
          key={place.id}
          mapId={mapId}
          lngLat={place.coordinates}
          markerContent={
            <Button
              size="icon"
              variant={place.id === selected?.id ? "default" : "outline"}
              aria-label={place.content[lang].name}
              aria-pressed={place.id === selected?.id}
              onClick={() => onSelect(place.id)}
            >
              {i + 1}
            </Button>
          }
        />
      ))}
    </>
  );
}
