<script lang="ts">
// --- address-playground helpers (kept identical across both lanes) ---
export type PlaygroundLang = "en" | "fr";

/** Why a request failed, as the copy names it; the text is read in the language shown, not the one asked in. */
export type PlaygroundError = "outside" | "busy" | "keyRefused" | "unavailable" | "failed";

/** The fields of a geocode result the page reads; `GeocodeResult` from @unmap/geocoding fits it. */
export interface PlaygroundPlace {
  id?: string;
  name?: string;
  layer?: string;
  lng?: number;
  lat?: number;
  source?: string;
  source_id?: string;
  match_type?: string;
  precision?: string;
  category?: string;
  distance?: number;
  names?: Record<string, string>;
  address?: { housenumber?: string; street?: string; city?: string; region?: string; postcode?: string; unit?: string };
}

/** One language's name for a place, with the record's other names in that language. */
export interface NameRow {
  /** The language tag, as the record keys it and as the page marks the text: `en`, `iu`, `iu-Latn`. */
  code: string;
  /** The language's name in the interface language. */
  label: string;
  text: string;
  also: string[];
}

/** Where a reader gets an unmap key: the no-key state's first action. */
export const KEY_URL = "https://unmap.dev/dashboard";

/** Where the search data is credited: OpenStreetMap's terms, and unmap's full list of sources. */
export const PLAYGROUND_CREDITS = {
  osm: "https://www.openstreetmap.org/copyright",
  attribution: { en: "https://unmap.dev/attribution", fr: "https://unmap.dev/fr/attribution" },
};

/** How many suggestions the search box asks for. */
export const SEARCH_LIMIT = 8;
/** The nearby list: the nearest five within 2 km of the result. */
export const NEARBY_RADIUS = 2000;
export const NEARBY_LIMIT = 5;

/** The two interface languages, each labelled in its own language. */
export const PLAYGROUND_LANGS: ReadonlyArray<{ code: PlaygroundLang; label: string }> = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
];

/** Categories the nearby list offers: canonical taxonomy ids the gateway accepts, with labels. */
export const PLAYGROUND_CATEGORIES = [
  { id: "health.pharmacy", en: "Pharmacy", fr: "Pharmacie" },
  { id: "food.cafe", en: "Café", fr: "Café" },
  { id: "shop.supermarket", en: "Grocery", fr: "Épicerie" },
  { id: "transport.fuel", en: "Gas station", fr: "Station-service" },
  { id: "education.school", en: "School", fr: "École" },
  { id: "culture.library", en: "Library", fr: "Bibliothèque" },
] as const;

/** Searches to try from the empty state, one autocomplete request each; `lang` marks the query's own language. */
export const PLAYGROUND_EXAMPLES: ReadonlyArray<{ query: string; lang?: string }> = [
  { query: "ᐃᖃᓗᐃᑦ", lang: "iu" },
  { query: "Vieux-Montréal", lang: "fr" },
  { query: "111 Wellington St Ottawa", lang: "en" },
];

export const PLAYGROUND_COPY = {
  en: {
    title: "Look up any place in Canada",
    intro: "Search an address, a place or a pair of coordinates, and see every name the record carries, in every language it has.",
    language: "Language",
    placeholder: "Search an address or a place",
    try: "Try",
    coordinates: "Coordinates work too, like 51.05,\u00a0-114.07.",
    emptyTitle: "Choose a result to see everything it carries.",
    emptyBody: "Its names in each language the record has, Inuktitut syllabics included where present.",
    looking: (query: string) => `Looking up ${query}...`,
    noMatch: (query: string) => `Nothing found for ${query}. Try another spelling, or type it in the search box.`,
    names: "Names",
    namesNone: "This record has no names by language, only the one above.",
    also: "Also known as",
    details: "Details",
    fields: {
      layer: "Type",
      category: "Category",
      precision: "Precision",
      matchType: "Match",
      source: "Source",
      sourceId: "Source ID",
      coordinates: "Coordinates",
      id: "ID",
    },
    layers: {
      address: "Address",
      street: "Street",
      locality: "Locality",
      region: "Region",
      poi: "Place",
      legal_land: "Legal land",
      well: "Well",
      facility: "Facility",
      parcel: "Parcel",
    } as Record<string, string>,
    nearby: "Nearby",
    nearbyHint: "The nearest five within 2 km.",
    category: "Category",
    nearbyIdle: "Pick a category to list what is near this place.",
    nearbyEmpty: "Nothing of this kind within 2 km.",
    nearbyLoading: "Searching nearby...",
    retry: "Try again",
    failedTitle: "That search did not work.",
    outside: "That point is outside Canada. Search covers Canada.",
    busy: "Too many requests. Try again in a moment.",
    keyRefused: "The API key was refused. Check it and try again.",
    unavailable: "The service didn't answer. Try again in a moment.",
    failed: "The search failed. Try again.",
    announceNames: (languages: string) => ` Names in ${languages}.`,
    announceNearby: (category: string, count: number, nearest: string, distance: string) =>
      `${category}: ${count} within 2 km. Nearest: ${nearest}, ${distance}.`,
    announceNearbyNone: (category: string) => `${category}: nothing within 2 km.`,
    creditLead: "Search data:",
    osm: "OpenStreetMap contributors",
    creditMiddle: "(ODbL) and Canadian open data. Each result names its source;",
    creditLink: "full credits",
    noKeyTitle: "Add your unmap key to start searching.",
    getKey: "Get a key",
    noKey:
      'No unmap key. Pass apiKey. On Next.js, set NEXT_PUBLIC_UNMAP_KEY in .env.local. On Nuxt, set NUXT_PUBLIC_UNMAP_KEY in .env. If you installed with unmap add, nuxt.config already declares runtimeConfig: { public: { unmapKey: "" } }; otherwise add it there. Then restart the dev server.',
  },
  fr: {
    title: "Trouvez n'importe quel lieu au Canada",
    intro: "Cherchez une adresse, un lieu ou une paire de coordonnées, et voyez tous les noms de la fiche, dans chaque langue qu'elle contient.",
    language: "Langue",
    placeholder: "Chercher une adresse ou un lieu",
    try: "Essayez",
    coordinates: "Les coordonnées fonctionnent aussi, par exemple 51,05;\u00a0-114,07.",
    emptyTitle: "Choisissez un résultat pour voir tout ce qu'il contient.",
    emptyBody: "Ses noms dans chaque langue de la fiche, y compris le syllabique inuktitut quand il y en a.",
    looking: (query: string) => `Recherche de ${query}...`,
    noMatch: (query: string) => `Aucun résultat pour ${query}. Essayez une autre orthographe, ou tapez-le dans la recherche.`,
    names: "Noms",
    namesNone: "Cette fiche n'a pas de noms par langue, seulement celui ci-dessus.",
    also: "Aussi appelé",
    details: "Détails",
    fields: {
      layer: "Type",
      category: "Catégorie",
      precision: "Précision",
      matchType: "Correspondance",
      source: "Source",
      sourceId: "ID à la source",
      coordinates: "Coordonnées",
      id: "ID",
    },
    layers: {
      address: "Adresse",
      street: "Rue",
      locality: "Localité",
      region: "Région",
      poi: "Lieu",
      legal_land: "Terre légale",
      well: "Puits",
      facility: "Installation",
      parcel: "Parcelle",
    } as Record<string, string>,
    nearby: "À proximité",
    nearbyHint: "Les cinq plus proches à moins de 2 km.",
    category: "Catégorie",
    nearbyIdle: "Choisissez une catégorie pour voir ce qui se trouve près de ce lieu.",
    nearbyEmpty: "Rien de ce type à moins de 2 km.",
    nearbyLoading: "Recherche à proximité...",
    retry: "Réessayer",
    failedTitle: "Cette recherche n'a pas fonctionné.",
    outside: "Ce point est hors du Canada. La recherche couvre le Canada.",
    busy: "Trop de requêtes. Réessayez dans un instant.",
    keyRefused: "La clé API a été refusée. Vérifiez-la et réessayez.",
    unavailable: "Le service n'a pas répondu. Réessayez dans un instant.",
    failed: "La recherche a échoué. Réessayez.",
    announceNames: (languages: string) => ` Noms en ${languages}.`,
    announceNearby: (category: string, count: number, nearest: string, distance: string) =>
      `${category} : ${count} à moins de 2 km. Le plus proche : ${nearest}, ${distance}.`,
    announceNearbyNone: (category: string) => `${category} : rien à moins de 2 km.`,
    creditLead: "Données de recherche :",
    osm: "contributeurs d'OpenStreetMap",
    creditMiddle: "(ODbL) et données ouvertes canadiennes. Chaque résultat nomme sa source\u00a0;",
    creditLink: "toutes les sources",
    noKeyTitle: "Ajoutez votre clé unmap pour commencer à chercher.",
    getKey: "Obtenir une clé",
    noKey:
      'Aucune clé unmap. Passez apiKey. Avec Next.js, définissez NEXT_PUBLIC_UNMAP_KEY dans .env.local. Avec Nuxt, définissez NUXT_PUBLIC_UNMAP_KEY dans .env. Si vous avez installé le bloc avec unmap add, nuxt.config déclare déjà runtimeConfig: { public: { unmapKey: "" } } ; sinon, ajoutez-le. Redémarrez ensuite le serveur de développement.',
  },
};

export function isLang(value: unknown): value is PlaygroundLang {
  return value === "en" || value === "fr";
}

/** True for a key that is itself a language tag the page can mark text with: `en`, `iu`, `iu-Latn`; not `en-alt1`. */
export function isNameTag(key: string): boolean {
  return /^[a-z]{2,3}(-[A-Z][a-z]{3})?$/.test(key);
}

/**
 * Language names the page sets itself, in both interface languages: the official two and the
 * Indigenous languages the record most often carries (CGNDB folds Inuktitut, Cree and Ojibwe
 * dialects to `iu`, `cr` and `oj`). Browsers ship names for few of these, so the page does not
 * rely on them; any other tag is named by `Intl.DisplayNames` when the browser can, else shown as
 * the tag itself.
 */
export const LANGUAGE_NAMES: Record<string, { en: string; fr: string }> = {
  en: { en: "English", fr: "anglais" },
  fr: { en: "French", fr: "français" },
  iu: { en: "Inuktitut", fr: "inuktitut" },
  cr: { en: "Cree", fr: "cri" },
  oj: { en: "Ojibwe", fr: "ojibwé" },
  moe: { en: "Innu", fr: "innu" },
  alq: { en: "Algonquin", fr: "algonquin" },
  atj: { en: "Atikamekw", fr: "atikamekw" },
  mic: { en: "Mi'kmaq", fr: "mi'kmaq" },
  moh: { en: "Mohawk", fr: "mohawk" },
  nsk: { en: "Naskapi", fr: "naskapi" },
  bla: { en: "Blackfoot", fr: "pied-noir" },
  crg: { en: "Michif", fr: "mitchif" },
  gwi: { en: "Gwich'in", fr: "gwich'in" },
  hai: { en: "Haida", fr: "haïda" },
  tli: { en: "Tlingit", fr: "tlingit" },
};

/** Script names for a tag's script subtag: `iu-Latn` is Inuktitut written in the Latin alphabet. */
export const SCRIPT_NAMES: Record<string, { en: string; fr: string }> = {
  Latn: { en: "Latin", fr: "latin" },
  Cans: { en: "syllabics", fr: "syllabique" },
};

function displayName(code: string, lang: PlaygroundLang, type: "language" | "script"): string | undefined {
  try {
    return new Intl.DisplayNames([lang], { type, fallback: "none" }).of(code) ?? undefined;
  } catch {
    return undefined;
  }
}

/** A language tag's name in the interface language: "Inuktitut (Latin)" for `iu-Latn`, or the tag when nothing names it. */
export function languageName(code: string, lang: PlaygroundLang): string {
  const [base = "", script] = code.split("-");
  const language = LANGUAGE_NAMES[base]?.[lang] ?? displayName(base, lang, "language");
  if (!language) return code;
  if (!script) return language;
  return `${language} (${SCRIPT_NAMES[script]?.[lang] ?? displayName(script, lang, "script") ?? script})`;
}

/**
 * A record's names, one row per language: the interface language first, then the other official
 * language, then the rest by tag. Keys the record adds to a language (`en-alt1`, `fr-alt2`,
 * `en-iata`) are listed under it as `also`, a repeat in another case once; a language with only
 * those takes the first as its name. Blank names, and keys that name no language, are left out.
 */
export function nameRows(names: Record<string, string> | undefined, lang: PlaygroundLang): NameRow[] {
  const rows: Record<string, { text: string; also: string[] }> = {};
  const entries = Object.entries(names ?? {})
    .map(([key, text]) => [key, typeof text === "string" ? text.trim() : ""] as const)
    .filter(([, text]) => text !== "");
  for (const [key, text] of entries) {
    if (isNameTag(key)) rows[key] = { text, also: [] };
  }
  for (const [key, text] of entries) {
    const base = key.split("-")[0] ?? "";
    if (isNameTag(key) || !isNameTag(base)) continue;
    const row = rows[base] ?? { text: "", also: [] };
    rows[base] = row;
    if (![row.text, ...row.also].some((seen) => seen.toLowerCase() === text.toLowerCase())) row.also.push(text);
  }
  const other = lang === "en" ? "fr" : "en";
  const order = (code: string) => (code === lang ? 0 : code === other ? 1 : 2);
  return Object.entries(rows)
    .sort(([a], [b]) => order(a) - order(b) || (a < b ? -1 : a > b ? 1 : 0))
    .map(([code, row]) => {
      const [text, ...also] = row.text ? [row.text, ...row.also] : row.also;
      return { code, label: languageName(code, lang), text: text ?? "", also };
    });
}

/** The record's name in a script other than Latin (syllabics beside "Iqaluit"), found by its script, not its tag. */
export function otherScriptName(result: { name?: string; names?: Record<string, string> }): { code: string; text: string } | undefined {
  for (const [code, raw] of Object.entries(result.names ?? {})) {
    const text = typeof raw === "string" ? raw.trim() : "";
    if (isNameTag(code) && text !== "" && text !== result.name && /\p{L}/u.test(text) && !/\p{Script=Latin}/u.test(text)) {
      return { code, text };
    }
  }
  return undefined;
}

/**
 * The tag of the language the record's own name is in: the first language, interface language
 * first, whose name is that name. Undefined when none is, so the text keeps the page's language.
 */
export function nameTag(result: { name?: string; names?: Record<string, string> }, lang: PlaygroundLang): string | undefined {
  const name = (result.name ?? "").trim();
  return name === "" ? undefined : nameRows(result.names, lang).find((row) => row.text === name)?.code;
}

/** The address as a Canadian writes it: unit-number street, city, province postal code. Absent parts are left out. */
export function addressLine(result: PlaygroundPlace): string {
  const address = result.address ?? {};
  const street = [address.housenumber, address.street].filter(Boolean).join(" ");
  const line = address.unit && street ? `${address.unit}-${street}` : street;
  const region = [address.region, address.postcode].filter(Boolean).join(" ");
  return [line, address.city, region].filter(Boolean).join(", ");
}

/** The result's type in words, or the API's own value for a type the page has no words for. */
export function layerLabel(layer: string | undefined, lang: PlaygroundLang): string {
  return layer ? (PLAYGROUND_COPY[lang].layers[layer] ?? layer) : "";
}

/** A category id in words when it is one of the page's six, else the id as the API returns it. */
export function categoryLabel(id: string, lang: PlaygroundLang): string {
  return PLAYGROUND_CATEGORIES.find((entry) => entry.id === id)?.[lang] ?? id;
}

/** The fields a result carries, labelled, in a fixed order and as the API returns them; absent fields are left out. */
export function detailFields(result: PlaygroundPlace, lang: PlaygroundLang): Array<[string, string]> {
  const labels = PLAYGROUND_COPY[lang].fields;
  const point = typeof result.lat === "number" && typeof result.lng === "number" ? `${result.lat.toFixed(5)}, ${result.lng.toFixed(5)}` : undefined;
  const fields: Array<[string, string | undefined]> = [
    [labels.layer, result.layer],
    [labels.category, result.category],
    [labels.precision, result.precision],
    [labels.matchType, result.match_type],
    [labels.source, result.source],
    [labels.sourceId, result.source_id],
    [labels.coordinates, point],
    [labels.id, result.id],
  ];
  return fields.filter((field): field is [string, string] => typeof field[1] === "string" && field[1] !== "");
}

/** Metres for people: metres under a kilometre, else kilometres to one decimal. */
export function formatDistance(metres: number, lang: PlaygroundLang): string {
  const locale = lang === "fr" ? "fr-CA" : "en-CA";
  return metres < 1000
    ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(metres)} m`
    : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(metres / 1000)} km`;
}

/** A list in the interface language's own way: "A, B, and C", "A, B et C". */
export function listOf(items: string[], lang: PlaygroundLang): string {
  try {
    return new Intl.ListFormat([lang], { type: "conjunction" }).format(items);
  } catch {
    return items.join(", ");
  }
}

/**
 * The chosen result in one sentence for the live region: its name, where it is, and its
 * languages. A place whose address starts with its own name is said once: "Iqaluit, NU".
 */
export function describeResult(result: PlaygroundPlace, lang: PlaygroundLang): string {
  const copy = PLAYGROUND_COPY[lang];
  const labels = nameRows(result.names, lang).map((row) => row.label);
  const name = result.name ?? "";
  const place = addressLine(result);
  const head = `${place === "" ? name : place === name || place.startsWith(`${name}, `) ? place : `${name}, ${place}`}.`;
  return labels.length > 0 ? `${head}${copy.announceNames(listOf(labels, lang))}` : head;
}

/** A nearby answer in one sentence for the live region: how many, and the nearest. */
export function describeNearby(results: PlaygroundPlace[], category: string, lang: PlaygroundLang): string {
  const copy = PLAYGROUND_COPY[lang];
  const label = categoryLabel(category, lang);
  const nearest = results[0];
  if (!nearest) return copy.announceNearbyNone(label);
  const distance = typeof nearest.distance === "number" ? formatDistance(nearest.distance, lang) : "";
  return copy.announceNearby(label, results.length, nearest.name ?? "", distance);
}

/**
 * Why a request failed: the place, the key or the rate when the gateway says so; a service that
 * did not answer for a 5xx or a request that never got an HTTP answer.
 */
export function errorKind(caught: unknown): PlaygroundError {
  const failure = typeof caught === "object" && caught !== null ? (caught as { code?: unknown; status?: unknown }) : {};
  const status = typeof failure.status === "number" ? failure.status : null;
  if (failure.code === "outside_coverage") return "outside";
  if (status === 429) return "busy";
  if (status === 401 || status === 403) return "keyRefused";
  if (status === null || status >= 500) return "unavailable";
  return "failed";
}

/** What to tell the reader about a failed request, in `lang`. */
export function requestError(caught: unknown, lang: PlaygroundLang): string {
  return PLAYGROUND_COPY[lang][errorKind(caught)];
}

export function isAbort(caught: unknown): boolean {
  return typeof caught === "object" && caught !== null && (caught as { name?: unknown }).name === "AbortError";
}
// --- end address-playground helpers ---
</script>

<script setup lang="ts">
/**
 * <UnmapAddressPlayground> - unmap search with no map, for Vue and Nuxt: a search page in one
 * component. Type an address, a place or a pair of coordinates, choose a result, and see
 * everything the record carries: every name it has, each marked with its language (a name in
 * syllabics set beside the name itself, where the record has one), its type, precision, match and
 * source as the API returns them, and the nearest places of six categories around it. A nearby
 * place opens the same way.
 *
 * The block provides a map store with no map (`useMapStore()`), so the registry's geocoder finds
 * the store it reads, no MapLibre map is ever created and choosing a result flies nothing. Each
 * action is one request to the unmap API on your key: each pause in typing calls
 * /geocode/autocomplete (/geocode/reverse for typed coordinates), each example under the box calls
 * /geocode/autocomplete once, and each category calls /geocode/nearby. Nothing is requested until
 * the reader acts. Results are OpenStreetMap and Canadian open data, credited on the page.
 *
 * Installed by `npx shadcn-vue add` with its page at app/pages/address-playground.vue. Edit freely.
 */
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useId, watch, type HTMLAttributes } from "vue";
import { Geocoder as GeocoderClient, type GeocodeResult } from "@unmap/geocoding";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UnmapGeocoder } from "@/components/ui/geocoder";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useMapStore } from "@/lib/map-context";

const props = withDefaults(
  defineProps<{
    /** unmap API key. The page passes NUXT_PUBLIC_UNMAP_KEY. With none, the block asks for one and loads nothing. */
    apiKey: string;
    /** Gateway base URL. Defaults to the unmap production gateway. */
    gateway?: string;
    /** The language it starts in; the reader can switch. Defaults to "en". */
    lang?: PlaygroundLang;
    class?: HTMLAttributes["class"];
  }>(),
  { lang: "en" },
);

// Failures and announcements keep what happened, not finished sentences: the text is read at
// render, so switching language says them again in the new one.
type Lookup =
  | { kind: "idle" }
  | { kind: "loading"; query: string }
  | { kind: "error"; query: string; error: PlaygroundError | "noMatch" }
  | { kind: "result"; result: GeocodeResult };

type Nearby = { kind: "idle" } | { kind: "loading" } | { kind: "error"; error: PlaygroundError } | { kind: "result"; results: GeocodeResult[] };

type Said = { kind: "result"; result: GeocodeResult } | { kind: "nearby"; results: GeocodeResult[]; category: string } | null;

// A map store with no map: the geocoder injects one, and with no UnmapMap under it none is ever made.
useMapStore();

const lang = ref<PlaygroundLang>(props.lang);
const copy = computed(() => PLAYGROUND_COPY[lang.value]);
const hasKey = computed(() => props.apiKey.trim() !== "");
const client = computed(() => new GeocoderClient({ key: props.apiKey, gateway: props.gateway }));
const lookup = shallowRef<Lookup>({ kind: "idle" });
const category = ref<string | null>(null);
const nearby = shallowRef<Nearby>({ kind: "idle" });
// Bumped by "Try again" on a failed nearby request, to ask again with nothing else changed.
const attempt = ref(0);
// What the live region says: the chosen result once, then each nearby answer. Nothing until the reader acts.
const said = shallowRef<Said>(null);
// The result card's name: focused when a nearby place opens, since the button that opened it goes with the old card.
const titleRef = ref<{ $el?: HTMLElement } | HTMLElement | null>(null);
let lookupController: AbortController | null = null;
const namesId = useId();
const detailsId = useId();
const nearbyId = useId();

const selected = computed(() => (lookup.value.kind === "result" ? lookup.value.result : null));
const loadingQuery = computed(() => (lookup.value.kind === "loading" ? lookup.value.query : null));
const failure = computed(() => (lookup.value.kind === "error" ? lookup.value : null));
const other = computed(() => (selected.value ? otherScriptName(selected.value) : undefined));
const place = computed(() => (selected.value ? addressLine(selected.value) : ""));
const rows = computed(() => (selected.value ? nameRows(selected.value.names, lang.value) : []));
const fields = computed(() => (selected.value ? detailFields(selected.value, lang.value) : []));
const nearbyResults = computed(() => (nearby.value.kind === "result" ? nearby.value.results : []));
const nearbyError = computed(() => (nearby.value.kind === "error" ? copy.value[nearby.value.error] : null));
const failureMessage = computed(() => {
  const current = failure.value;
  if (!current) return "";
  return current.error === "noMatch" ? copy.value.noMatch(current.query) : copy.value[current.error];
});
const saying = computed(() => {
  const current = said.value;
  if (!current) return "";
  return current.kind === "result" ? describeResult(current.result, lang.value) : describeNearby(current.results, current.category, lang.value);
});

// One nearby request per result, category and language; a newer one aborts it.
watch(
  [client, selected, category, lang, attempt],
  ([current, result, kind, language], _previous, onCleanup) => {
    if (!result || !kind) {
      nearby.value = { kind: "idle" };
      return;
    }
    const controller = new AbortController();
    nearby.value = { kind: "loading" };
    current
      .nearby(kind, { near: [result.lng, result.lat], radius: NEARBY_RADIUS, limit: NEARBY_LIMIT, lang: language, signal: controller.signal })
      .then((results) => {
        if (controller.signal.aborted) return;
        nearby.value = { kind: "result", results };
        said.value = { kind: "nearby", results, category: kind };
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted && !isAbort(caught)) nearby.value = { kind: "error", error: errorKind(caught) };
      });
    onCleanup(() => controller.abort());
  },
);

onBeforeUnmount(() => lookupController?.abort());

function show(result: GeocodeResult) {
  lookupController?.abort();
  lookup.value = { kind: "result", result };
  category.value = null;
  said.value = { kind: "result", result };
}

function openNearby(result: GeocodeResult) {
  show(result);
  void nextTick(() => {
    const title = titleRef.value;
    const element = title instanceof HTMLElement ? title : title?.$el;
    element?.focus();
  });
}

function tryExample(query: string) {
  lookupController?.abort();
  const controller = new AbortController();
  lookupController = controller;
  lookup.value = { kind: "loading", query };
  category.value = null;
  client.value
    .autocomplete(query, { limit: 1, lang: lang.value, signal: controller.signal })
    .then(([first]) => {
      if (controller.signal.aborted) return;
      if (first) show(first);
      else lookup.value = { kind: "error", query, error: "noMatch" };
    })
    .catch((caught: unknown) => {
      if (!controller.signal.aborted && !isAbort(caught)) lookup.value = { kind: "error", query, error: errorKind(caught) };
    });
}

function chooseLang(next: unknown) {
  // Pressing the pressed item empties a single-select group: the language stays.
  if (isLang(next)) lang.value = next;
}

function chooseCategory(next: unknown) {
  category.value = typeof next === "string" ? next : null;
}

/** An option's second line: where it is, then what it is. */
function optionMeta(result: GeocodeResult): string {
  return [addressLine(result), layerLabel(result.layer, lang.value)].filter(Boolean).join(" · ");
}

/** A nearby place's second line: its street, else its city. */
function streetOf(result: GeocodeResult): string {
  return [result.address?.housenumber, result.address?.street].filter(Boolean).join(" ") || (result.address?.city ?? "");
}

/** A distance's value and its unit, the unit set quieter: ["850", "m"]. */
function distanceParts(metres: number): [string, string] {
  const text = formatDistance(metres, lang.value);
  const split = text.lastIndexOf(" ");
  return [text.slice(0, split), text.slice(split + 1)];
}
</script>

<template>
  <!-- Where the page would be: the block's gutter, the Alert at a readable width, the first action first. -->
  <div
    v-if="!hasKey"
    data-unmap-block="address-playground"
    data-state="no-key"
    :lang="props.lang"
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
  <div v-else data-unmap-block="address-playground" :lang="lang" :class="['h-full min-h-[480px] overflow-y-auto p-4 sm:p-6', props.class]">
    <div class="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header class="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div class="flex min-w-0 flex-1 basis-64 flex-col gap-1.5">
          <h2 class="text-xl font-semibold tracking-tight text-balance">{{ copy.title }}</h2>
          <p class="text-sm text-pretty text-muted-foreground">{{ copy.intro }}</p>
        </div>
        <ToggleGroup type="single" variant="outline" size="sm" :aria-label="copy.language" :model-value="lang" @update:model-value="chooseLang">
          <ToggleGroupItem v-for="entry in PLAYGROUND_LANGS" :key="entry.code" :value="entry.code" :lang="entry.code" class="px-3 data-[state=on]:font-semibold">
            {{ entry.label }}
          </ToggleGroupItem>
        </ToggleGroup>
      </header>

      <div class="flex flex-col gap-3">
        <UnmapGeocoder :api-key="props.apiKey" :gateway="props.gateway" :lang="lang" :limit="SEARCH_LIMIT" :placeholder="copy.placeholder" :error-text="(caught: unknown) => requestError(caught, lang)" @select="show">
          <template #result="{ result }">
            <span class="flex min-w-0 flex-col">
              <span class="truncate" :lang="nameTag(result, lang)">{{ result.name }}</span>
              <span v-if="otherScriptName(result)" class="truncate text-xs" :lang="otherScriptName(result)!.code">{{ otherScriptName(result)!.text }}</span>
              <span v-if="optionMeta(result)" class="truncate text-xs text-muted-foreground">{{ optionMeta(result) }}</span>
            </span>
          </template>
        </UnmapGeocoder>
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-muted-foreground">{{ copy.try }}</span>
          <Button
            v-for="example in PLAYGROUND_EXAMPLES"
            :key="example.query"
            type="button"
            variant="outline"
            size="sm"
            :lang="example.lang"
            @click="tryExample(example.query)"
          >
            {{ example.query }}
          </Button>
        </div>
        <p class="text-xs text-muted-foreground">{{ copy.coordinates }}</p>
      </div>

      <p data-testid="address-playground-announce" aria-live="polite" class="sr-only">{{ saying }}</p>

      <!-- Where the answer lands, always this tall, so nothing below it jumps when one arrives. -->
      <div data-testid="address-playground-answer" :aria-busy="loadingQuery !== null" class="min-h-72 sm:min-h-[26rem]">
        <div
          v-if="lookup.kind === 'idle'"
          class="flex h-full min-h-72 flex-col items-center justify-center gap-2 rounded-xl sm:min-h-[26rem] border border-dashed p-6 text-center motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300"
        >
          <p class="text-base font-medium text-balance">{{ copy.emptyTitle }}</p>
          <p class="max-w-md text-sm text-pretty text-muted-foreground">{{ copy.emptyBody }}</p>
        </div>
        <!-- The result card's shape while an example is looked up: badge, name, place, two name tiles, details. -->
        <Card v-else-if="loadingQuery !== null">
          <p role="status" class="sr-only">{{ copy.looking(loadingQuery) }}</p>
          <CardHeader class="gap-2" aria-hidden="true">
            <Skeleton class="h-5 w-16" />
            <Skeleton class="h-8 w-2/3" />
            <Skeleton class="h-4 w-1/3" />
          </CardHeader>
          <CardContent class="flex flex-col gap-6" aria-hidden="true">
            <div class="flex flex-col gap-2">
              <Skeleton class="h-4 w-16" />
              <div class="grid gap-2 sm:grid-cols-2">
                <Skeleton class="h-[4.5rem] w-full" />
                <Skeleton class="h-[4.5rem] w-full" />
              </div>
            </div>
            <div class="grid gap-6 md:grid-cols-2">
              <div class="flex flex-col gap-2">
                <Skeleton v-for="index in 5" :key="index" class="h-4 w-full" />
              </div>
              <div class="flex flex-col gap-3">
                <Skeleton class="h-4 w-20" />
                <div class="flex flex-wrap gap-2">
                  <Skeleton v-for="index in PLAYGROUND_CATEGORIES.length" :key="index" class="h-7 w-20" />
                </div>
                <div class="min-h-[14.75rem]" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Alert v-else-if="failure" variant="destructive" role="alert" class="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
          <AlertTitle class="line-clamp-none">{{ copy.failedTitle }}</AlertTitle>
          <AlertDescription class="flex flex-col items-start gap-3">
            <p>{{ failureMessage }}</p>
            <Button v-if="failure.error !== 'noMatch'" type="button" variant="outline" size="sm" @click="tryExample(failure.query)">{{ copy.retry }}</Button>
          </AlertDescription>
        </Alert>
        <Card
          v-else-if="selected"
          :key="selected.id"
          class="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-200"
        >
          <CardHeader class="gap-2">
            <div class="flex flex-wrap gap-1.5">
              <Badge variant="secondary">{{ layerLabel(selected.layer, lang) }}</Badge>
              <Badge v-if="selected.category" variant="outline">{{ categoryLabel(selected.category, lang) }}</Badge>
            </div>
            <CardTitle
              ref="titleRef"
              role="heading"
              aria-level="3"
              tabindex="-1"
              :lang="nameTag(selected, lang)"
              class="rounded-sm text-2xl leading-tight font-semibold tracking-tight break-words outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-3xl"
            >
              {{ selected.name }}
            </CardTitle>
            <!-- The name in its own script, set as large as the name: the record carries it, so the page shows it. -->
            <p v-if="other" data-testid="address-playground-script" class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span :lang="other.code" class="text-2xl leading-tight font-semibold break-words text-primary sm:text-3xl">{{ other.text }}</span>
              <span class="text-sm text-muted-foreground">{{ languageName(other.code, lang) }}</span>
            </p>
            <CardDescription v-if="place">{{ place }}</CardDescription>
          </CardHeader>
          <CardContent class="flex flex-col gap-6">
            <section :aria-labelledby="namesId" class="flex flex-col gap-2">
              <h4 :id="namesId" class="text-sm font-medium">{{ copy.names }}</h4>
              <dl v-if="rows.length > 0" class="grid gap-2 sm:grid-cols-2">
                <div v-for="row in rows" :key="row.code" class="flex min-w-0 flex-col gap-1 rounded-lg border p-3">
                  <dt class="text-xs text-muted-foreground first-letter:uppercase">{{ row.label }}</dt>
                  <dd :lang="row.code" class="text-lg leading-snug font-medium break-words">{{ row.text }}</dd>
                  <dd v-if="row.also.length > 0" class="text-xs text-muted-foreground">
                    {{ `${copy.also} ` }}<span :lang="row.code">{{ row.also.join(", ") }}</span>
                  </dd>
                </div>
              </dl>
              <p v-else class="text-sm text-muted-foreground">{{ copy.namesNone }}</p>
            </section>
            <div class="grid gap-6 md:grid-cols-2">
              <section :aria-labelledby="detailsId" class="flex min-w-0 flex-col gap-2">
                <h4 :id="detailsId" class="text-sm font-medium">{{ copy.details }}</h4>
                <dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
                  <template v-for="[label, value] in fields" :key="label">
                    <dt class="text-muted-foreground">{{ label }}</dt>
                    <dd class="font-mono text-xs leading-5 break-all tabular-nums">{{ value }}</dd>
                  </template>
                </dl>
              </section>
              <section :aria-labelledby="nearbyId" class="flex min-w-0 flex-col gap-3">
                <div class="flex flex-wrap items-baseline justify-between gap-x-3">
                  <h4 :id="nearbyId" class="text-sm font-medium">{{ copy.nearby }}</h4>
                  <p class="text-xs text-muted-foreground">{{ copy.nearbyHint }}</p>
                </div>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  :aria-label="copy.category"
                  :model-value="category ?? undefined"
                  class="w-full flex-wrap"
                  @update:model-value="chooseCategory"
                >
                  <ToggleGroupItem v-for="entry in PLAYGROUND_CATEGORIES" :key="entry.id" :value="entry.id" class="data-[state=on]:font-semibold">
                    {{ entry[lang] }}
                  </ToggleGroupItem>
                </ToggleGroup>
                <!-- Five rows tall whatever it holds, so an answer never moves the page. -->
                <div data-testid="address-playground-nearby" :aria-busy="nearby.kind === 'loading'" class="min-h-[14.75rem]">
                  <p v-if="nearby.kind === 'idle'" class="text-sm text-muted-foreground">{{ copy.nearbyIdle }}</p>
                  <template v-else-if="nearby.kind === 'loading'">
                    <p role="status" class="sr-only">{{ copy.nearbyLoading }}</p>
                    <ul aria-hidden="true" class="flex flex-col gap-1">
                      <li v-for="index in NEARBY_LIMIT" :key="index" data-skeleton-row="" class="flex h-11 items-center justify-between gap-3 px-2">
                        <span class="flex flex-col gap-1.5">
                          <Skeleton class="h-3.5 w-36" />
                          <Skeleton class="h-3 w-24" />
                        </span>
                        <Skeleton class="h-3.5 w-12" />
                      </li>
                    </ul>
                  </template>
                  <Alert v-else-if="nearbyError" variant="destructive" role="alert">
                    <AlertDescription class="flex flex-col items-start gap-2">
                      <p>{{ nearbyError }}</p>
                      <Button type="button" variant="outline" size="sm" @click="attempt += 1">{{ copy.retry }}</Button>
                    </AlertDescription>
                  </Alert>
                  <p v-else-if="nearbyResults.length === 0" class="text-sm text-muted-foreground">{{ copy.nearbyEmpty }}</p>
                  <ol v-else :aria-label="copy.nearby" class="flex flex-col gap-1">
                    <li
                      v-for="(found, index) in nearbyResults"
                      :key="found.id"
                      class="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:fill-mode-backwards motion-safe:duration-200"
                      :style="{ animationDelay: `${index * 40}ms` }"
                    >
                      <Button type="button" variant="ghost" class="h-11 w-full justify-between gap-3 px-2 text-left font-normal" @click="openNearby(found)">
                        <span class="flex min-w-0 flex-col">
                          <span class="truncate text-sm font-medium">{{ found.name }}</span>
                          <span class="truncate text-xs text-muted-foreground">{{ streetOf(found) }}</span>
                        </span>
                        <span v-if="typeof found.distance === 'number'" class="shrink-0 text-sm tabular-nums">
                          {{ distanceParts(found.distance)[0] }}<span class="text-xs text-muted-foreground">{{ ` ${distanceParts(found.distance)[1]}` }}</span>
                        </span>
                      </Button>
                    </li>
                  </ol>
                </div>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>

      <p data-testid="address-playground-credits" class="text-xs text-pretty text-muted-foreground">
        {{ `${copy.creditLead} ` }}<a class="underline underline-offset-2" :href="PLAYGROUND_CREDITS.osm" target="_blank" rel="noreferrer">{{ copy.osm }}</a
        >{{ ` ${copy.creditMiddle} ` }}<a class="underline underline-offset-2" :href="PLAYGROUND_CREDITS.attribution[lang]" target="_blank" rel="noreferrer">{{
          copy.creditLink
        }}</a
        >.
      </p>
    </div>
  </div>
</template>
