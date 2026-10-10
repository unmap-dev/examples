"use client";

/**
 * <AddressPlayground> - unmap search with no map: a search page in one component. Type an address,
 * a place or a pair of coordinates, choose a result, and see everything the record carries: every
 * name it has, each marked with its language (a name in syllabics set beside the name itself,
 * where the record has one), its type, precision, match and source as the API returns them, and
 * the nearest places of six categories around it. A nearby place opens the same way.
 *
 * The search box is the registry's geocoder in a map store with no map (`MapProvider` with
 * `container={null}`), so no MapLibre map is ever created and choosing a result flies nothing.
 * Each action is one request to the unmap API on your key: each pause in typing calls
 * /geocode/autocomplete (/geocode/reverse for typed coordinates), each example under the box calls
 * /geocode/autocomplete once, and each category calls /geocode/nearby. Nothing is requested until
 * the reader acts. Results are OpenStreetMap and Canadian open data, credited on the page.
 *
 * Installed by `npx shadcn add` with its page at app/address-playground/page.tsx. Edit freely.
 */

import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { Geocoder as GeocoderClient, type GeocodeResult } from "@unmap/geocoding";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Geocoder } from "@/components/ui/geocoder";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MapProvider } from "@/lib/map-context";

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

export interface AddressPlaygroundProps {
  /** unmap API key. The page passes NEXT_PUBLIC_UNMAP_KEY. With none, the block asks for one and loads nothing. */
  apiKey: string;
  /** Gateway base URL. Defaults to the unmap production gateway. */
  gateway?: string;
  /** The language it starts in; the reader can switch. Defaults to "en". */
  lang?: PlaygroundLang;
  className?: string;
}

// Failures and announcements keep what happened, not finished sentences: the text is read at
// render, so switching language says them again in the new one.
type Lookup =
  | { kind: "idle" }
  | { kind: "loading"; query: string }
  | { kind: "error"; query: string; error: PlaygroundError | "noMatch" }
  | { kind: "result"; result: GeocodeResult };

type Nearby = { kind: "idle" } | { kind: "loading" } | { kind: "error"; error: PlaygroundError } | { kind: "result"; results: GeocodeResult[] };

type Said = { kind: "result"; result: GeocodeResult } | { kind: "nearby"; results: GeocodeResult[]; category: string } | null;

export function AddressPlayground({ apiKey, gateway, lang = "en", className }: AddressPlaygroundProps) {
  if (!apiKey.trim()) {
    const copy = PLAYGROUND_COPY[lang];
    // Where the page would be: the block's gutter, the Alert at a readable width, the first action first.
    return (
      <div
        data-unmap-block="address-playground"
        data-state="no-key"
        lang={lang}
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
  return (
    // A map store with no map: the geocoder reads one, and with no container none is ever made.
    <MapProvider apiKey={apiKey} gateway={gateway} container={null}>
      <Playground apiKey={apiKey} gateway={gateway} startLang={lang} className={className} />
    </MapProvider>
  );
}

/** A value and its unit, the unit quieter: "850" and "m". */
function Distance({ metres, lang }: { metres: number; lang: PlaygroundLang }) {
  const text = formatDistance(metres, lang);
  const split = text.lastIndexOf(" ");
  return (
    <span className="shrink-0 text-sm tabular-nums">
      {text.slice(0, split)}
      <span className="text-xs text-muted-foreground">{` ${text.slice(split + 1)}`}</span>
    </span>
  );
}

function Playground({ apiKey, gateway, startLang, className }: { apiKey: string; gateway?: string; startLang: PlaygroundLang; className?: string }) {
  const [lang, setLang] = useState<PlaygroundLang>(startLang);
  const [lookup, setLookup] = useState<Lookup>({ kind: "idle" });
  const [category, setCategory] = useState<string | null>(null);
  const [nearby, setNearby] = useState<Nearby>({ kind: "idle" });
  // Bumped by "Try again" on a failed nearby request, to ask again with nothing else changed.
  const [attempt, setAttempt] = useState(0);
  // What the live region says: the chosen result once, then each nearby answer. Nothing until the reader acts.
  const [said, setSaid] = useState<Said>(null);
  const client = useMemo(() => new GeocoderClient({ key: apiKey, gateway }), [apiKey, gateway]);
  const lookupRef = useRef<AbortController | null>(null);
  const titleRef = useRef<HTMLDivElement | null>(null);
  // Set when a nearby place opens: the button that opened it goes with the old card.
  const focusTitleRef = useRef(false);
  const namesId = useId();
  const detailsId = useId();
  const nearbyId = useId();
  const copy = PLAYGROUND_COPY[lang];
  const selected = lookup.kind === "result" ? lookup.result : null;

  // One nearby request per result, category and language; a newer one aborts it.
  useEffect(() => {
    if (!selected || !category) {
      setNearby({ kind: "idle" });
      return;
    }
    const controller = new AbortController();
    setNearby({ kind: "loading" });
    client
      .nearby(category, { near: [selected.lng, selected.lat], radius: NEARBY_RADIUS, limit: NEARBY_LIMIT, lang, signal: controller.signal })
      .then((results) => {
        if (controller.signal.aborted) return;
        setNearby({ kind: "result", results });
        setSaid({ kind: "nearby", results, category });
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted && !isAbort(caught)) setNearby({ kind: "error", error: errorKind(caught) });
      });
    return () => controller.abort();
  }, [client, selected, category, lang, attempt]);

  useEffect(() => () => lookupRef.current?.abort(), []);

  // A nearby place opened from the list: its card replaces the list, so focus goes to its name.
  useEffect(() => {
    if (!selected || !focusTitleRef.current) return;
    focusTitleRef.current = false;
    titleRef.current?.focus();
  }, [selected]);

  function show(result: GeocodeResult) {
    lookupRef.current?.abort();
    setLookup({ kind: "result", result });
    setCategory(null);
    setSaid({ kind: "result", result });
  }

  function openNearby(result: GeocodeResult) {
    focusTitleRef.current = true;
    show(result);
  }

  function tryExample(query: string) {
    lookupRef.current?.abort();
    const controller = new AbortController();
    lookupRef.current = controller;
    setLookup({ kind: "loading", query });
    setCategory(null);
    client
      .autocomplete(query, { limit: 1, lang, signal: controller.signal })
      .then(([first]) => {
        if (controller.signal.aborted) return;
        if (first) show(first);
        else setLookup({ kind: "error", query, error: "noMatch" });
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted && !isAbort(caught)) setLookup({ kind: "error", query, error: errorKind(caught) });
      });
  }

  function chooseLang(next: unknown) {
    // Pressing the pressed item empties a single-select group: the language stays.
    if (isLang(next)) setLang(next);
  }

  const other = selected ? otherScriptName(selected) : undefined;
  const place = selected ? addressLine(selected) : "";
  const rows = selected ? nameRows(selected.names, lang) : [];
  const saying = said === null ? "" : said.kind === "result" ? describeResult(said.result, lang) : describeNearby(said.results, said.category, lang);

  return (
    <div data-unmap-block="address-playground" lang={lang} className={["h-full min-h-[480px] overflow-y-auto p-4 sm:p-6", className].filter(Boolean).join(" ")}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1.5">
            <h2 className="text-xl font-semibold tracking-tight text-balance">{copy.title}</h2>
            <p className="text-sm text-pretty text-muted-foreground">{copy.intro}</p>
          </div>
          <ToggleGroup variant="outline" size="sm" aria-label={copy.language} value={[lang]} onValueChange={(next: unknown[]) => chooseLang(next[0])}>
            {PLAYGROUND_LANGS.map((entry) => (
              <ToggleGroupItem key={entry.code} value={entry.code} lang={entry.code} className="px-3 aria-pressed:font-semibold">
                {entry.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </header>

        <div className="flex flex-col gap-3">
          <Geocoder
            apiKey={apiKey}
            gateway={gateway}
            lang={lang}
            limit={SEARCH_LIMIT}
            placeholder={copy.placeholder}
            errorText={(caught) => requestError(caught, lang)}
            onSelect={show}
            renderResult={(result) => <ResultOption result={result} lang={lang} />}
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">{copy.try}</span>
            {PLAYGROUND_EXAMPLES.map((example) => (
              <Button key={example.query} type="button" variant="outline" size="sm" lang={example.lang} onClick={() => tryExample(example.query)}>
                {example.query}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{copy.coordinates}</p>
        </div>

        <p data-testid="address-playground-announce" aria-live="polite" className="sr-only">
          {saying}
        </p>

        {/* Where the answer lands, always this tall, so nothing below it jumps when one arrives. */}
        <div data-testid="address-playground-answer" aria-busy={lookup.kind === "loading"} className="min-h-72 sm:min-h-[26rem]">
          {lookup.kind === "idle" ? (
            <div className="flex h-full min-h-72 flex-col items-center justify-center gap-2 rounded-xl sm:min-h-[26rem] border border-dashed p-6 text-center motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300">
              <p className="text-base font-medium text-balance">{copy.emptyTitle}</p>
              <p className="max-w-md text-sm text-pretty text-muted-foreground">{copy.emptyBody}</p>
            </div>
          ) : lookup.kind === "loading" ? (
            <ResultSkeleton label={copy.looking(lookup.query)} />
          ) : lookup.kind === "error" ? (
            <Alert variant="destructive" role="alert" className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
              <AlertTitle className="line-clamp-none">{copy.failedTitle}</AlertTitle>
              <AlertDescription className="flex flex-col items-start gap-3">
                <p>{lookup.error === "noMatch" ? copy.noMatch(lookup.query) : copy[lookup.error]}</p>
                {lookup.error !== "noMatch" ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => tryExample(lookup.query)}>
                    {copy.retry}
                  </Button>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : selected ? (
            <Card key={selected.id} className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-200">
              <CardHeader className="gap-2">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{layerLabel(selected.layer, lang)}</Badge>
                  {selected.category ? <Badge variant="outline">{categoryLabel(selected.category, lang)}</Badge> : null}
                </div>
                <CardTitle
                  ref={titleRef}
                  role="heading"
                  aria-level={3}
                  tabIndex={-1}
                  lang={nameTag(selected, lang)}
                  className="rounded-sm text-2xl leading-tight font-semibold tracking-tight break-words outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-3xl"
                >
                  {selected.name}
                </CardTitle>
                {other ? (
                  // The name in its own script, set as large as the name: the record carries it, so the page shows it.
                  <p data-testid="address-playground-script" className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span lang={other.code} className="text-2xl leading-tight font-semibold break-words text-primary sm:text-3xl">
                      {other.text}
                    </span>
                    <span className="text-sm text-muted-foreground">{languageName(other.code, lang)}</span>
                  </p>
                ) : null}
                {place ? <CardDescription>{place}</CardDescription> : null}
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <section aria-labelledby={namesId} className="flex flex-col gap-2">
                  <h4 id={namesId} className="text-sm font-medium">
                    {copy.names}
                  </h4>
                  {rows.length > 0 ? (
                    <dl className="grid gap-2 sm:grid-cols-2">
                      {rows.map((row) => (
                        <div key={row.code} className="flex min-w-0 flex-col gap-1 rounded-lg border p-3">
                          <dt className="text-xs text-muted-foreground first-letter:uppercase">{row.label}</dt>
                          <dd lang={row.code} className="text-lg leading-snug font-medium break-words">
                            {row.text}
                          </dd>
                          {row.also.length > 0 ? (
                            <dd className="text-xs text-muted-foreground">
                              {`${copy.also} `}
                              <span lang={row.code}>{row.also.join(", ")}</span>
                            </dd>
                          ) : null}
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="text-sm text-muted-foreground">{copy.namesNone}</p>
                  )}
                </section>
                <div className="grid gap-6 md:grid-cols-2">
                  <section aria-labelledby={detailsId} className="flex min-w-0 flex-col gap-2">
                    <h4 id={detailsId} className="text-sm font-medium">
                      {copy.details}
                    </h4>
                    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
                      {detailFields(selected, lang).map(([label, value]) => (
                        <Fragment key={label}>
                          <dt className="text-muted-foreground">{label}</dt>
                          <dd className="font-mono text-xs leading-5 break-all tabular-nums">{value}</dd>
                        </Fragment>
                      ))}
                    </dl>
                  </section>
                  <section aria-labelledby={nearbyId} className="flex min-w-0 flex-col gap-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <h4 id={nearbyId} className="text-sm font-medium">
                        {copy.nearby}
                      </h4>
                      <p className="text-xs text-muted-foreground">{copy.nearbyHint}</p>
                    </div>
                    <ToggleGroup
                      variant="outline"
                      size="sm"
                      aria-label={copy.category}
                      value={category ? [category] : []}
                      onValueChange={(next: unknown[]) => setCategory(typeof next[0] === "string" ? next[0] : null)}
                      className="w-full flex-wrap"
                    >
                      {PLAYGROUND_CATEGORIES.map((entry) => (
                        <ToggleGroupItem key={entry.id} value={entry.id} className="aria-pressed:font-semibold">
                          {entry[lang]}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                    {/* Five rows tall whatever it holds, so an answer never moves the page. */}
                    <div data-testid="address-playground-nearby" aria-busy={nearby.kind === "loading"} className="min-h-[14.75rem]">
                      {nearby.kind === "idle" ? (
                        <p className="text-sm text-muted-foreground">{copy.nearbyIdle}</p>
                      ) : nearby.kind === "loading" ? (
                        <>
                          <p role="status" className="sr-only">
                            {copy.nearbyLoading}
                          </p>
                          <ul aria-hidden="true" className="flex flex-col gap-1">
                            {Array.from({ length: NEARBY_LIMIT }, (_, index) => (
                              <li key={index} data-skeleton-row="" className="flex h-11 items-center justify-between gap-3 px-2">
                                <span className="flex flex-col gap-1.5">
                                  <Skeleton className="h-3.5 w-36" />
                                  <Skeleton className="h-3 w-24" />
                                </span>
                                <Skeleton className="h-3.5 w-12" />
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : nearby.kind === "error" ? (
                        <Alert variant="destructive" role="alert">
                          <AlertDescription className="flex flex-col items-start gap-2">
                            <p>{copy[nearby.error]}</p>
                            <Button type="button" variant="outline" size="sm" onClick={() => setAttempt((count) => count + 1)}>
                              {copy.retry}
                            </Button>
                          </AlertDescription>
                        </Alert>
                      ) : nearby.results.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{copy.nearbyEmpty}</p>
                      ) : (
                        <ol aria-label={copy.nearby} className="flex flex-col gap-1">
                          {nearby.results.map((found, index) => (
                            <li
                              key={found.id}
                              className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:fill-mode-backwards motion-safe:duration-200"
                              style={{ animationDelay: `${index * 40}ms` }}
                            >
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-11 w-full justify-between gap-3 px-2 text-left font-normal"
                                onClick={() => openNearby(found)}
                              >
                                <span className="flex min-w-0 flex-col">
                                  <span className="truncate text-sm font-medium">{found.name}</span>
                                  <span className="truncate text-xs text-muted-foreground">
                                    {[found.address?.housenumber, found.address?.street].filter(Boolean).join(" ") || found.address?.city}
                                  </span>
                                </span>
                                {typeof found.distance === "number" ? <Distance metres={found.distance} lang={lang} /> : null}
                              </Button>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  </section>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <p data-testid="address-playground-credits" className="text-xs text-pretty text-muted-foreground">
          {`${copy.creditLead} `}
          <a className="underline underline-offset-2" href={PLAYGROUND_CREDITS.osm} target="_blank" rel="noreferrer">
            {copy.osm}
          </a>
          {` ${copy.creditMiddle} `}
          <a className="underline underline-offset-2" href={PLAYGROUND_CREDITS.attribution[lang]} target="_blank" rel="noreferrer">
            {copy.creditLink}
          </a>
          .
        </p>
      </div>
    </div>
  );
}

/** An option in the search list: the name, a name in another script under it, then where and what it is. */
function ResultOption({ result, lang }: { result: GeocodeResult; lang: PlaygroundLang }) {
  const other = otherScriptName(result);
  const meta = [addressLine(result), layerLabel(result.layer, lang)].filter(Boolean).join(" · ");
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate" lang={nameTag(result, lang)}>
        {result.name}
      </span>
      {other ? (
        <span className="truncate text-xs" lang={other.code}>
          {other.text}
        </span>
      ) : null}
      {meta ? <span className="truncate text-xs text-muted-foreground">{meta}</span> : null}
    </span>
  );
}

/** The result card's shape while an example is looked up: badge, name, place, two name tiles, details. */
function ResultSkeleton({ label }: { label: string }) {
  return (
    <Card>
      <p role="status" className="sr-only">
        {label}
      </p>
      <CardHeader className="gap-2" aria-hidden="true">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </CardHeader>
      <CardContent className="flex flex-col gap-6" aria-hidden="true">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-16" />
          <div className="grid gap-2 sm:grid-cols-2">
            <Skeleton className="h-[4.5rem] w-full" />
            <Skeleton className="h-[4.5rem] w-full" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-4 w-full" />
            ))}
          </div>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-20" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: PLAYGROUND_CATEGORIES.length }, (_, index) => (
                <Skeleton key={index} className="h-7 w-20" />
              ))}
            </div>
            <div className="min-h-[14.75rem]" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
