<script lang="ts">
// --- census-choropleth helpers (kept identical across both lanes) ---
export type CensusLang = "en" | "fr";

/** What the map colours: persons, percent change since 2016, or persons per km². */
export type CensusMetric = "population" | "change" | "density";

export const CENSUS_METRICS: readonly CensusMetric[] = ["population", "change", "density"];

/** The three counts a row carries; every metric is derived from them. */
export interface CensusCounts {
  population: number;
  population2016: number;
  landArea: number;
}

/** A box on screen, as getBoundingClientRect() gives it. */
export interface CensusRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** Camera padding in pixels, as fitBounds takes it. */
export interface CensusPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** The block's own map id, so a map elsewhere on the page never answers for it. */
export const CENSUS_MAP_ID = "census-choropleth";
/** The GeoJSON source and its two layers. */
export const CENSUS_SOURCE_ID = "census-choropleth";
export const CENSUS_FILL_ID = "census-choropleth-fill";
export const CENSUS_LINE_ID = "census-choropleth-line";

/** How many quantile classes the map is split into. */
export const CLASS_COUNT = 5;

/** A shape with no value joined draws nothing, so a missing number never reads as the lowest class. */
export const MISSING_FILL = "rgba(0, 0, 0, 0)";

/** All of Canada: where the map opens before it frames the provinces clear of the panel. */
export const CANADA_VIEW: { center: [number, number]; zoom: number } = { center: [-96, 62], zoom: 2.3 };

/** The provinces and territories, for fitBounds; the north edge spares the far Arctic islands most of the height. */
export const CANADA_BOUNDS: [[number, number], [number, number]] = [
  [-141, 41.7],
  [-52.6, 76],
];

/** The panel's inset from the map edge, and the gutter the camera keeps. */
export const GUTTER = 24;
/** The least map, in pixels, a padded camera must have to frame at its full gutter. */
const MIN_FRAME = 120;
/** The tightened gutter, and the least strip the camera keeps to frame in beside a tall panel. */
const TIGHT = 8;
const MIN_STRIP = 32;

/**
 * The ramp, in your own tokens: `--primary` stepped toward `--background`, lightest class first
 * (darkest on a dark page). A stock theme's `--chart-1`..`--chart-5` are categorical colours in
 * no order; this remaps them on the map (the block's <Map className>), so the fill and the legend
 * inside the map read one ordered ramp and your charts elsewhere keep theirs.
 */
export const CENSUS_TOKENS =
  "[--chart-1:color-mix(in_oklab,var(--primary)_28%,var(--background))] [--chart-2:color-mix(in_oklab,var(--primary)_46%,var(--background))] [--chart-3:color-mix(in_oklab,var(--primary)_64%,var(--background))] [--chart-4:color-mix(in_oklab,var(--primary)_82%,var(--background))] [--chart-5:var(--primary)]";

/** Where the credit links, per language: the boundary files and the licence (the table is CENSUS_SOURCE.url). */
export const CENSUS_LINKS = {
  boundaries: {
    en: "https://www12.statcan.gc.ca/census-recensement/2021/geo/sip-pis/boundary-limites/index2021-eng.cfm?year=21",
    fr: "https://www12.statcan.gc.ca/census-recensement/2021/geo/sip-pis/boundary-limites/index2021-fra.cfm?year=21",
  },
  licence: {
    en: "https://www.statcan.gc.ca/en/terms-conditions/open-licence",
    fr: "https://www.statcan.gc.ca/fr/avis/licence-ouverte",
  },
};

/** Where a reader gets an unmap key: the no-key state's first action. */
export const KEY_URL = "https://unmap.dev/dashboard";

export const CENSUS_COPY = {
  en: {
    title: "2021 Census, by province and territory",
    intro: "Pick a measure, then point at a province or territory for its number.",
    introTouch: "Pick a measure, then tap a province or territory for its number.",
    metric: "Measure",
    metrics: { population: "Population", change: "Change", density: "Density" },
    meaning: {
      population: "People counted in the 2021 Census",
      change: "Population change from 2016 to 2021",
      density: "People per square kilometre of land, 2021",
    },
    unit: { population: "people", change: "since 2016", density: "people per km²" },
    classes: (count: number) => `${count} classes, each holding about as many provinces and territories.`,
    legend: "Legend",
    all: "All values",
    below: (value: string) => `Below ${value}`,
    between: (low: string, high: string) => `${low} to under ${high}`,
    from: (value: string) => `${value} and up`,
    separator: ": ",
    canada: "Canada, all provinces and territories",
    tapHint: "Canada. Tap a province to pin it.",
    rank: (rank: string, total: number) => `${rank} of ${total}`,
    place: (name: string, value: string, unit: string, rank: string) => `${name}: ${value} ${unit}, ${rank}.`,
    canadaPlace: (value: string, unit: string) => `Canada: ${value} ${unit}.`,
    summary: (metric: string, high: string, highValue: string, low: string, lowValue: string) =>
      `${metric}. Highest: ${high}, ${highValue}. Lowest: ${low}, ${lowValue}.`,
    showCanada: "Show Canada",
    fold: "Hide details",
    unfold: "Show details",
    boundaries: "Boundaries:",
    boundaryFiles: "2021 Census Boundary Files",
    licence: "Licence:",
    licenceName: "Statistics Canada Open Licence",
    noKeyTitle: "Add your unmap key to load the map.",
    getKey: "Get a key",
    noKey:
      'No unmap key. Pass apiKey. On Next.js, set NEXT_PUBLIC_UNMAP_KEY in .env.local. On Nuxt, set NUXT_PUBLIC_UNMAP_KEY in .env. If you installed with unmap add, nuxt.config already declares runtimeConfig: { public: { unmapKey: "" } }; otherwise add it there. Then restart the dev server.',
  },
  fr: {
    title: "Recensement de 2021, par province et territoire",
    intro: "Choisissez un indicateur, puis pointez une province ou un territoire pour voir son chiffre.",
    introTouch: "Choisissez un indicateur, puis touchez une province ou un territoire pour voir son chiffre.",
    metric: "Indicateur",
    metrics: { population: "Population", change: "Variation", density: "Densité" },
    meaning: {
      population: "Personnes dénombrées au Recensement de 2021",
      change: "Variation de la population de 2016 à 2021",
      density: "Habitants par kilomètre carré de terre, 2021",
    },
    unit: { population: "personnes", change: "depuis 2016", density: "habitants au km²" },
    classes: (count: number) => `${count} classes comptant chacune à peu près autant de provinces et de territoires.`,
    legend: "Légende",
    all: "Toutes les valeurs",
    below: (value: string) => `Moins de ${value}`,
    between: (low: string, high: string) => `De ${low} à moins de ${high}`,
    from: (value: string) => `${value} et plus`,
    separator: " : ",
    canada: "Canada, ensemble des provinces et territoires",
    tapHint: "Canada. Touchez une province pour la garder.",
    rank: (rank: string, total: number) => `${rank} sur ${total}`,
    place: (name: string, value: string, unit: string, rank: string) => `${name} : ${value} ${unit}, ${rank}.`,
    canadaPlace: (value: string, unit: string) => `Canada : ${value} ${unit}.`,
    summary: (metric: string, high: string, highValue: string, low: string, lowValue: string) =>
      `${metric}. Au premier rang : ${high}, ${highValue}. Au dernier rang : ${low}, ${lowValue}.`,
    showCanada: "Revenir au Canada",
    fold: "Masquer les détails",
    unfold: "Afficher les détails",
    boundaries: "Limites :",
    boundaryFiles: "Fichiers des limites du Recensement de 2021",
    licence: "Licence :",
    licenceName: "Licence ouverte de Statistique Canada",
    noKeyTitle: "Ajoutez votre clé unmap pour charger la carte.",
    getKey: "Obtenir une clé",
    noKey:
      'Aucune clé unmap. Passez apiKey. Avec Next.js, définissez NEXT_PUBLIC_UNMAP_KEY dans .env.local. Avec Nuxt, définissez NUXT_PUBLIC_UNMAP_KEY dans .env. Si vous avez installé le bloc avec unmap add, nuxt.config déclare déjà runtimeConfig: { public: { unmapKey: "" } } ; sinon, ajoutez-le. Redémarrez ensuite le serveur de développement.',
  },
};

export function isMetric(value: unknown): value is CensusMetric {
  return typeof value === "string" && (CENSUS_METRICS as readonly string[]).includes(value);
}

/** The value a row shows for `metric`: persons, percent change since 2016, or persons per km². */
export function metricValue(row: CensusCounts, metric: CensusMetric): number {
  if (metric === "population") return row.population;
  if (metric === "change") return ((row.population - row.population2016) / row.population2016) * 100;
  return row.population / row.landArea;
}

/** The whole country's value: the metric of the rows' summed counts, not an average of their values. */
export function canadaValue(rows: CensusCounts[], metric: CensusMetric): number {
  const sum = (pick: (row: CensusCounts) => number) => rows.reduce((total, row) => total + pick(row), 0);
  return metricValue(
    { population: sum((row) => row.population), population2016: sum((row) => row.population2016), landArea: sum((row) => row.landArea) },
    metric,
  );
}

/**
 * The lower bounds of classes 2..`count`, as quantiles of `values`: each class holds about as many
 * values as the next. Ascending with no repeats and never the minimum itself, so equal values stay
 * in one class; fewer than `count - 1` bounds come back when there are fewer distinct values.
 */
export function quantileBreaks(values: number[], count: number): number[] {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  const breaks: number[] = [];
  if (sorted.length < 2) return breaks;
  for (let index = 1; index < count; index += 1) {
    const bound = sorted[Math.min(sorted.length - 1, Math.floor((index * sorted.length) / count))]!;
    if (bound > sorted[0]! && (breaks.length === 0 || bound > breaks[breaks.length - 1]!)) breaks.push(bound);
  }
  return breaks;
}

/** The class `value` falls in, 0 for the lowest: a bound opens its class, as the fill's `step` reads it. */
export function classOf(value: number, breaks: number[]): number {
  return breaks.filter((bound) => value >= bound).length;
}

/**
 * The ramp colour for class `index` of `classes`: spread over the whole ramp, so two classes read
 * lightest and darkest rather than the two lightest. One class takes the middle colour; a ramp
 * shorter than the classes repeats its ends.
 */
export function rampIndex(index: number, classes: number, rampLength: number): number {
  if (rampLength <= 1) return 0;
  if (classes <= 1) return Math.floor((rampLength - 1) / 2);
  return Math.round((index * (rampLength - 1)) / (classes - 1));
}

/** A `fill-color` reading feature-state `value`: one ramp colour per class, `missing` for a shape with no value joined. */
export function choroplethColor(breaks: number[], ramp: string[], missing: string): unknown[] {
  const classes = breaks.length + 1;
  const colour = (index: number) => ramp[rampIndex(index, classes, ramp.length)] ?? missing;
  const steps: unknown[] = ["step", ["to-number", ["feature-state", "value"]], colour(0)];
  breaks.forEach((bound, index) => steps.push(bound, colour(index + 1)));
  return ["case", ["==", ["typeof", ["feature-state", "value"]], "number"], steps, missing];
}

/** A value for people: whole persons, a signed percent to one decimal, or a density. */
export function formatMetric(value: number, metric: CensusMetric, lang: CensusLang): string {
  const locale = lang === "fr" ? "fr-CA" : "en-CA";
  if (metric === "population") return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
  if (metric === "change") {
    return new Intl.NumberFormat(locale, {
      style: "percent",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      signDisplay: "exceptZero",
    }).format(value / 100);
  }
  // The territories hold well under one person per km²: two significant figures, not a rounded 0.
  return new Intl.NumberFormat(locale, value < 1 ? { maximumSignificantDigits: 2 } : { maximumFractionDigits: 1 }).format(value);
}

/** One legend label per class, lowest first. */
export function classLabels(breaks: number[], metric: CensusMetric, lang: CensusLang): string[] {
  const copy = CENSUS_COPY[lang];
  const format = (value: number) => formatMetric(value, metric, lang);
  if (breaks.length === 0) return [copy.all];
  return [
    copy.below(format(breaks[0]!)),
    ...breaks.map((bound, index) =>
      index + 1 < breaks.length ? copy.between(format(bound), format(breaks[index + 1]!)) : copy.from(format(bound)),
    ),
  ];
}

/** A province's name in the interface language, from the boundary file's own names. */
export function censusName(properties: Record<string, unknown>, lang: CensusLang): string {
  return String(properties[lang === "fr" ? "PRFNAME" : "PRENAME"] ?? properties.PRENAME ?? "");
}

/** The rows by `metric`, highest first. */
export function ranked<T extends CensusCounts>(rows: T[], metric: CensusMetric): T[] {
  return [...rows].sort((a, b) => metricValue(b, metric) - metricValue(a, metric));
}

/** 1st, 2nd, 3rd, 4th; 1er, 2e. */
export function ordinal(rank: number, lang: CensusLang): string {
  if (lang === "fr") return rank === 1 ? "1er" : `${rank}e`;
  const suffix = { one: "st", two: "nd", few: "rd" } as Record<string, string>;
  return `${rank}${suffix[new Intl.PluralRules("en-CA", { type: "ordinal" }).select(rank)] ?? "th"}`;
}

/** The metric in one sentence, for the live region: what it measures, the highest and the lowest. */
export function describeMetric<T extends CensusCounts & { id: string }>(
  rows: T[],
  nameOf: (id: string) => string,
  metric: CensusMetric,
  lang: CensusLang,
): string {
  const copy = CENSUS_COPY[lang];
  const order = ranked(rows, metric);
  const high = order[0];
  const low = order[order.length - 1];
  if (!high || !low) return copy.meaning[metric];
  const value = (row: T) => formatMetric(metricValue(row, metric), metric, lang);
  return copy.summary(copy.meaning[metric], nameOf(high.id), value(high), nameOf(low.id), value(low));
}

/**
 * Camera padding that keeps what the camera frames clear of the floating panel: its width on the
 * left when it floats beside the map, its height at the bottom when it is a sheet across it. An
 * even gutter when nothing is measured. When the full gutter would leave too little map (a tall
 * sheet on a small phone), the gutter tightens and the frame stays in the strip the panel leaves,
 * never behind the panel.
 */
export function panelPadding(map: CensusRect, panel: CensusRect | null, gutter = GUTTER): CensusPadding {
  const even = { top: gutter, right: gutter, bottom: gutter, left: gutter };
  if (!panel || panel.width <= 0 || panel.height <= 0 || map.width <= 0 || map.height <= 0) return even;
  const sheet = panel.width >= map.width * 0.6;
  const cover = Math.round(sheet ? map.bottom - panel.top : panel.right - map.left);
  const size = sheet ? map.height : map.width;
  if (size - 2 * gutter - cover >= MIN_FRAME) return sheet ? { ...even, bottom: cover + gutter } : { ...even, left: cover + gutter };
  const near = Math.min(cover + TIGHT, size - TIGHT - MIN_STRIP);
  return sheet ? { ...even, top: TIGHT, bottom: near } : { ...even, left: near, right: TIGHT };
}

/** The scroll position that shows `row` whole in `view`, moving as little as it can. */
export function listScrollTop(view: { scrollTop: number; clientHeight: number }, row: { offsetTop: number; offsetHeight: number }): number {
  if (row.offsetTop < view.scrollTop) return row.offsetTop;
  const bottom = row.offsetTop + row.offsetHeight;
  return bottom > view.scrollTop + view.clientHeight ? bottom - view.clientHeight : view.scrollTop;
}

/** True on a touch screen, where there is no pointer to hover with: the intro says tap. Read after mount. */
export function coarsePointer(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)")?.matches === true;
}
// --- end census-choropleth helpers ---
</script>

<script setup lang="ts">
/**
 * <UnmapCensusChoropleth> - population by province and territory from the 2021 Census, as a
 * choropleth in one component, for Vue and Nuxt. A full-bleed map of Canada with a floating panel
 * (a bottom sheet on a phone): one switch between population, change since 2016 and people per
 * km², a legend that says what the scale means and lists each class's provinces under it, and the
 * number for whatever the pointer, the keyboard or a tap is on.
 *
 * The thirteen shapes are added once as GeoJSON with `promoteId: "PRUID"`, and each metric is
 * joined onto them by that id with `setFeatureState`: switching metric writes thirteen feature
 * states and the fill's classes, and never uploads the shapes again. Classes are quantiles of the
 * metric. The ramp is your `--primary` stepped toward your `--background` (CENSUS_TOKENS remaps
 * `--chart-1`..`--chart-5` on the map only, since a theme's chart colours are categorical and a
 * choropleth needs an order), so the fill and the legend read the same five colours in light and
 * dark.
 *
 * The join is the part to keep: swap PROVINCES and CENSUS_ROWS (lib/census-choropleth-data) for
 * your own shapes and numbers keyed by any property, and the rest works unchanged. The census data
 * ships with the block (Statistics Canada Open Licence, credited in the panel), so it calls no API
 * beyond the map's own style and tiles. Installed by `npx shadcn-vue add` with its page at
 * app/pages/census-choropleth.vue. Edit freely.
 */
import { computed, defineComponent, onMounted, ref, shallowRef, useId, useTemplateRef, watch, type HTMLAttributes, type PropType } from "vue";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UnmapMap } from "@/components/ui/map";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useMapGeneration, useMapStore } from "@/lib/map-context";
import { accentColor, chartRamp, tokenColor, useLayerPointer, useLayerSet, type LayerSpec, type MapFeatureEvent } from "@/lib/map-layers";
import { CENSUS_ROWS, CENSUS_SOURCE, PROVINCES } from "@/lib/census-choropleth-data";

const props = withDefaults(
  defineProps<{
    /** unmap API key. The page passes NUXT_PUBLIC_UNMAP_KEY. With none, the block asks for one and loads nothing. */
    apiKey: string;
    /** Gateway base URL. Defaults to the unmap production gateway. */
    gateway?: string;
    /** Language of the copy, the numbers, the province names and the map labels. Defaults to "en". */
    lang?: CensusLang;
    /** The metric shown first. Defaults to "population". */
    defaultMetric?: CensusMetric;
    class?: HTMLAttributes["class"];
  }>(),
  { lang: "en", defaultMetric: "population" },
);

// Vue's inject reads only a component's ancestors, so `useMap()` here could not see the map this
// component renders. It resolves the store that map registers in instead (an outer one if there
// is one, else one it provides to it), the way compare-swipe does. The layers below render inside
// UnmapMap, where inject does see it.
const mapStore = useMapStore();
const map = computed(() => mapStore.get(CENSUS_MAP_ID)?.map ?? null);

/** What the pointer or the keyboard is on, and where it came from. */
type Hover = { id: string; from: "map" | "list" };

/** Each province's or territory's name, by PRUID, in each language. */
const names: Record<CensusLang, Record<string, string>> = {
  en: Object.fromEntries(PROVINCES.features.map((feature) => [feature.properties.PRUID, censusName(feature.properties, "en")])),
  fr: Object.fromEntries(PROVINCES.features.map((feature) => [feature.properties.PRUID, censusName(feature.properties, "fr")])),
};

const copy = computed(() => CENSUS_COPY[props.lang]);
const hasKey = computed(() => props.apiKey.trim() !== "");
const metric = ref<CensusMetric>(props.defaultMetric);
const hover = shallowRef<Hover | null>(null);
const selected = ref<string | null>(null);
// What the live region says: the metric's summary when it changes, the province when one is pinned
// or let go. Nothing until the reader does something; hovering is never announced.
const said = ref("");
// Bumped when a pin is let go: the pointer layer forgets the feature under a finger that has lifted.
const released = ref(0);
// On a phone the sheet can fold to the answer, to give the map back.
const folded = ref(false);
// Read after mount: the server cannot know the pointer, so the first pass says "point".
const touch = ref(false);
const panel = useTemplateRef<HTMLElement>("panel");
const scroller = useTemplateRef<HTMLElement>("scroller");
const detailsId = useId();
let moved = false;

const nameOf = (id: string) => names[props.lang][id] ?? id;
const breaks = computed(() => quantileBreaks(CENSUS_ROWS.map((row) => metricValue(row, metric.value)), CLASS_COUNT));
const order = computed(() => ranked(CENSUS_ROWS, metric.value));
const labels = computed(() => classLabels(breaks.value, metric.value, props.lang));
const classes = computed(() => labels.value.length);
const lit = computed(() => (hover.value?.from === "list" ? hover.value.id : null));
const format = (row: CensusCounts) => formatMetric(metricValue(row, metric.value), metric.value, props.lang);
const rankText = (id: string) =>
  copy.value.rank(ordinal(order.value.findIndex((row) => row.id === id) + 1, props.lang), order.value.length);

// The answer speaks for what the pointer or keyboard is on, else the pinned province, else Canada.
const focusRow = computed(() => {
  const id = hover.value?.id ?? selected.value;
  return id ? CENSUS_ROWS.find((row) => row.id === id) : undefined;
});
const focusClass = computed(() => (focusRow.value ? classOf(metricValue(focusRow.value, metric.value), breaks.value) : null));
const answerValue = computed(() =>
  focusRow.value ? format(focusRow.value) : formatMetric(canadaValue(CENSUS_ROWS, metric.value), metric.value, props.lang),
);
// On a touch screen, with nothing pinned, the caption says how to pin: phones never see the intro.
const canadaCaption = computed(() => (touch.value ? copy.value.tapHint : copy.value.canada));
// The classes highest first, each with its provinces, highest first.
const groups = computed(() =>
  labels.value
    .map((label, index) => ({ index, label, rows: order.value.filter((row) => classOf(metricValue(row, metric.value), breaks.value) === index) }))
    .reverse(),
);

onMounted(() => {
  touch.value = coarsePointer();
});

// The camera frames the provinces clear of the panel, without a move to watch: now, again when
// the map resizes, the panel has slid in or the sheet folds, until the reader moves the map.
watch(
  [map, panel, folded],
  ([live, element], _previous, onCleanup) => {
    if (!live) return;
    const fit = () => {
      if (moved) return;
      const padding = panelPadding(live.getContainer().getBoundingClientRect(), element?.getBoundingClientRect() ?? null);
      live.fitBounds(CANADA_BOUNDS, { padding, duration: 0 });
    };
    // The camera's own moves carry no originalEvent; a drag, a wheel or a key does.
    const onMoveStart = (event?: { originalEvent?: unknown }) => {
      if (event?.originalEvent) moved = true;
    };
    // Measured again once the panel has slid in: mid-slide it sits off its final place.
    const onSlidIn = (event: Event) => {
      if (event.target === element) fit();
    };
    fit();
    live.on("resize", fit);
    live.on("movestart", onMoveStart as never);
    element?.addEventListener("animationend", onSlidIn);
    onCleanup(() => {
      live.off("resize", fit);
      live.off("movestart", onMoveStart as never);
      element?.removeEventListener("animationend", onSlidIn);
    });
  },
  { immediate: true, flush: "post" },
);

// A province lit from the map scrolls its row into the panel's view. Only the panel scrolls, never the page.
watch(
  hover,
  (next) => {
    const view = scroller.value;
    if (next?.from !== "map" || !view) return;
    const row = [...view.querySelectorAll<HTMLElement>("[data-province]")].find((element) => element.getAttribute("data-province") === next.id);
    if (!row) return;
    const top = listScrollTop(view, row);
    if (top !== view.scrollTop) view.scrollTop = top;
  },
  { flush: "post" },
);

function choose(next: unknown) {
  // Pressing the pressed item empties a single-select group: the metric stays.
  if (!isMetric(next) || next === metric.value) return;
  metric.value = next;
  said.value = describeMetric(CENSUS_ROWS, nameOf, next, props.lang);
}

function pick(id: string | null) {
  const next = id === null || id === "" || selected.value === id ? null : id;
  selected.value = next;
  const row = next ? CENSUS_ROWS.find((entry) => entry.id === next) : undefined;
  const unit = copy.value.unit[metric.value];
  said.value = row
    ? copy.value.place(nameOf(row.id), format(row), unit, rankText(row.id))
    : copy.value.canadaPlace(formatMetric(canadaValue(CENSUS_ROWS, metric.value), metric.value, props.lang), unit);
  if (next === null) {
    // A tap leaves no pointer to move away: a hover from the map would keep the answer on the
    // province just let go. Forget it; a mouse still over the shape reports it again as it moves.
    if (hover.value?.from === "map") hover.value = null;
    released.value += 1;
  }
}

function onMapHover(id: string | null) {
  if (id) hover.value = { id, from: "map" };
  else if (hover.value?.from === "map") hover.value = null;
}

function enterRow(id: string) {
  hover.value = { id, from: "list" };
}

function leaveRow() {
  if (hover.value?.from === "list") hover.value = null;
}

/** The shapes, the join, the outlines and the pointer. Rendered inside UnmapMap, where the map store is injected. */
const CensusLayers = defineComponent({
  name: "CensusLayers",
  props: {
    metric: { type: String as PropType<CensusMetric>, required: true },
    breaks: { type: Array as PropType<number[]>, required: true },
    selected: { type: String as PropType<string | null>, default: null },
    lit: { type: String as PropType<string | null>, default: null },
    released: { type: Number, default: 0 },
  },
  emits: { hover: (_id: string | null) => true, pick: (_id: string) => true },
  setup(layerProps, { emit }) {
    // The shapes, added once (and again after a style swap). The fill reads the current classes
    // when it is added; later metric changes rewrite it in place below.
    const { map: live, ready } = useLayerSet(() => ({
      mapId: CENSUS_MAP_ID,
      sourceId: CENSUS_SOURCE_ID,
      source: { promoteId: "PRUID" },
      data: PROVINCES,
      layers: (current) => [
        {
          id: CENSUS_FILL_ID,
          type: "fill",
          source: CENSUS_SOURCE_ID,
          paint: { "fill-color": choroplethColor(layerProps.breaks, chartRamp(current), MISSING_FILL), "fill-opacity": 0.85 },
        } as LayerSpec,
        {
          id: CENSUS_LINE_ID,
          type: "line",
          source: CENSUS_SOURCE_ID,
          paint: {
            "line-color": tokenColor(current, "--foreground") ?? accentColor(current, undefined, undefined),
            // The pinned province keeps the heaviest outline; a hovered or lit one the next; a line, not a colour, marks them.
            "line-width": [
              "case",
              ["boolean", ["feature-state", "selected"], false],
              3,
              ["any", ["boolean", ["feature-state", "hover"], false], ["boolean", ["feature-state", "lit"], false]],
              2,
              0.6,
            ],
            "line-opacity": [
              "case",
              [
                "any",
                ["boolean", ["feature-state", "selected"], false],
                ["boolean", ["feature-state", "hover"], false],
                ["boolean", ["feature-state", "lit"], false],
              ],
              1,
              0.4,
            ],
          },
        } as LayerSpec,
      ],
    }));
    const generation = useMapGeneration(CENSUS_MAP_ID);

    // The join, registered after useLayerSet's watcher so it runs after the source is added; again
    // after a style swap, which drops feature state, and on every metric change.
    watch(
      [live, ready, generation, () => layerProps.metric, () => layerProps.breaks],
      ([current, isReady]) => {
        if (!current || !isReady || !current.getStyle() || !current.getSource(CENSUS_SOURCE_ID)) return;
        if (current.getLayer(CENSUS_FILL_ID)) {
          // An expression MapLibre reads; the helper stays free of MapLibre's types so both lanes share it.
          current.setPaintProperty(CENSUS_FILL_ID, "fill-color", choroplethColor(layerProps.breaks, chartRamp(current), MISSING_FILL) as never);
        }
        for (const row of CENSUS_ROWS) {
          current.setFeatureState({ source: CENSUS_SOURCE_ID, id: row.id }, { value: metricValue(row, layerProps.metric) });
        }
      },
      { immediate: true, flush: "post" },
    );

    // One province's outline state, drawn again after a swap and taken off when it moves on.
    const outline = (key: "selected" | "lit", id: () => string | null) =>
      watch(
        [live, ready, generation, id],
        ([current, isReady, _generation, target], _previous, onCleanup) => {
          if (!current || !isReady || !target || !current.getSource(CENSUS_SOURCE_ID)) return;
          current.setFeatureState({ source: CENSUS_SOURCE_ID, id: target }, { [key]: true });
          onCleanup(() => {
            if (current.getStyle() && current.getSource(CENSUS_SOURCE_ID)) {
              current.setFeatureState({ source: CENSUS_SOURCE_ID, id: target }, { [key]: false });
            }
          });
        },
        { immediate: true, flush: "post" },
      );
    outline("selected", () => layerProps.selected);
    outline("lit", () => layerProps.lit);

    const idOf = (event: MapFeatureEvent) => String(event.feature.id ?? event.feature.properties.PRUID ?? "");
    useLayerPointer(() => ({
      map: live.value,
      layerIds: [CENSUS_FILL_ID],
      enabled: true,
      hoverSource: CENSUS_SOURCE_ID,
      onHover: (event) => emit("hover", event ? idOf(event) || null : null),
      // A tap pins: a touch screen has no hover to show the number.
      onClick: (event) => emit("pick", idOf(event)),
      resetOn: layerProps.released,
    }));
    return () => null;
  },
});
</script>

<template>
  <!-- Where the map would be: the block's gutter, the Alert at a readable width, the first action first. -->
  <div
    v-if="!hasKey"
    data-unmap-block="census-choropleth"
    data-state="no-key"
    :class="['flex h-full min-h-[480px] items-start justify-center bg-muted/40 p-4 sm:items-center sm:p-6', props.class]"
  >
    <Alert role="alert" class="w-full max-w-md motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
      <AlertTitle class="line-clamp-none">{{ copy.noKeyTitle }}</AlertTitle>
      <AlertDescription class="flex flex-col items-start gap-3">
        <a class="font-medium text-primary underline underline-offset-4" :href="KEY_URL" target="_blank" rel="noreferrer">{{ copy.getKey }}</a>
        <p>{{ copy.noKey }}</p>
      </AlertDescription>
    </Alert>
  </div>
  <div v-else data-unmap-block="census-choropleth" :class="['relative h-full min-h-[480px]', props.class]">
    <UnmapMap
      :id="CENSUS_MAP_ID"
      :api-key="props.apiKey"
      :gateway="props.gateway"
      map-style="muted"
      :lang="props.lang"
      :center="CANADA_VIEW.center"
      :zoom="CANADA_VIEW.zoom"
      :class="`h-full ${CENSUS_TOKENS}`"
    >
      <CensusLayers :metric="metric" :breaks="breaks" :selected="selected" :lit="lit" :released="released" @hover="onMapHover" @pick="pick" />
      <p data-testid="census-announce" aria-live="polite" class="sr-only">{{ said }}</p>
      <!-- A card floating on the map at 24 px; below `sm`, a sheet across the bottom (at most half the map) that clears the attribution. -->
      <div
        ref="panel"
        class="absolute inset-x-4 bottom-10 z-10 flex max-h-[50%] flex-col sm:inset-x-auto sm:top-6 sm:bottom-auto sm:left-6 sm:max-h-[calc(100%-3rem)] sm:w-[22rem] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-300 sm:motion-safe:slide-in-from-bottom-0 sm:motion-safe:slide-in-from-left-4"
      >
        <Card class="flex min-h-0 flex-1 flex-col">
          <CardHeader>
            <div class="flex items-center justify-between gap-2">
              <CardTitle role="heading" aria-level="2" class="min-w-0">{{ copy.title }}</CardTitle>
              <!-- An icon, so a long title keeps the width of a phone's sheet; its name says what it does. -->
              <Button
                type="button"
                variant="ghost"
                size="icon"
                class="shrink-0 sm:hidden"
                :aria-label="folded ? copy.unfold : copy.fold"
                :title="folded ? copy.unfold : copy.fold"
                :aria-expanded="!folded"
                :aria-controls="detailsId"
                @click="folded = !folded"
              >
                <span aria-hidden="true">{{ folded ? "▴" : "▾" }}</span>
              </Button>
            </div>
            <CardDescription class="max-sm:hidden">{{ touch ? copy.introTouch : copy.intro }}</CardDescription>
          </CardHeader>
          <!-- The switch and the answer stay put; only the legend below them scrolls. -->
          <CardContent class="flex min-h-0 flex-1 flex-col gap-3 sm:gap-4">
            <ToggleGroup
              type="single"
              variant="outline"
              :aria-label="copy.metric"
              :model-value="metric"
              class="grid w-full shrink-0 grid-cols-3"
              @update:model-value="choose"
            >
              <ToggleGroupItem
                v-for="entry in CENSUS_METRICS"
                :key="entry"
                :value="entry"
                class="h-auto px-2 py-1.5 whitespace-normal data-[state=on]:font-semibold"
              >
                {{ copy.metrics[entry] }}
              </ToggleGroupItem>
            </ToggleGroup>
            <!-- The answer: a fixed height, one line for the number and one for the caption, so nothing
                 jumps as the pointer moves or a long name arrives. A long name truncates; its rank stays. -->
            <div data-testid="census-answer" class="flex h-16 shrink-0 flex-col justify-center gap-1 sm:h-[4.5rem]">
              <div class="flex min-w-0 items-center gap-2">
                <p class="flex min-w-0 flex-1 items-baseline gap-x-2">
                  <span class="shrink-0 text-2xl leading-none font-semibold tracking-tight tabular-nums sm:text-3xl">{{ answerValue }}</span>
                  {{ " " }}
                  <span class="truncate text-sm text-muted-foreground">{{ copy.unit[metric] }}</span>
                </p>
                <Button
                  v-if="selected"
                  type="button"
                  variant="ghost"
                  size="icon"
                  class="shrink-0"
                  :aria-label="copy.showCanada"
                  :title="copy.showCanada"
                  @click="pick(null)"
                >
                  <span aria-hidden="true">×</span>
                </Button>
              </div>
              <p class="flex min-w-0 text-sm text-muted-foreground">
                <template v-if="focusRow">
                  <span class="truncate">{{ `${nameOf(focusRow.id)},` }}</span>
                  <span class="shrink-0 whitespace-nowrap">{{ `\u00a0${rankText(focusRow.id)}` }}</span>
                </template>
                <span v-else class="truncate">{{ canadaCaption }}</span>
              </p>
            </div>
            <div
              :id="detailsId"
              ref="scroller"
              :data-folded="folded"
              class="-mx-2 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain border-t px-2 pt-4 max-sm:data-[folded=true]:hidden"
            >
              <div class="flex flex-col gap-1">
                <p class="text-sm font-medium">{{ copy.meaning[metric] }}</p>
                <p class="text-xs text-muted-foreground">{{ copy.classes(classes) }}</p>
              </div>
              <ul :aria-label="copy.legend" class="flex flex-col gap-2">
                <li
                  v-for="group in groups"
                  :key="group.label"
                  :data-class="group.index"
                  :data-active="focusClass === group.index ? 'true' : undefined"
                  class="group/class flex flex-col gap-0.5"
                >
                  <p
                    class="flex items-center gap-2 px-2 text-xs text-muted-foreground tabular-nums group-data-[active=true]/class:font-medium group-data-[active=true]/class:text-foreground"
                  >
                    <span
                      aria-hidden="true"
                      data-swatch=""
                      class="size-3 shrink-0 rounded-sm border"
                      :style="{ backgroundColor: `var(--chart-${rampIndex(group.index, classes, CLASS_COUNT) + 1})` }"
                    />
                    <span data-class-label="">{{ group.label }}</span>
                  </p>
                  <ul :aria-label="group.label" class="flex flex-col">
                    <li v-for="row in group.rows" :key="row.id">
                      <Button
                        type="button"
                        :variant="row.id === selected ? 'secondary' : 'ghost'"
                        size="sm"
                        :aria-pressed="row.id === selected"
                        :data-province="row.id"
                        :data-hovered="hover?.id === row.id ? 'true' : undefined"
                        class="h-auto w-full justify-between gap-3 py-1 pl-7 text-left font-normal whitespace-normal hover:bg-muted focus-visible:bg-muted data-[hovered=true]:bg-muted aria-pressed:font-semibold"
                        @click="pick(row.id)"
                        @mouseenter="enterRow(row.id)"
                        @mouseleave="leaveRow"
                        @focus="enterRow(row.id)"
                        @blur="leaveRow"
                      >
                        <span class="flex min-w-0 items-center gap-1.5">
                          <!-- Pinned is shown by weight and a mark, not by colour alone. -->
                          <span v-if="row.id === selected" aria-hidden="true">✓</span>
                          {{ nameOf(row.id) }}
                        </span>
                        <span class="sr-only">{{ copy.separator }}</span>
                        <span class="shrink-0 tabular-nums">{{ format(row) }}</span>
                      </Button>
                    </li>
                  </ul>
                </li>
              </ul>
              <p class="pb-1 text-xs text-muted-foreground">
                <a
                  class="underline underline-offset-2"
                  :href="props.lang === 'fr' ? CENSUS_SOURCE.urlFr : CENSUS_SOURCE.url"
                  target="_blank"
                  rel="noreferrer"
                  >{{ CENSUS_SOURCE[props.lang] }}</a
                >
                {{ copy.boundaries }}
                <a class="underline underline-offset-2" :href="CENSUS_LINKS.boundaries[props.lang]" target="_blank" rel="noreferrer">{{
                  copy.boundaryFiles
                }}</a
                >. {{ copy.licence }}
                <a class="underline underline-offset-2" :href="CENSUS_LINKS.licence[props.lang]" target="_blank" rel="noreferrer">{{
                  copy.licenceName
                }}</a
                >.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </UnmapMap>
  </div>
</template>
