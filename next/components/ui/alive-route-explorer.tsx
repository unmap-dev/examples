"use client";

/**
 * <AliveRouteExplorer> - walking directions that trade a minute for a nicer walk. Pick a start and
 * a destination (or one of three Calgary samples), get directions, and the block finds the fastest
 * walk, then detours past parks, the river, streets away from traffic, cafés and public art, and scores them
 * all. Five dials say what makes a walk alive to you and how much extra time you will take; moving
 * them re-ranks the walks at once and calls nothing. The pick is drawn in your --primary over a
 * --card casing, the fastest walk dashed in your --muted-foreground, with a time bubble beside each,
 * up to three cards for what the pick passes, and a "Why this route" card with the five scores. A
 * full-bleed map with a floating panel, a bottom sheet on a phone.
 *
 * Props: `apiKey`, `lang` ("en" | "fr"), `className`, `initial` ({ from, to, label? }), `title`
 * (the panel heading, default "Find a livelier walk"), `badge` (a short tag beside it, such as
 * "BETA"), `pictures` (image URLs for the highlight cards, keyed by highlight kind or place
 * category id, each a list of variants; see `AlivePictures`), and `onEndsChange` (called with the
 * start and destination whenever the reader changes them, not at mount, so a page can keep them in
 * its URL). A card shows its places' most common category's picture, else its kind's, else the
 * drawn illustration; the variant is chosen from the place so a walk keeps its picture.
 *
 * Honest about its sources: the signals are parks, water and streets from the basemap tiles, and
 * cafés, shops and landmarks from unmap places. When `/places/along` is unavailable the ranking
 * uses parks, water and streets away from traffic only, and when the basemap tiles were not read
 * it leaves those three out; either way their dials are off, the Why card says "Unavailable" and
 * the panel says so. A walk found on the walking
 * graph says it was found in your browser and snapped by map matching. Every picture, drawn or
 * passed in, is tagged "Illustration", and a passed-in one has alt text saying it is AI-generated.
 *
 * Metering: every authenticated request is one call. "Get directions" spends at most 40: one
 * `/route` for the fastest walk, up to 24 basemap tiles read for scoring (not the map's own display
 * tiles), two `POST /places/along`, then `/route` pairs for detours and `/match` for walking-graph
 * paths, within the budget. The answer is kept per start and destination, so asking again costs
 * nothing, unless a source was unavailable, and the dials never call. The search box
 * calls `/geocode/autocomplete` as you type; the map makes its own style and tile requests.
 *
 * Composes the map, map-context, map-layers and geocoder items on your shadcn Card, Button, Field,
 * Slider, ToggleGroup, RadioGroup, Badge, Alert, Spinner, Separator, Sheet, Popover and Collapsible. Installed by
 * `npx shadcn add` with its page at app/alive-route-explorer/page.tsx. Edit freely.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Unmap } from "@unmap/sdk";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AliveCamera, AliveLayers, AliveOverlay } from "@/components/ui/alive-map";
import { AliveControls, AliveGoButton, AliveRoutesList, AliveWhyCard } from "@/components/ui/alive-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Map } from "@/components/ui/map";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { DEFAULT_WEIGHTS, rank, type Weights } from "@/lib/alive-rank";
import type { LngLat } from "@/lib/alive-signals";
import {
  ALIVE_COPY,
  ALIVE_MAP_ID,
  DEFAULT_BUDGET,
  DEFAULT_MIN_GAIN,
  KEY_URL,
  PHONE_QUERY,
  SAMPLE_COMMUTES,
  NARROW_QUERY,
  cacheable,
  isAbort,
  requestError,
  usableWeights,
  walkDeps,
  walkNotes,
  type AliveLang,
  type AlivePictures,
  type Endpoint,
  type Method,
  type Search,
} from "@/lib/alive-view";
import { findWalks, type Candidate, type WalkResult } from "@/lib/alive-walks";

// The block's words, samples and helpers live in alive-view.ts; re-exported here so the block is
// one import.
export * from "@/lib/alive-view";
export { Illustration, type IllustrationKind } from "@/components/ui/alive-illustrations";

/** True while a media query matches (false on the server and where matchMedia is missing). */
function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const list = typeof window !== "undefined" ? window.matchMedia?.(query) : undefined;
      list?.addEventListener?.("change", notify);
      return () => list?.removeEventListener?.("change", notify);
    },
    () => (typeof window !== "undefined" && window.matchMedia?.(query)?.matches === true),
    () => false,
  );
}

// ---------------------------------------------------------------------------------------------
// The block.

export interface AliveRouteExplorerProps {
  /** Your unmap key. Without one the block shows how to get one and calls nothing. */
  apiKey: string;
  lang?: AliveLang;
  className?: string;
  /** Where the walk starts and ends. Default: the Bridgeland sample. */
  initial?: { from: LngLat; to: LngLat; label?: string };
  /** The panel's heading. Default: "Find a livelier walk" (fr "Trouver une marche plus vivante"). */
  title?: string;
  /** A short tag beside the heading, such as "BETA". None by default. */
  badge?: string;
  /**
   * Pictures for the highlight cards, by highlight kind or place category id, each a list of URLs to
   * vary between walks (see `AlivePictures`). Shown tagged "Illustration" with AI-generated alt
   * text; without one a card draws its inline illustration.
   */
  pictures?: AlivePictures;
  /**
   * Called with the start and destination each time the reader changes them (a sample, a search,
   * the swap), never at mount. A page can write them into its URL so a link opens the same walk.
   */
  onEndsChange?: (ends: { from: LngLat; to: LngLat }) => void;
}

const same = (a: LngLat, b: LngLat) => a[0] === b[0] && a[1] === b[1];
const pairKey = (a: LngLat, b: LngLat) => `${a.join(",")}|${b.join(",")}`;

function startingPoint(initial: AliveRouteExplorerProps["initial"]) {
  const sample = initial ? SAMPLE_COMMUTES.find((s) => same(s.from, initial.from) && same(s.to, initial.to)) : SAMPLE_COMMUTES[0]!;
  return { sample: sample?.id ?? null, from: initial?.from ?? sample!.from, to: initial?.to ?? sample!.to, label: initial?.label ?? null };
}

export function AliveRouteExplorer({ apiKey, lang = "en", className, initial, title, badge, pictures, onEndsChange }: AliveRouteExplorerProps) {
  const copy = ALIVE_COPY[lang];
  const hasKey = apiKey.trim() !== "";
  const [opening] = useState(() => startingPoint(initial));
  const [sampleId, setSampleId] = useState(opening.sample);
  const [label] = useState(opening.label);
  const [ends, setEnds] = useState<{ from: LngLat; to: LngLat; names: [string | null, string | null] }>({
    from: opening.from,
    to: opening.to,
    names: [null, null],
  });
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [budget, setBudget] = useState(DEFAULT_BUDGET);
  const [minGain, setMinGain] = useState(DEFAULT_MIN_GAIN);
  const [method, setMethod] = useState<Method>("both");
  const [search, setSearch] = useState<Search>({ state: "idle" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  /** The walk whose cards found no room at the first framing, so the camera gave it wider margins. */
  const [roomyFor, setRoomyFor] = useState<string | null>(null);
  /** Remounts the search boxes when the endpoints change by any other way than typing. */
  const [boxes, setBoxes] = useState(0);
  const cache = useRef(new globalThis.Map<string, WalkResult>());
  const flight = useRef<AbortController | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const whyRef = useRef<HTMLDivElement | null>(null);
  const phone = useMedia(PHONE_QUERY);
  // The Why card opens by default on a wide screen (1280 px or more), where it has room.
  const narrow = useMedia(NARROW_QUERY);

  const deps = useMemo(
    () => (hasKey ? walkDeps(new Unmap({ key: apiKey, fetch: (input, init) => globalThis.fetch(input, init) }), apiKey) : null),
    [apiKey, hasKey],
  );
  useEffect(() => () => flight.current?.abort(), []);

  // Tell the page when the ends move, once per change and not for the opening walk.
  const announced = useRef(pairKey(opening.from, opening.to));
  const onEnds = useRef(onEndsChange);
  onEnds.current = onEndsChange;
  useEffect(() => {
    const key = pairKey(ends.from, ends.to);
    if (key === announced.current) return;
    announced.current = key;
    onEnds.current?.({ from: ends.from, to: ends.to });
  }, [ends.from, ends.to]);

  const sample = SAMPLE_COMMUTES.find((s) => s.id === sampleId) ?? null;
  const from: Endpoint = { at: ends.from, name: ends.names[0] ?? sample?.ends[lang][0] ?? null };
  const to: Endpoint = { at: ends.to, name: ends.names[1] ?? sample?.ends[lang][1] ?? null };
  const commute = sample ? sample.name[lang] : (label ?? copy.commute(from.name ?? copy.start, to.name ?? copy.destination));

  const result = search.state === "done" ? search.result : null;
  const placesUnavailable = result ? !result.placesAvailable : false;
  const basemapUnavailable = result ? !result.basemapAvailable : false;
  const ranked = useMemo(() => {
    if (!result) return null;
    const visible = result.candidates.filter((c) => method === "both" || c.method === "fastest" || c.method === method);
    // A signal whose source could not be read is unknown, not zero: it leaves the ranking.
    return rank(visible, usableWeights(weights, result), budget, minGain / 100);
  }, [result, method, weights, budget, minGain]);
  const fastest = ranked?.rows.find((row) => row.method === "fastest") ?? null;
  const pick = ranked?.rows.find((row) => row.id === ranked.pickId) ?? null;
  const shown = ranked?.rows.find((row) => row.id === selectedId) ?? pick;
  // Once per walk: when a card cannot fit at the first framing, frame again with wider margins.
  const walkKey = shown ? `${pairKey(ends.from, ends.to)}:${shown.id}` : null;
  const crowded = useCallback(() => setRoomyFor(walkKey), [walkKey]);

  function moveEnds(next: typeof ends, nextSample: typeof sampleId) {
    flight.current?.abort();
    setEnds(next);
    setSampleId(nextSample);
    setSelectedId(null);
    setSearch({ state: "idle" });
  }
  function pickSample(id: string) {
    const next = SAMPLE_COMMUTES.find((s) => s.id === id);
    if (!next) return;
    moveEnds({ from: next.from, to: next.to, names: [null, null] }, next.id);
    setBoxes((n) => n + 1);
  }
  function swap() {
    moveEnds({ from: ends.to, to: ends.from, names: [to.name, from.name] }, null);
    setBoxes((n) => n + 1);
  }
  function retune(update: () => void) {
    update();
    setSelectedId(null);
  }

  function run() {
    if (!deps) return;
    flight.current?.abort();
    setSelectedId(null);
    const cached = cache.current.get(pairKey(ends.from, ends.to));
    if (cached) {
      setSearch({ state: "done", result: cached });
      return;
    }
    const controller = new AbortController();
    flight.current = controller;
    setSearch({ state: "loading" });
    const key = pairKey(ends.from, ends.to);
    findWalks(deps, ends.from, ends.to, controller.signal).then(
      (found) => {
        if (controller.signal.aborted) return;
        // A result an outage degraded is not kept, so asking again tries the sources again.
        if (cacheable(found)) cache.current.set(key, found);
        setSearch({ state: "done", result: found });
      },
      (caught: unknown) => {
        if (controller.signal.aborted || isAbort(caught)) return;
        setSearch({ state: "error", error: caught });
      },
    );
  }

  if (!hasKey) {
    // Where the map would be: the block's gutter, the Alert at a readable width, the first action first.
    return (
      <div
        data-unmap-block="alive-route-explorer"
        data-state="no-key"
        className={["flex h-full min-h-[480px] items-start justify-center bg-muted/40 p-4 sm:items-center sm:p-6", className].filter(Boolean).join(" ")}
      >
        <Alert role="alert" className="w-full max-w-md motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
          <AlertTitle className="line-clamp-none">{copy.noKeyTitle}</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <a className="font-medium text-primary underline underline-offset-4" href={KEY_URL} target="_blank" rel="noreferrer">
              {copy.getKey}
            </a>
            <p>{copy.noKey}</p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const titleOf = (row: Candidate) => (row.id === pick?.id && row.id !== fastest?.id ? copy.livelier : row.id === fastest?.id ? copy.fastest : copy.another);
  const said = shown && fastest ? copy.said(titleOf(shown), copy.minutes(shown.durationS), shown.id === fastest.id ? null : copy.extra(shown.extraMin)) : "";
  const busy = search.state === "loading";
  const partial = result ? walkNotes(result, fastest?.distanceM ?? null, lang).partial : false;

  const why = shown && fastest && ranked ? (
    <AliveWhyCard
      lang={lang}
      shown={shown}
      fastest={fastest}
      shownScore={shown.score}
      fastestScore={fastest.score}
      placesUnavailable={placesUnavailable}
      basemapUnavailable={basemapUnavailable}
      defaultOpen={!narrow}
    />
  ) : null;
  const controls = (
    <AliveControls
      lang={lang}
      inSheet={phone}
      apiKey={apiKey}
      title={title}
      badge={badge}
      placesUnavailable={placesUnavailable}
      basemapUnavailable={basemapUnavailable}
      commute={commute}
      isSample={sample !== null}
      from={from}
      to={to}
      boxes={boxes}
      sampleId={sampleId}
      onSample={pickSample}
      onSwap={swap}
      onFrom={(at, name) => moveEnds({ ...ends, from: at, names: [name, to.name] }, null)}
      onTo={(at, name) => moveEnds({ ...ends, to: at, names: [from.name, name] }, null)}
      weights={weights}
      onWeights={(next) => retune(() => setWeights(next))}
      budget={budget}
      onBudget={(next) => retune(() => setBudget(next))}
      minGain={minGain}
      onMinGain={(next) => retune(() => setMinGain(next))}
      method={method}
      onMethod={(next) => retune(() => setMethod(next))}
      routes={
        <>
          <AliveRoutesList
            lang={lang}
            search={search}
            rows={ranked?.rows ?? []}
            pickId={pick?.id ?? null}
            fastestId={fastest?.id ?? null}
            shownId={shown?.id ?? null}
            budget={budget}
            pictures={pictures}
            onSelect={setSelectedId}
            onHover={setHoveredId}
            onRetry={run}
          />
          {phone ? why : null}
        </>
      }
      footer={<AliveGoButton lang={lang} busy={busy} calls={result?.calls ?? null} onGo={run} />}
    />
  );

  return (
    <div data-unmap-block="alive-route-explorer" className={["relative h-full min-h-[480px]", className].filter(Boolean).join(" ")}>
      <Map
        id={ALIVE_MAP_ID}
        apiKey={apiKey}
        lang={lang}
        style="tropic"
        center={[(opening.from[0] + opening.to[0]) / 2, (opening.from[1] + opening.to[1]) / 2]}
        zoom={14}
        className="h-full"
      >
        <AliveLayers rows={ranked?.rows ?? []} shownId={shown?.id ?? null} fastestId={fastest?.id ?? null} hoveredId={hoveredId} onSelect={setSelectedId} />
        <AliveCamera
          roomy={!!walkKey && roomyFor === walkKey}
          frame={shown && fastest ? [...shown.coords, ...fastest.coords] : [ends.from, ends.to]}
          frameKey={shown ? `walks:${pairKey(ends.from, ends.to)}:${shown.id}` : `ends:${pairKey(ends.from, ends.to)}`}
          panelRef={panelRef}
          phone={phone}
        />
        <AliveOverlay
          lang={lang}
          shown={shown}
          fastest={fastest}
          isPick={!!shown && shown.id === pick?.id}
          phone={phone}
          from={{ at: ends.from, label: from.name ?? copy.start }}
          to={{ at: ends.to, label: to.name ?? copy.destination }}
          pictures={pictures}
          panelRef={panelRef}
          whyRef={whyRef}
          onSelect={setSelectedId}
          onCrowded={crowded}
        />
        <p aria-live="polite" className="sr-only">
          {said}
        </p>
        {/* z-20: above the map item's loading overlay (z-10), which would otherwise take the first
            clicks on the panel while the style loads; a search needs no map. */}
        {phone ? (
          <div ref={panelRef} className="absolute inset-x-4 bottom-10 z-20 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-300">
            <Card className="gap-3 rounded-3xl p-4 shadow-xl">
              <div className="flex min-w-0 items-center gap-2">
                <p className="min-w-0 truncate text-sm font-medium">{commute}</p>
                {sample ? <Badge variant="secondary">{copy.sample}</Badge> : null}
              </div>
              {search.state === "error" ? (
                <p role="alert" className="text-sm text-destructive">
                  {requestError(search.error, lang)}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground tabular-nums">{said || (busy ? copy.going : copy.noResult)}</p>
              )}
              {partial ? <p className="text-xs text-muted-foreground">{copy.partial}</p> : null}
              <div className="flex gap-2">
                <Button type="button" className="h-11 flex-1 rounded-full" aria-busy={busy} onClick={run}>
                  {busy ? <Spinner aria-hidden="true" /> : null}
                  {copy.go}
                </Button>
                <Sheet>
                  <SheetTrigger
                    render={
                      <Button type="button" variant="outline" className="h-11 rounded-full">
                        {copy.options}
                      </Button>
                    }
                  />
                  <SheetContent side="bottom" className="max-h-[85dvh] gap-0 overflow-y-auto p-0">
                    <SheetTitle className="sr-only">{copy.options}</SheetTitle>
                    <SheetDescription className="sr-only">{copy.description}</SheetDescription>
                    {controls}
                  </SheetContent>
                </Sheet>
              </div>
            </Card>
          </div>
        ) : (
          <>
            {/* A card floating on the map at the gutter, scrolling inside itself; the button stays in reach. */}
            <div
              ref={panelRef}
              className="absolute top-6 bottom-6 left-6 z-20 flex w-[440px] max-w-[calc(100%-3rem)] flex-col motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-4 motion-safe:duration-300"
            >
              <Card className="flex max-h-full min-h-0 flex-1 flex-col gap-0 overflow-hidden rounded-3xl py-0 shadow-2xl">{controls}</Card>
            </div>
            {why ? (
              <div ref={whyRef} className="absolute right-6 bottom-10 z-20 w-80 max-w-[calc(100%-32rem)]">
                {why}
              </div>
            ) : null}
          </>
        )}
      </Map>
    </div>
  );
}
