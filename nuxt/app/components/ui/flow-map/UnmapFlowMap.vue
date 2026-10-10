<script lang="ts">
import type { MigrationLocation, MigrationRow } from "@/lib/flow-map-data";

// --- flow-map helpers (kept identical across both lanes) ---
export type FlowMapLang = "en" | "fr";

/** One table row as flow-layer reads it; `time` is the period's first year. */
export interface MigrationFlow {
  origin: string;
  dest: string;
  count: number;
  time: number;
}

/** A capital as flow-layer reads it, named in the page's language. */
export interface MigrationPlace {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

/** One province's or territory's year: who arrived, who left, and the difference. */
export interface ProvinceBalance {
  id: string;
  in: number;
  out: number;
  net: number;
}

/** What the pointer or the keyboard is on: a province, or one flow by its ends. */
export type FlowMapFocus = { kind: "place"; id: string } | { kind: "flow"; origin: string; dest: string };

/** A box on screen, as getBoundingClientRect() gives it. */
export interface FlowMapRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** Camera padding in pixels, as fitBounds takes it. */
export interface FlowMapPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** The block's own map id, so a map elsewhere on the page never answers for it. */
export const FLOW_MAP_ID = "flow-map";
/** The flow layer's source id and layer-id prefix; its capitals are the `-locations` source. */
export const FLOW_LAYER_ID = "flow-map";
export const FLOW_LOCATIONS_SOURCE = `${FLOW_LAYER_ID}-locations`;

/** The slider filters no style layer: flow-layer re-sums the flows for the year itself. */
export const NO_LAYERS: string[] = [];

/** All of Canada: where the map opens before it frames the capitals. */
export const CANADA_VIEW: { center: [number, number]; zoom: number } = { center: [-96, 58], zoom: 3 };

/**
 * The thirteen capitals and the arcs that bow between them, for fitBounds. The south edge sits
 * just below Toronto, so the frame spends its height on Canada rather than on the arcs' bellies.
 */
export const CAPITALS_BOUNDS: [[number, number], [number, number]] = [
  [-137, 42.5],
  [-51, 66],
];

/** How far the flows bow: less than flow-layer's 0.25, so the long east-west arcs stay near Canada. */
export const FLOW_CURVATURE = 0.15;

/** The panel's inset from the map edge, and the gutter the camera keeps. */
export const GUTTER = 24;
/** How long the flow widths take to move from one year to the next. Reduced motion jumps. */
export const TWEEN_MS = 600;
/** The least map, in pixels, a padded camera must still have to frame something. */
const MIN_FRAME = 120;

/** The licences the credit links, in the reader's language. */
export const FLOW_MAP_LICENCES = {
  statcan: {
    en: "https://www.statcan.gc.ca/en/terms-conditions/open-licence",
    fr: "https://www.statcan.gc.ca/fr/avis/licence-ouverte",
  },
  ogl: {
    en: "https://open.canada.ca/en/open-government-licence-canada",
    fr: "https://ouvert.canada.ca/fr/licence-du-gouvernement-ouvert-canada",
  },
};

/** Where a reader gets an unmap key: the no-key state's first action. */
export const KEY_URL = "https://unmap.dev/dashboard";

export const FLOW_MAP_COPY = {
  en: {
    title: "Interprovincial migration",
    intro: "Who moved between provinces and territories, year by year. Play the years, or pick a province to see only its flows.",
    total: (count: string, period: string) => `${count} people moved between provinces and territories in ${period}.`,
    preliminary: "Preliminary estimates.",
    preliminaryBadge: "Preliminary",
    moved: "people moved",
    movedCaption: (period: string) => `between provinces and territories in ${period}`,
    net: "net",
    placeCaption: (name: string, period: string) => `${name}, ${period}`,
    hint: "Point at a flow or a capital for its numbers.",
    hintTouch: "Tap a flow or a capital for its numbers.",
    flow: (from: string, to: string, count: string) => `${from} to ${to}: ${count} people`,
    place: (name: string, arrived: string, left: string) => `${name}: ${arrived} arrived, ${left} left`,
    list: "Net migration",
    listLabel: (period: string) => `Net migration by province and territory, ${period}`,
    gained: "Gained",
    lost: "Lost",
    showAll: "Show all provinces",
    showList: "Show provinces",
    hideList: "Hide provinces",
    showing: (name: string) => `Showing flows to and from ${name}.`,
    sayNet: (net: string) => `Net migration: ${net}.`,
    licences: "Licences:",
    statcanLicence: "Statistics Canada Open Licence",
    oglLicence: "Open Government Licence – Canada",
    noKeyTitle: "Add your unmap key to load the map.",
    getKey: "Get a key",
    noKey:
      'Pass apiKey. On Next.js, set NEXT_PUBLIC_UNMAP_KEY in .env.local. On Nuxt, set NUXT_PUBLIC_UNMAP_KEY in .env. If you installed with unmap add, nuxt.config already declares runtimeConfig: { public: { unmapKey: "" } }; otherwise add it there. Then restart the dev server.',
  },
  fr: {
    title: "Migration interprovinciale",
    intro:
      "Qui a changé de province ou de territoire, année après année. Faites défiler les années, ou choisissez une province pour ne voir que ses flux.",
    total: (count: string, period: string) => `${count} personnes ont changé de province ou de territoire en ${period}.`,
    preliminary: "Estimations provisoires.",
    preliminaryBadge: "Provisoire",
    moved: "personnes",
    movedCaption: (period: string) => `ont changé de province ou de territoire en ${period}`,
    net: "solde",
    placeCaption: (name: string, period: string) => `${name}, ${period}`,
    hint: "Pointez un flux ou une capitale pour voir ses chiffres.",
    hintTouch: "Touchez un flux ou une capitale pour voir ses chiffres.",
    flow: (from: string, to: string, count: string) => `${from} vers ${to} : ${count} personnes`,
    place: (name: string, arrived: string, left: string) => `${name} : ${arrived} arrivées, ${left} départs`,
    list: "Solde migratoire",
    listLabel: (period: string) => `Solde migratoire par province et territoire, ${period}`,
    gained: "Gain",
    lost: "Perte",
    showAll: "Voir toutes les provinces",
    showList: "Voir les provinces",
    hideList: "Masquer les provinces",
    showing: (name: string) => `Flux affichés : ${name}.`,
    sayNet: (net: string) => `Solde migratoire : ${net}.`,
    licences: "Licences :",
    statcanLicence: "Licence ouverte de Statistique Canada",
    oglLicence: "Licence du gouvernement ouvert – Canada",
    noKeyTitle: "Ajoutez votre clé unmap pour charger la carte.",
    getKey: "Obtenir une clé",
    noKey:
      'Passez apiKey. Avec Next.js, définissez NEXT_PUBLIC_UNMAP_KEY dans .env.local. Avec Nuxt, définissez NUXT_PUBLIC_UNMAP_KEY dans .env. Si vous avez installé le bloc avec unmap add, nuxt.config déclare déjà runtimeConfig: { public: { unmapKey: "" } } ; sinon, ajoutez-le. Redémarrez ensuite le serveur de développement.',
  },
};

/** "2023/2024" to 2023. */
export function periodStart(period: string): number {
  return Number(period.slice(0, 4));
}

/** 2023 to "2023/2024", Statistics Canada's July-to-June reference period. */
export function periodLabel(start: number): string {
  return `${start}/${start + 1}`;
}

export function migrationFlows(data: Record<string, MigrationRow[]>): MigrationFlow[] {
  return Object.entries(data).flatMap(([period, rows]) =>
    rows.map(([origin, dest, count]) => ({ origin, dest, count, time: periodStart(period) })),
  );
}

export function migrationPlaces(locations: MigrationLocation[], lang: FlowMapLang): MigrationPlace[] {
  return locations.map((location) => ({
    id: location.id,
    name: lang === "fr" ? location.name_fr : location.name,
    lat: location.lat,
    lon: location.lon,
  }));
}

/** Everyone who moved between provinces and territories in the period starting `year`. */
export function yearTotal(flows: MigrationFlow[], year: number): number {
  return flows.reduce((sum, flow) => (flow.time === year ? sum + flow.count : sum), 0);
}

/** Each place's year, in the order `places` gives (Statistics Canada's, east to west, then north). */
export function provinceBalances(flows: MigrationFlow[], year: number, places: Array<{ id: string }>): ProvinceBalance[] {
  // `globalThis.Map`: the React lane imports a `Map` component.
  const totals = new globalThis.Map(places.map((place) => [place.id, { in: 0, out: 0 }]));
  for (const flow of flows) {
    if (flow.time !== year) continue;
    const origin = totals.get(flow.origin);
    const dest = totals.get(flow.dest);
    if (origin) origin.out += flow.count;
    if (dest) dest.in += flow.count;
  }
  return places.map(({ id }) => {
    const total = totals.get(id)!;
    return { id, in: total.in, out: total.out, net: total.in - total.out };
  });
}

/** The largest net gain or loss of any place in any year: one scale, so a bar means the same in every year. */
export function largestNet(flows: MigrationFlow[], places: Array<{ id: string }>): number {
  const years = [...new Set(flows.map((flow) => flow.time))];
  return years.reduce(
    (largest, year) => provinceBalances(flows, year, places).reduce((most, balance) => Math.max(most, Math.abs(balance.net)), largest),
    0,
  );
}

/** How many moved from `origin` to `dest` in the period starting `year`. */
export function pairCount(flows: MigrationFlow[], year: number, origin: string, dest: string): number {
  return flows.reduce((sum, flow) => (flow.time === year && flow.origin === origin && flow.dest === dest ? sum + flow.count : sum), 0);
}

/** The flows to and from one place, or every flow (the same array) when none is picked. */
export function touching(flows: MigrationFlow[], id: string | null): MigrationFlow[] {
  return id === null ? flows : flows.filter((flow) => flow.origin === id || flow.dest === id);
}

/**
 * The flows part way from the `from` flows to the `to` flows, pair by pair: `t` 0 is `from`, 1 is
 * `to`. A pair in only one of them fades from or to nothing. Every flow is stamped `year`, so the
 * layer's time range for that year keeps them all. `from` can be any snapshot, such as the widths
 * on screen part way through another blend.
 */
export function blendPairs(from: MigrationFlow[], to: MigrationFlow[], year: number, t: number): MigrationFlow[] {
  const pairs = new globalThis.Map<string, MigrationFlow>();
  const add = (flows: MigrationFlow[], weight: number) => {
    for (const flow of flows) {
      const key = `${flow.origin}>${flow.dest}`;
      const pair = pairs.get(key) ?? { origin: flow.origin, dest: flow.dest, count: 0, time: year };
      pair.count += flow.count * weight;
      pairs.set(key, pair);
    }
  };
  add(from, 1 - t);
  add(to, t);
  return [...pairs.values()];
}

/** The flows part way from year `from` to year `to` of one table: `t` 0 is `from`, 1 is `to`. */
export function blendFlows(flows: MigrationFlow[], from: number, to: number, t: number): MigrationFlow[] {
  const year = (start: number) => flows.filter((flow) => flow.time === start);
  return from === to ? year(to) : blendPairs(year(from), year(to), to, t);
}

/** The largest single flow of any year: the top of a width scale every year shares. */
export function largestPair(flows: MigrationFlow[]): number {
  return flows.reduce((largest, flow) => Math.max(largest, flow.count), 0);
}

/** The most anyone moved in and out of one place in any year: the top of a circle scale every year shares. */
export function largestTotal(flows: MigrationFlow[], places: Array<{ id: string }>): number {
  const years = [...new Set(flows.map((flow) => flow.time))];
  return years.reduce(
    (largest, year) => provinceBalances(flows, year, places).reduce((most, balance) => Math.max(most, balance.in + balance.out), largest),
    0,
  );
}

export function formatCount(count: number, lang: FlowMapLang): string {
  return new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA").format(count);
}

/** A net with its sign spelled out: "+21,662", "−18,015" (a true minus), "0". */
export function formatNet(net: number, lang: FlowMapLang): string {
  const size = formatCount(Math.abs(net), lang);
  return net > 0 ? `+${size}` : net < 0 ? `−${size}` : size;
}

/**
 * What the pointer is over, in words. A flow line carries origin, dest and count; a place carries
 * id, in and out (flow-layer's feature properties). Anything else (an arrowhead) is null.
 */
export function describeHover(properties: Record<string, unknown>, places: MigrationPlace[], lang: FlowMapLang): string | null {
  const copy = FLOW_MAP_COPY[lang];
  const name = (id: unknown) => places.find((place) => place.id === id)?.name ?? String(id);
  if (typeof properties.origin === "string" && typeof properties.dest === "string") {
    return copy.flow(name(properties.origin), name(properties.dest), formatCount(Number(properties.count), lang));
  }
  if (typeof properties.id === "string" && properties.in !== undefined && properties.out !== undefined) {
    return copy.place(name(properties.id), formatCount(Number(properties.in), lang), formatCount(Number(properties.out), lang));
  }
  return null;
}

/** What a flow-layer feature is, from its properties: a flow, a capital, or nothing to describe. */
export function focusOf(properties: Record<string, unknown>): FlowMapFocus | null {
  if (typeof properties.origin === "string" && typeof properties.dest === "string") {
    return { kind: "flow", origin: properties.origin, dest: properties.dest };
  }
  if (typeof properties.id === "string" && properties.in !== undefined) return { kind: "place", id: properties.id };
  return null;
}

/**
 * The focus in words, with the year's numbers from the whole table: flow-layer's own in and out
 * cover only the flows it draws, and its counts move while the widths animate.
 */
export function describeFocus(focus: FlowMapFocus, flows: MigrationFlow[], year: number, places: MigrationPlace[], lang: FlowMapLang): string | null {
  if (focus.kind === "flow") {
    return describeHover({ origin: focus.origin, dest: focus.dest, count: pairCount(flows, year, focus.origin, focus.dest) }, places, lang);
  }
  const balance = provinceBalances(flows, year, [{ id: focus.id }])[0]!;
  return describeHover({ id: focus.id, in: balance.in, out: balance.out }, places, lang);
}

/**
 * Camera padding that keeps what the camera frames clear of the floating panel: its width on the
 * left when it floats beside the map, its height at the bottom when it is a sheet across it. An
 * even gutter when nothing is measured, or when the panel would leave the camera no map.
 */
export function panelPadding(map: FlowMapRect, panel: FlowMapRect | null, gutter = GUTTER): FlowMapPadding {
  const even = { top: gutter, right: gutter, bottom: gutter, left: gutter };
  if (!panel || panel.width <= 0 || panel.height <= 0 || map.width <= 0 || map.height <= 0) return even;
  const sheet = panel.width >= map.width * 0.6;
  const padding = sheet
    ? { ...even, bottom: Math.round(map.bottom - panel.top + gutter) }
    : { ...even, left: Math.round(panel.right - map.left + gutter) };
  const room = sheet ? map.height - padding.top - padding.bottom : map.width - padding.left - padding.right;
  return room >= MIN_FRAME ? padding : even;
}

/** The scroll position that shows `row` whole in `view`, moving as little as it can. */
export function listScrollTop(view: { scrollTop: number; clientHeight: number }, row: { offsetTop: number; offsetHeight: number }): number {
  if (row.offsetTop < view.scrollTop) return row.offsetTop;
  const bottom = row.offsetTop + row.offsetHeight;
  return bottom > view.scrollTop + view.clientHeight ? bottom - view.clientHeight : view.scrollTop;
}

/** True on a touch screen, where there is no pointer to hover with: the hint says tap. Read after mount. */
export function coarsePointer(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)")?.matches === true;
}

/** True when the reader asked for less motion: the years jump rather than blend. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
}

/** Fast start, soft landing. */
export function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}
// --- end flow-map helpers ---
</script>

<script setup lang="ts">
/**
 * <UnmapFlowMap> - a migration flow map in one component, for Vue and Nuxt. A full-bleed map of
 * Canada with a floating panel (a bottom sheet on a phone): Statistics Canada's interprovincial
 * migration estimates drawn as flows between the capitals, and a year scrubber that makes them
 * breathe. Play or step through the years and the flow widths move from one year to the next
 * while each province's net gain or loss grows and shrinks on one scale. Point at a flow, a
 * capital or a row for its numbers; pick a province to draw only its flows.
 *
 * Composes the registry's map, flow-layer and time-slider items on your shadcn-vue Card, Badge,
 * Button and Alert, in your tokens. The data ships with the block (lib/flow-map-data, Statistics
 * Canada Open Licence, credited in the panel), so it calls no API beyond the map's own style and
 * tiles. The slider names no style layer: flow-layer re-sums the flows for the chosen year itself.
 *
 * Installed by `npx shadcn-vue add` with its page at app/pages/flow-map.vue. Edit freely.
 */
import { computed, onMounted, onScopeDispose, ref, shallowRef, useId, useTemplateRef, watch, type HTMLAttributes } from "vue";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UnmapFlowLayer } from "@/components/ui/flow-layer";
import { UnmapMap } from "@/components/ui/map";
import { UnmapTimeSlider } from "@/components/ui/time-slider";
import { useMapStore } from "@/lib/map-context";
import { MIGRATION, MIGRATION_LOCATIONS, MIGRATION_PERIODS, MIGRATION_PRELIMINARY, MIGRATION_SOURCE } from "@/lib/flow-map-data";

const props = withDefaults(
  defineProps<{
    /** unmap API key. The page passes NUXT_PUBLIC_UNMAP_KEY. With none, the block asks for one and loads nothing. */
    apiKey: string;
    /** Gateway base URL. Defaults to the unmap production gateway. */
    gateway?: string;
    /** Language of the copy, the numbers and the place names. Defaults to "en". */
    lang?: FlowMapLang;
    /** Draw only the N largest flows of the year. Defaults to 40 of the 156. */
    topN?: number;
    class?: HTMLAttributes["class"];
  }>(),
  { lang: "en", topN: 40 },
);

// Vue's inject reads only a component's ancestors, so `useMap()` here could not see the map this
// component renders. It resolves the store that map registers in instead (an outer one if there
// is one, else one it provides to it), the way compare-swipe does.
const mapStore = useMapStore();
const map = computed(() => mapStore.get(FLOW_MAP_ID)?.map ?? null);

/** A year change in flight: widths blend from the `start` snapshot to year `to`; `t` runs 0 to 1. */
type Tween = { start: MigrationFlow[]; to: number; t: number };
type Hover = { focus: FlowMapFocus; from: "map" | "list" };

// The whole table as flows, built once: flow-layer rebuilds its model whenever it is handed a new array.
const flows = migrationFlows(MIGRATION);
const first = periodStart(MIGRATION_PERIODS[0]!);
const last = periodStart(MIGRATION_PERIODS[MIGRATION_PERIODS.length - 1]!);
const largest = largestNet(flows, MIGRATION_LOCATIONS);
// One width scale and one circle scale for every year, so a width means the same count in each.
const countDomain: [number, number] = [0, largestPair(flows)];
const totalDomain: [number, number] = [0, largestTotal(flows, MIGRATION_LOCATIONS)];

const copy = computed(() => FLOW_MAP_COPY[props.lang]);
const hasKey = computed(() => props.apiKey.trim() !== "");
const places = computed(() => migrationPlaces(MIGRATION_LOCATIONS, props.lang));
const year = ref(last);
const hover = shallowRef<Hover | null>(null);
const selected = ref<string | null>(null);
const expanded = ref(false);
const tween = shallowRef<Tween>({ start: [], to: last, t: 1 });
// Read after mount: the server cannot know the pointer, so the first pass says "point".
const touch = ref(false);
const panel = useTemplateRef<HTMLElement>("panel");
const scroller = useTemplateRef<HTMLElement>("scroller");
const listId = useId();
let frame = 0;

const period = computed(() => periodLabel(year.value));
const preliminary = computed(() => period.value === MIGRATION_PRELIMINARY);
// A row under the pointer or the keyboard previews its province's flows; a pick keeps them.
const lit = computed(() => (hover.value?.from === "list" && hover.value.focus.kind === "place" ? hover.value.focus.id : null));
const shown = computed(() => touching(flows, lit.value ?? selected.value));
const timeRange = computed<[number, number]>(() => [year.value, year.value]);
const balances = computed(() => provinceBalances(flows, year.value, MIGRATION_LOCATIONS));
const nameOf = (id: string) => places.value.find((place) => place.id === id)?.name ?? id;

// The flows to draw: the table itself at rest, and a blend from the widths on screen to this
// year, a new array each frame, while the widths move.
const drawn = computed(() => {
  const { start, to, t } = tween.value;
  return t < 1 ? blendPairs(start, shown.value.filter((flow) => flow.time === to), to, easeOut(t)) : shown.value;
});

// A new year starts the blend at once (`sync`), so no frame shows the new year unblended, and it
// starts from what is on screen, so a change mid-blend never jumps. Reduced motion jumps.
watch(
  year,
  (next, previous) => {
    if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
    if (prefersReducedMotion() || typeof requestAnimationFrame !== "function") {
      tween.value = { start: [], to: next, t: 1 };
      return;
    }
    const snapshot = drawn.value.filter((flow) => flow.time === previous);
    tween.value = { start: snapshot, to: next, t: 0 };
    const began = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - began) / TWEEN_MS);
      tween.value = { start: snapshot, to: next, t };
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  },
  { flush: "sync" },
);

onScopeDispose(() => {
  if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
});

// The province the headline speaks for: the one under the pointer, else the one picked.
const pointed = computed(() => hover.value?.focus ?? null);
const headlineBalance = computed(() => {
  const id = pointed.value?.kind === "place" ? pointed.value.id : selected.value;
  return id ? balances.value.find((balance) => balance.id === id) : undefined;
});
const readout = computed(() => {
  const focus: FlowMapFocus | null = pointed.value ?? (selected.value ? { kind: "place", id: selected.value } : null);
  return focus ? describeFocus(focus, flows, year.value, places.value, props.lang) : null;
});
const hoveredRow = computed(() => (pointed.value?.kind === "place" ? pointed.value.id : null));
const totalSentence = computed(
  () =>
    `${copy.value.total(formatCount(yearTotal(flows, year.value), props.lang), period.value)}${preliminary.value ? ` ${copy.value.preliminary}` : ""}`,
);
const announcement = computed(() => {
  const picked = selected.value;
  if (!picked) return totalSentence.value;
  const balance = balances.value.find((candidate) => candidate.id === picked);
  const net = balance ? ` ${copy.value.sayNet(formatNet(balance.net, props.lang))}` : "";
  return `${totalSentence.value} ${copy.value.showing(nameOf(picked))}${net}`;
});

onMounted(() => {
  touch.value = coarsePointer();
});

// The camera frames every capital clear of the panel, without a move to watch: now, again when
// the map resizes and once the panel has slid in, until the reader moves the map themselves.
watch(
  [map, panel],
  ([live, element], _previous, onCleanup) => {
    if (!live) return;
    let moved = false;
    const fit = () => {
      if (moved) return;
      const padding = panelPadding(live.getContainer().getBoundingClientRect(), element?.getBoundingClientRect() ?? null);
      live.fitBounds(CAPITALS_BOUNDS, { padding, duration: 0 });
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

// The row's capital lights too, through the layer's own hover state.
watch(
  [map, lit],
  ([live, id], _previous, onCleanup) => {
    if (!live || !id || !live.getSource(FLOW_LOCATIONS_SOURCE)) return;
    live.setFeatureState({ source: FLOW_LOCATIONS_SOURCE, id }, { hover: true });
    onCleanup(() => {
      if (live.getSource(FLOW_LOCATIONS_SOURCE)) live.setFeatureState({ source: FLOW_LOCATIONS_SOURCE, id }, { hover: false });
    });
  },
  { immediate: true },
);

// A row lit from the map scrolls into the list's view. Only the list scrolls, never the page.
watch(
  hover,
  (next) => {
    const view = scroller.value;
    if (next?.from !== "map" || next.focus.kind !== "place" || !view) return;
    const id = next.focus.id;
    const row = [...view.querySelectorAll<HTMLElement>("[data-province]")].find((element) => element.getAttribute("data-province") === id);
    if (!row) return;
    const top = listScrollTop(view, row);
    if (top !== view.scrollTop) view.scrollTop = top;
  },
  { flush: "post" },
);

function setYear(value: number | [number, number] | undefined) {
  if (value === undefined) return;
  year.value = typeof value === "number" ? value : value[0];
}

function onMapHover(event: { feature: { properties: Record<string, unknown> } } | null) {
  const focus = event ? focusOf(event.feature.properties) : null;
  if (focus) hover.value = { focus, from: "map" };
  else if (hover.value?.from === "map") hover.value = null;
}

function onMapClick(event: { feature: { properties: Record<string, unknown> } }) {
  const focus = focusOf(event.feature.properties);
  if (focus?.kind === "place") pick(focus.id);
  // A tap on a flow describes it: a touch screen has no hover to do it.
  else if (focus) hover.value = { focus, from: "map" };
}

function pick(id: string | null) {
  selected.value = id === null || selected.value === id ? null : id;
}

function enterRow(id: string) {
  hover.value = { focus: { kind: "place", id }, from: "list" };
}

function leaveRow() {
  if (hover.value?.from === "list") hover.value = null;
}
</script>

<template>
  <!-- Where the map would be: the block's gutter, the Alert at a readable width, the first action first. -->
  <div
    v-if="!hasKey"
    data-unmap-block="flow-map"
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
  <div v-else data-unmap-block="flow-map" :class="['relative h-full min-h-[480px]', props.class]">
    <UnmapMap
      :id="FLOW_MAP_ID"
      :api-key="props.apiKey"
      :gateway="props.gateway"
      map-style="muted"
      :center="CANADA_VIEW.center"
      :zoom="CANADA_VIEW.zoom"
      :lang="props.lang"
      class="h-full"
    >
      <UnmapFlowLayer
        :map-id="FLOW_MAP_ID"
        :id="FLOW_LAYER_ID"
        :locations="places"
        :flows="drawn"
        :time-range="timeRange"
        :top-n="props.topN"
        :curvature="FLOW_CURVATURE"
        :count-domain="countDomain"
        :total-domain="totalDomain"
        :interactive="true"
        @hover="onMapHover"
        @click="onMapClick"
      />
      <p data-testid="flow-map-announce" aria-live="polite" class="sr-only">{{ announcement }}</p>
      <!-- A card floating on the map at 24 px; below `sm`, a sheet across the bottom that clears the attribution, leaves the map most of the screen, and grows, below the map controls, when the list is shown. -->
      <div
        ref="panel"
        data-flow-map-panel=""
        :data-expanded="expanded"
        class="absolute inset-x-4 bottom-10 z-10 flex max-h-[55%] flex-col max-sm:data-[expanded=true]:max-h-[calc(100%-9rem)] sm:inset-x-auto sm:top-6 sm:bottom-auto sm:left-6 sm:max-h-[calc(100%-3rem)] sm:w-[22rem] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-300 sm:motion-safe:slide-in-from-bottom-0 sm:motion-safe:slide-in-from-left-4"
      >
        <Card class="flex min-h-0 flex-1 flex-col">
          <CardHeader>
            <CardTitle role="heading" aria-level="2">{{ copy.title }}</CardTitle>
            <CardDescription class="max-sm:hidden">{{ copy.intro }}</CardDescription>
          </CardHeader>
          <!-- The scrubber stays put. On a wide screen the headline and the readout stay put too and only
               the list scrolls; in a phone's short sheet everything below the scrubber scrolls, so the
               list and the credit are always reachable. -->
          <CardContent class="flex min-h-0 flex-1 flex-col gap-4">
            <UnmapTimeSlider
              :map-id="FLOW_MAP_ID"
              :layers="NO_LAYERS"
              property="year"
              :min="first"
              :max="last"
              :model-value="year"
              :format="periodLabel"
              :lang="props.lang"
              :interval="1500"
              class="shrink-0"
              @update:model-value="setYear"
            />
            <div data-flow-map-body="" class="-mx-2 flex min-h-0 flex-1 flex-col gap-4 px-2 max-sm:overflow-y-auto max-sm:overscroll-contain">
              <!-- The headline, always there and always this tall, so nothing jumps as the years play. -->
              <div data-testid="flow-map-headline" class="flex min-h-16 shrink-0 flex-col justify-center gap-1">
                <p class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span class="text-3xl leading-none font-semibold tracking-tight tabular-nums">{{
                    headlineBalance ? formatNet(headlineBalance.net, props.lang) : formatCount(yearTotal(flows, year), props.lang)
                  }}</span>
                  {{ " " }}
                  <span class="text-sm text-muted-foreground">{{ headlineBalance ? copy.net : copy.moved }}</span>
                  <template v-if="preliminary">
                    {{ " " }}
                    <Badge variant="outline" class="self-center">{{ copy.preliminaryBadge }}</Badge>
                  </template>
                </p>
                <p class="text-sm text-muted-foreground">
                  {{ headlineBalance ? copy.placeCaption(nameOf(headlineBalance.id), period) : copy.movedCaption(period) }}
                </p>
              </div>
              <p :class="readout ? 'min-h-10 shrink-0 text-sm' : 'min-h-10 shrink-0 text-sm text-muted-foreground'">{{ readout ?? (touch ? copy.hintTouch : copy.hint) }}</p>
              <div class="flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t pt-3">
                <p class="text-sm font-medium">{{ copy.list }}</p>
                <div class="flex items-center gap-1">
                  <!-- Always there, hidden and out of reach until a pick, so the row never grows when one lands. -->
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    :class="selected ? undefined : 'invisible'"
                    :aria-hidden="selected ? undefined : 'true'"
                    :inert="selected ? undefined : true"
                    @click="pick(null)"
                  >
                    {{ copy.showAll }}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="sm:hidden"
                    :aria-expanded="expanded"
                    :aria-controls="listId"
                    @click="expanded = !expanded"
                  >
                    {{ expanded ? copy.hideList : copy.showList }}
                  </Button>
                </div>
                <!-- Gain and loss differ by side and sign as well as by colour. -->
                <p class="flex w-full items-center gap-4 text-xs text-muted-foreground">
                  <span class="flex items-center gap-1.5">
                    <span aria-hidden="true" class="h-2 w-3 rounded-sm bg-muted-foreground" />
                    {{ `− ${copy.lost}` }}
                  </span>
                  <span class="flex items-center gap-1.5">
                    <span aria-hidden="true" class="h-2 w-3 rounded-sm bg-primary" />
                    {{ `+ ${copy.gained}` }}
                  </span>
                </p>
              </div>
              <div ref="scroller" data-flow-map-scroll="" class="relative sm:-mx-2 sm:min-h-0 sm:flex-1 sm:overflow-y-auto sm:overscroll-contain sm:px-2">
                <ul
                  :id="listId"
                  :data-expanded="expanded"
                  :aria-label="copy.listLabel(period)"
                  class="flex flex-col gap-0.5 max-sm:data-[expanded=false]:hidden"
                >
                  <li v-for="balance in balances" :key="balance.id">
                    <Button
                      type="button"
                      :variant="balance.id === selected ? 'secondary' : 'ghost'"
                      :aria-pressed="balance.id === selected"
                      :data-province="balance.id"
                      :data-hovered="hoveredRow === balance.id ? 'true' : undefined"
                      class="h-auto w-full flex-col items-stretch gap-1 py-1.5 text-left whitespace-normal transition-colors hover:bg-muted focus-visible:bg-muted data-[hovered=true]:bg-muted"
                      @click="pick(balance.id)"
                      @mouseenter="enterRow(balance.id)"
                      @mouseleave="leaveRow"
                      @focus="enterRow(balance.id)"
                      @blur="leaveRow"
                    >
                      <span class="flex items-baseline justify-between gap-3">
                        <span
                          :class="
                            balance.id === selected
                              ? 'flex min-w-0 items-center gap-1.5 font-semibold'
                              : 'flex min-w-0 items-center gap-1.5 font-medium'
                          "
                        >
                          <!-- Picked is shown by weight and a mark, not by colour alone. -->
                          <span v-if="balance.id === selected" aria-hidden="true" data-selected-mark="">✓</span>
                          {{ nameOf(balance.id) }}
                        </span>
                        {{ " " }}
                        <span class="shrink-0 text-xs tabular-nums">{{ formatNet(balance.net, props.lang) }}</span>
                      </span>
                      <!-- One scale for every year: the bar grows right of the axis for a gain, left for a loss. -->
                      <span aria-hidden="true" class="relative h-2 w-full">
                        <span class="absolute inset-y-0 left-1/2 w-px bg-border" />
                        <span
                          :data-net-bar="balance.net >= 0 ? 'gain' : 'loss'"
                          :style="{ width: `${(Math.abs(balance.net) / largest) * 50}%` }"
                          :class="[
                            'absolute inset-y-0 rounded-sm motion-safe:transition-[width] motion-safe:duration-500 motion-safe:ease-out',
                            balance.net >= 0 ? 'left-1/2 bg-primary' : 'right-1/2 bg-muted-foreground',
                          ]"
                        />
                      </span>
                    </Button>
                  </li>
                </ul>
                <p class="py-3 text-xs text-muted-foreground">
                  <a
                    class="underline underline-offset-2"
                    :href="props.lang === 'fr' ? MIGRATION_SOURCE.urlFr : MIGRATION_SOURCE.url"
                    target="_blank"
                    rel="noreferrer"
                    >{{ MIGRATION_SOURCE[props.lang] }}</a
                  >
                  {{ copy.licences }}
                  <a class="underline underline-offset-2" :href="FLOW_MAP_LICENCES.statcan[props.lang]" target="_blank" rel="noreferrer">{{
                    copy.statcanLicence
                  }}</a
                  >,
                  <a class="underline underline-offset-2" :href="FLOW_MAP_LICENCES.ogl[props.lang]" target="_blank" rel="noreferrer">{{
                    copy.oglLicence
                  }}</a
                  >.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </UnmapMap>
  </div>
</template>
