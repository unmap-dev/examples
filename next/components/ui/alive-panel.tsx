"use client";

/**
 * The alive-route-explorer block's panel: the title, start and destination, the routes as radio
 * rows, the route options (five dials, the extra time, more options), the button and the call
 * counter, and the "Why this route" card. Drawn from the state <AliveRouteExplorer> holds;
 * installed beside it. Edit freely.
 */

import { useId, useState, type ReactNode } from "react";
import { ArrowUpDown, ChevronDown, Coffee, Landmark, Navigation, Trees, Waves, VolumeX, type LucideIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EndPin, Illustration, StartDot } from "@/components/ui/alive-illustrations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Geocoder } from "@/components/ui/geocoder";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DEFAULT_WEIGHTS, type Weights } from "@/lib/alive-rank";
import { describe, type LngLat } from "@/lib/alive-signals";
import {
  ALIVE_COPY,
  ALIVE_MAP_ID,
  MAX_BUDGET,
  SAMPLE_COMMUTES,
  WEIGHT_KEYS,
  pictureFor,
  requestError,
  walkNotes,
  type AliveLang,
  type AlivePictures,
  type Endpoint,
  type Method,
  type RankedWalk,
  type Search,
  type WeightKey,
} from "@/lib/alive-view";

const WEIGHT_ICONS: Record<WeightKey, LucideIcon> = { green: Trees, water: Waves, quiet: VolumeX, life: Coffee, landmarks: Landmark };
/** The signals that come from /places/along, off when it is unavailable. */
const PLACE_SIGNALS: readonly WeightKey[] = ["life", "landmarks"];
/** The signals that come from the basemap tiles, off when they were not read. */
const BASEMAP_SIGNALS: readonly WeightKey[] = ["green", "water", "quiet"];
/** Routes listed before "Show N more". */
const LISTED = 3;

/** A search box for one end of the walk, 52 px tall, with the end's mark inside it. */
function EndField(props: { lang: AliveLang; apiKey: string; mark: ReactNode; placeholder: string; onPick: (at: LngLat, name: string) => void }) {
  return (
    <div className="relative min-w-0 flex-1">
      <span className="pointer-events-none absolute top-[26px] left-4 z-10 flex -translate-y-1/2 items-center">{props.mark}</span>
      <Geocoder
        apiKey={props.apiKey}
        mapId={ALIVE_MAP_ID}
        lang={props.lang}
        proximity="map"
        placeholder={props.placeholder}
        onSelect={(r) => props.onPick([r.lng, r.lat], r.name)}
        className="[&_[data-slot=input-group]]:h-13 [&_[data-slot=input-group]]:rounded-xl [&_input]:pl-11 [&_input]:text-base [&>p]:sr-only"
      />
    </div>
  );
}

export function AliveControls(props: {
  lang: AliveLang;
  apiKey: string;
  title?: string;
  badge?: string;
  commute: string;
  isSample: boolean;
  from: Endpoint;
  to: Endpoint;
  boxes: number;
  sampleId: string | null;
  onSample: (id: string) => void;
  onSwap: () => void;
  onFrom: (at: LngLat, name: string) => void;
  onTo: (at: LngLat, name: string) => void;
  weights: Weights;
  onWeights: (next: Weights) => void;
  budget: number;
  onBudget: (next: number) => void;
  minGain: number;
  onMinGain: (next: number) => void;
  method: Method;
  onMethod: (next: Method) => void;
  /** Street life and landmarks could not be read: their dials are off. */
  placesUnavailable: boolean;
  /** The basemap tiles were not read: the parks, water and traffic dials are off. */
  basemapUnavailable: boolean;
  routes: ReactNode;
  /** In the phone sheet, which scrolls as a whole: the button sticks to its bottom instead. */
  inSheet?: boolean;
  footer: ReactNode;
}) {
  const { lang } = props;
  const copy = ALIVE_COPY[lang];
  const uid = useId();
  const [options, setOptions] = useState(true);
  const [more, setMore] = useState(false);
  return (
    <>
      <div className={["flex flex-col gap-6 p-7", props.inSheet ? "" : "min-h-0 flex-1 overflow-y-auto overscroll-contain"].join(" ")}>
        <header className="flex flex-col gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Navigation className="size-5 fill-current" />
            </span>
            <h2 className="min-w-0 truncate text-3xl leading-tight font-extrabold tracking-tight">{props.title ?? copy.title}</h2>
            {props.badge ? (
              <Badge variant="secondary" className="shrink-0 rounded-full px-2.5 font-bold">
                {props.badge}
              </Badge>
            ) : null}
          </div>
          <p className="text-base text-muted-foreground">{copy.subtitle}</p>
        </header>

        <section className="flex flex-col gap-3" aria-label={`${copy.start}, ${copy.destination}`}>
          <div className="flex items-center gap-2">
            <div key={props.boxes} className="flex min-w-0 flex-1 flex-col gap-2.5">
              <EndField lang={lang} apiKey={props.apiKey} mark={<StartDot className="size-3.5" />} placeholder={props.from.name ? copy.from(props.from.name) : copy.start} onPick={props.onFrom} />
              <EndField lang={lang} apiKey={props.apiKey} mark={<EndPin className="h-5" />} placeholder={props.to.name ? copy.to(props.to.name) : copy.destination} onPick={props.onTo} />
            </div>
            <Button type="button" variant="ghost" size="icon-lg" aria-label={copy.swap} onClick={props.onSwap}>
              <ArrowUpDown />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">{copy.samples}</span>
            <ToggleGroup
              aria-label={copy.samples}
              variant="outline"
              size="sm"
              spacing={1}
              value={props.sampleId ? [props.sampleId] : []}
              onValueChange={(next: unknown[]) => {
                const id = next[0];
                if (typeof id === "string") props.onSample(id);
              }}
            >
              {SAMPLE_COMMUTES.map((s) => (
                <ToggleGroupItem key={s.id} value={s.id} title={s.name[lang]} className="rounded-full px-3">
                  {s.ends[lang][0]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {props.isSample ? <Badge variant="secondary">{copy.sample}</Badge> : null}
          </div>
        </section>

        <Separator />
        {props.routes}
        <Separator />

        <Collapsible open={options} onOpenChange={setOptions} className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-lg font-bold">{copy.routeOptions}</h3>
            <CollapsibleTrigger
              render={
                <Button type="button" variant="link" className="h-auto px-0 text-base">
                  {options ? copy.hide : copy.show}
                </Button>
              }
            />
          </div>
          <CollapsibleContent className="flex flex-col gap-5">
            <FieldSet className="gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <FieldLegend className="mb-0 text-base font-semibold">{copy.dials}</FieldLegend>
                <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={() => props.onWeights(DEFAULT_WEIGHTS)}>
                  {copy.reset}
                </Button>
              </div>
              {WEIGHT_KEYS.map((key) => (
                <Dial
                  key={key}
                  icon={WEIGHT_ICONS[key]}
                  label={copy.weights[key]}
                  value={props.weights[key]}
                  shown={props.weights[key].toLocaleString(lang === "fr" ? "fr-CA" : "en-CA", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  min={0}
                  max={2}
                  step={0.1}
                  disabled={(props.placesUnavailable && PLACE_SIGNALS.includes(key)) || (props.basemapUnavailable && BASEMAP_SIGNALS.includes(key))}
                  onChange={(v) => props.onWeights({ ...props.weights, [key]: v })}
                />
              ))}
              {props.basemapUnavailable ? <p className="text-xs text-muted-foreground">{copy.dialsBasemapUnavailable}</p> : null}
              {props.placesUnavailable ? <p className="text-xs text-muted-foreground">{copy.dialsUnavailable}</p> : null}
            </FieldSet>

            <Dial label={copy.budget} value={props.budget} shown={copy.budgetValue(props.budget)} min={0} max={MAX_BUDGET} step={0.5} onChange={props.onBudget} wide />

            <Collapsible open={more} onOpenChange={setMore} className="flex flex-col gap-3">
              <CollapsibleTrigger
                render={
                  <Button type="button" variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground">
                    <ChevronDown className={["transition-transform motion-reduce:transition-none", more ? "rotate-180" : ""].join(" ")} />
                    {more ? copy.fewer : copy.more}
                  </Button>
                }
              />
              <CollapsibleContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <Dial label={copy.minGain} value={props.minGain} shown={copy.minGainValue(props.minGain)} min={0} max={20} step={1} onChange={props.onMinGain} wide />
                  <p className="text-xs text-muted-foreground">{copy.minGainHint}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <span id={`${uid}-method`} className="text-sm font-medium">
                    {copy.method}
                  </span>
                  <ToggleGroup
                    aria-labelledby={`${uid}-method`}
                    variant="outline"
                    size="sm"
                    value={[props.method]}
                    onValueChange={(next: unknown[]) => {
                      const m = next[0];
                      if (m === "both" || m === "detour" || m === "graph") props.onMethod(m);
                    }}
                  >
                    {(["both", "detour", "graph"] as const).map((m) => (
                      <ToggleGroupItem key={m} value={m}>
                        {copy.methodFilter[m]}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CollapsibleContent>
        </Collapsible>
      </div>
      <div className={["flex flex-col gap-2 bg-card px-7 pt-4 pb-6", props.inSheet ? "sticky bottom-0 z-10 border-t" : ""].join(" ")}>
        {props.footer}
        <p className="text-center text-xs text-muted-foreground">{copy.sources}</p>
      </div>
    </>
  );
}

/** One labelled slider with its value beside it. */
function Dial(props: {
  label: string;
  value: number;
  shown: string;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
  icon?: LucideIcon;
  wide?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  const Icon = props.icon;
  const change = (v: number | readonly number[]) => props.onChange(typeof v === "number" ? v : (v[0] ?? props.value));
  if (props.wide) {
    return (
      <div className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <FieldLabel id={id} className="text-base font-bold">
            {props.label}
          </FieldLabel>
          <span className="text-sm font-semibold text-primary tabular-nums">{props.shown}</span>
        </div>
        <Slider aria-labelledby={id} min={props.min} max={props.max} step={props.step} value={[props.value]} onValueChange={change} />
      </div>
    );
  }
  return (
    <div className={["grid grid-cols-[1.25rem_8.5rem_minmax(0,1fr)_2rem] items-center gap-2.5", props.disabled ? "opacity-50" : ""].join(" ")}>
      {Icon ? <Icon aria-hidden="true" className="size-4 text-muted-foreground" /> : <span />}
      <FieldLabel id={id} className="text-sm font-normal">
        {props.label}
      </FieldLabel>
      <Slider aria-labelledby={id} disabled={props.disabled} min={props.min} max={props.max} step={props.step} value={[props.value]} onValueChange={change} />
      <span className="text-right text-xs text-muted-foreground tabular-nums">{props.shown}</span>
    </div>
  );
}

export function AliveRoutesList(props: {
  lang: AliveLang;
  search: Search;
  rows: RankedWalk[];
  pickId: string | null;
  fastestId: string | null;
  shownId: string | null;
  budget: number;
  pictures?: AlivePictures;
  onSelect: (id: string) => void;
  /** A row under the pointer or focus, to draw that walk on the map; null when it leaves. */
  onHover: (id: string | null) => void;
  onRetry: () => void;
}) {
  const { lang, search } = props;
  const copy = ALIVE_COPY[lang];
  const id = useId();
  const [all, setAll] = useState(false);
  const result = search.state === "done" ? search.result : null;
  const fastest = props.rows.find((row) => row.id === props.fastestId);
  const notes = result ? walkNotes(result, fastest?.distanceM ?? null, lang).notes : [];
  const known = { basemap: result?.basemapAvailable ?? true };
  // The pick, the fastest, then the rest best first, those you would take before those over your
  // extra time or short on gain.
  const rank = (row: RankedWalk) => (row.id === props.pickId ? 0 : row.id === props.fastestId ? 1 : row.eligible ? 2 : 3);
  const ordered = [...props.rows].sort((a, b) => rank(a) - rank(b));
  // The shown walk always stays listed, even when it ranks past the first three.
  const listed = all ? ordered : ordered.filter((row, index) => index < LISTED || row.id === props.shownId);
  const hidden = ordered.length - listed.length;
  return (
    <section className="flex flex-col gap-3" aria-labelledby={id}>
      <h3 id={id} className="text-lg font-bold">
        {copy.routes}
      </h3>
      {search.state === "idle" ? (
        <div className="flex items-center gap-3 rounded-xl border border-dashed p-3">
          <Illustration
            kind="quiet"
            lang={lang}
            src={pictureFor({ kind: "quiet", places: [] }, props.pictures, "empty")}
            alt={copy.pictureAlt("quiet")}
            className="h-16 w-24 shrink-0 rounded-lg"
          />
          <p className="text-sm text-muted-foreground">{copy.empty}</p>
        </div>
      ) : null}
      {search.state === "loading" ? (
        <p aria-live="polite" className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          {copy.going}
        </p>
      ) : null}
      {search.state === "error" ? (
        <Alert variant="destructive" className="motion-safe:animate-in motion-safe:fade-in-0">
          <AlertTitle>{copy.errorTitle}</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            <span>{requestError(search.error, lang)}</span>
            <Button type="button" variant="outline" size="sm" onClick={props.onRetry}>
              {copy.retry}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {notes.map((note) => (
        <Alert key={note} role="status">
          <AlertDescription>{note}</AlertDescription>
        </Alert>
      ))}
      {result && props.pickId === props.fastestId && !result.tooShort ? (
        <p className="text-sm text-muted-foreground">{copy.alreadyLiveliest(props.budget)}</p>
      ) : null}
      {result ? (
        <RadioGroup
          aria-label={copy.routes}
          value={props.shownId}
          onValueChange={(v: unknown) => typeof v === "string" && props.onSelect(v)}
          className="gap-2"
          onMouseLeave={() => props.onHover(null)}
        >
          {listed.map((row) => {
            const isFastest = row.id === props.fastestId;
            const isPick = row.id === props.pickId;
            const title = isPick && !isFastest ? copy.livelier : isFastest ? copy.fastest : copy.another;
            const reason = row.eligible || isFastest ? null : row.extraMin > props.budget + 1e-9 ? copy.overBudget : copy.underGain;
            const shown = row.id === props.shownId;
            return (
              <label
                key={row.id}
                title={[row.method === "detour" || row.method === "graph" ? copy.methods[row.method] : null, reason ?? describe(row.scores, lang, known)].filter(Boolean).join(". ")}
                onMouseEnter={() => props.onHover(row.id)}
                onFocus={() => props.onHover(row.id)}
                onBlur={() => props.onHover(null)}
                className={[
                  "flex h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 text-base transition-colors motion-reduce:transition-none",
                  shown ? "border-2 border-primary bg-primary/10" : "hover:bg-muted/60",
                  reason ? "opacity-60" : "",
                ].join(" ")}
              >
                <RadioGroupItem value={row.id} data-route-id={row.id} />
                <span className="min-w-0 truncate font-semibold">{title}</span>
                {row.method === "detour" || row.method === "graph" ? (
                  // Below 400 px the row keeps the name and the time; the method moves to the row's title.
                  <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[11px] max-[399px]:hidden">
                    {copy.methods[row.method]}
                  </Badge>
                ) : null}
                {reason ? <span className="sr-only">{reason}</span> : null}
                <span className="ml-auto flex shrink-0 items-baseline gap-1.5 tabular-nums">
                  <span className={shown ? "font-semibold text-primary" : "font-medium"}>{copy.minutes(row.durationS)}</span>
                  {isFastest ? null : <span className="text-sm text-muted-foreground">{copy.extra(row.extraMin)}</span>}
                </span>
              </label>
            );
          })}
        </RadioGroup>
      ) : null}
      {result && (hidden > 0 || all) && ordered.length > LISTED ? (
        <Button type="button" variant="link" className="h-auto w-fit px-0" onClick={() => setAll((a) => !a)}>
          {all ? copy.showFewer : copy.showMore(hidden)}
        </Button>
      ) : null}
    </section>
  );
}

export function AliveGoButton({ lang, busy, calls, onGo }: { lang: AliveLang; busy: boolean; calls: number | null; onGo: () => void }) {
  const copy = ALIVE_COPY[lang];
  return (
    <>
      <Button type="button" size="lg" className="h-14 w-full rounded-full text-lg font-semibold" aria-busy={busy} onClick={onGo}>
        {busy ? <Spinner aria-hidden="true" /> : null}
        {copy.go}
      </Button>
      <p className="text-center text-sm text-muted-foreground tabular-nums">{calls === null ? copy.callsBefore : copy.calls(calls)}</p>
    </>
  );
}

export function AliveWhyCard(props: {
  lang: AliveLang;
  shown: RankedWalk;
  fastest: RankedWalk;
  shownScore: number;
  fastestScore: number;
  /** Street life and landmarks could not be read: say so rather than draw an empty bar. */
  placesUnavailable: boolean;
  /** The basemap tiles were not read: parks, water and traffic say so rather than draw a guess. */
  basemapUnavailable: boolean;
  defaultOpen: boolean;
}) {
  const { lang, shown, fastest } = props;
  const copy = ALIVE_COPY[lang];
  const [open, setOpen] = useState(props.defaultOpen);
  return (
    <Card className="gap-0 overflow-hidden rounded-2xl py-0 shadow-lg motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          render={
            <Button type="button" variant="ghost" className="h-auto w-full justify-between gap-3 px-4 py-3 text-left whitespace-normal">
              <span className="flex min-w-0 flex-col">
                <span className="text-base font-bold">{copy.why}</span>
                <span className="text-xs font-normal text-muted-foreground tabular-nums">
                  {copy.aliveness(Math.round(props.shownScore * 100), Math.round(props.fastestScore * 100))}
                </span>
              </span>
              <ChevronDown aria-hidden="true" className={["transition-transform motion-reduce:transition-none", open ? "rotate-180" : ""].join(" ")} />
            </Button>
          }
        />
        <CollapsibleContent className="flex flex-col gap-3 px-4 pb-4">
          <p className="text-sm text-muted-foreground first-letter:uppercase">{describe(shown.scores, lang, { basemap: !props.basemapUnavailable })}</p>
          <dl className="grid grid-cols-[6rem_minmax(0,1fr)_2.75rem] items-center gap-x-2.5 gap-y-2 text-sm">
            {WEIGHT_KEYS.map((key) => {
              const off = (props.placesUnavailable && PLACE_SIGNALS.includes(key)) || (props.basemapUnavailable && BASEMAP_SIGNALS.includes(key));
              const value = shown.scores[key];
              const base = fastest.scores[key];
              return (
                <div key={key} className="contents">
                  <dt>{copy.signals[key]}</dt>
                  {off ? (
                    <dd className="col-span-2 text-muted-foreground">{copy.signalUnavailable}</dd>
                  ) : (
                    <>
                      <dd aria-hidden="true" className="relative h-2 rounded-full bg-muted">
                        <span className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${Math.round(value * 100)}%` }} />
                        <span className="absolute -inset-y-1 w-0.5 rounded-full bg-muted-foreground" style={{ left: `calc(${Math.round(base * 100)}% - 1px)` }} />
                      </dd>
                      <dd className="text-right text-muted-foreground tabular-nums">{Math.round(value * 100)}%</dd>
                    </>
                  )}
                </div>
              );
            })}
          </dl>
          <p className="text-xs text-muted-foreground">{copy.barsKey}</p>
          {shown.method === "graph" ? <p className="text-xs text-muted-foreground">{copy.graphNote}</p> : null}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
