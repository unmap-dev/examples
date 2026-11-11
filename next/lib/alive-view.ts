// What the alive-route-explorer block shows, framework-free: its words in English and French, the
// sample walks, the SDK adapted to findWalks, and how a walk is read for the map (where its
// highlights are, where a time bubble goes). The React files beside it only draw this.

import { tileFeatures, tilesCovering } from "@unmap/maps/tiles";
import { poisFromPlaces, type TileFeature } from "./alive-data";
import type { rank } from "./alive-rank";
import { projector, type LngLat, type Poi, type Scores } from "./alive-signals";
import { CALL_BUDGET, MAX_TILES, type Candidate, type WalkDeps, type WalkLeg, type WalkResult } from "./alive-walks";

export type AliveLang = "en" | "fr";

/** The block's own map id, so a map elsewhere on the page never answers for it. */
export const ALIVE_MAP_ID = "alive-route-explorer";

/** Where a reader gets an unmap key: the no-key state's first action. */
export const KEY_URL = "https://unmap.dev/dashboard";

/** Three Calgary walks to start from, each labelled a sample wherever it shows. */
export const SAMPLE_COMMUTES: {
  id: "bridgeland" | "kensington" | "mission";
  from: LngLat;
  to: LngLat;
  name: { en: string; fr: string };
  ends: { en: [string, string]; fr: [string, string] };
}[] = [
  {
    id: "bridgeland",
    from: [-114.0415, 51.0545],
    to: [-114.0575, 51.0455],
    name: { en: "Bridgeland to City Hall", fr: "Bridgeland à l'hôtel de ville" },
    ends: { en: ["Bridgeland", "City Hall"], fr: ["Bridgeland", "Hôtel de ville"] },
  },
  {
    id: "kensington",
    from: [-114.087, 51.0525],
    to: [-114.0614, 51.0478],
    name: { en: "Kensington to the Bow", fr: "Kensington à la rivière Bow" },
    ends: { en: ["Kensington", "The Bow"], fr: ["Kensington", "Rivière Bow"] },
  },
  {
    id: "mission",
    from: [-114.0705, 51.03],
    to: [-114.0679, 51.0459],
    name: { en: "Mission to Stephen Avenue", fr: "Mission à l'avenue Stephen" },
    ends: { en: ["Mission", "Stephen Avenue"], fr: ["Mission", "Avenue Stephen"] },
  },
];

export const WEIGHT_KEYS = ["green", "water", "quiet", "life", "landmarks"] as const;
export type WeightKey = (typeof WEIGHT_KEYS)[number];

/** Extra minutes the reader will take, by default and at most. */
export const DEFAULT_BUDGET = 3;
export const MAX_BUDGET = 15;
/** A detour must beat the fastest walk by this many points of 100. */
export const DEFAULT_MIN_GAIN = 5;
/** Past this the idea strains: few detours fit a long walk's budget. */
export const LONG_WALK_M = 5000;
export const PHONE_QUERY = "(max-width: 639.98px)";
/** Below this the Why card starts closed. */
export const NARROW_QUERY = "(max-width: 1279.98px)";
export const GUTTER = 24;
export const CAMERA_MS = 700;
export const DRAW_MS = 700;

export type Method = "both" | "detour" | "graph";

/** What a picture can show: a highlight's kind, also the empty state's quiet street. */
export type PictureKind = "park" | "water" | "life" | "landmark" | "quiet";

/**
 * Pictures for the highlight cards, by key: a highlight kind (`park`, `water`, `life`, `landmark`,
 * `quiet`) or a place category id (`food.cafe`, `culture.museum`, `tourism.artwork`, ...). Each key
 * holds one or more image URLs, variants a walk picks from. Without an entry a card draws its
 * inline illustration. Every picture is shown tagged "Illustration", with alt text saying it is
 * AI-generated, so pass only illustrations, never photos presented as the place.
 */
export type AlivePictures = Partial<Record<string, readonly string[]>>;

const PICTURE_NOUNS: Record<AliveLang, Record<PictureKind, string>> = {
  en: { park: "a park", water: "a riverside", life: "a street with cafés", landmark: "public art", quiet: "a quiet street" },
  fr: { park: "parc", water: "bord de rivière", life: "rue de cafés", landmark: "œuvre d'art public", quiet: "rue calme" },
};

export const ALIVE_COPY = {
  en: {
    title: "Find a livelier walk",
    subtitle: "Directions for a livelier walk",
    description: "Walking directions that trade a minute for a nicer walk: past parks, the river, streets away from traffic, cafés and public art.",
    start: "Start",
    destination: "Destination",
    from: (name: string) => `From ${name}`,
    to: (name: string) => `To ${name}`,
    commute: (from: string, to: string) => `${from} to ${to}`,
    swap: "Swap start and destination",
    samples: "Samples",
    sample: "Sample",
    dials: "What makes a walk alive",
    reset: "Reset",
    routeOptions: "Route options",
    show: "Show",
    hide: "Hide",
    showMore: (n: number) => `Show ${n} more`,
    showFewer: "Show fewer",
    signalUnavailable: "Unavailable",
    dialsUnavailable: "Street life and landmarks are unavailable right now, so these two dials are off.",
    dialsBasemapUnavailable: "Parks, water and traffic are unavailable for this walk, so these three dials are off.",
    pictureAlt: (kind: PictureKind) => `AI-generated illustration of ${PICTURE_NOUNS.en[kind]}, not a photo of this place`,
    weights: { green: "Parks and green", water: "River and water", quiet: "Away from traffic", life: "Cafés and shops", landmarks: "Art and landmarks" },
    budget: "Extra time I'll take",
    budgetValue: (minutes: number) => `up to +${formatNumber(minutes, "en")} min`,
    more: "More options",
    fewer: "Fewer options",
    minGain: "Minimum gain",
    minGainValue: (points: number) => `${points} points`,
    minGainHint: "A detour must beat the fastest walk by this much to be picked.",
    method: "Walks found by",
    methodFilter: { both: "Both", detour: "API detours", graph: "Walking graph" },
    methods: { detour: "API detour", graph: "Walking graph" },
    routes: "Routes",
    livelier: "Livelier route",
    fastest: "Fastest route",
    selected: "Selected route",
    another: "Another walk",
    minutes: (seconds: number) => `${Math.max(1, Math.round(seconds / 60))} min`,
    extra: (minutes: number) => `+${minutes > 0.05 ? Math.max(1, Math.round(minutes)) : 0} min`,
    overBudget: "Over your extra time",
    underGain: "Not enough gain to pick",
    graphNote: "Path found in your browser from map tiles; snapped and timed by unmap map matching.",
    go: "Get directions",
    going: "Finding walks...",
    calls: (n: number) => `${n} of ${CALL_BUDGET} API calls`,
    callsBefore: `Up to ${CALL_BUDGET} API calls per search`,
    empty: "Get directions to see the fastest walk and the livelier ones beside it. The dials decide what is worth a detour.",
    why: "Why this route",
    aliveness: (route: number, fastest: number) => `aliveness ${route} vs ${fastest}`,
    signals: { green: "Green", water: "Water", quiet: "Away from traffic", life: "Street life", landmarks: "Landmarks" },
    barsKey: "Bar: this walk. Line: the fastest walk.",
    placesUnavailable: "Street life and landmarks are unavailable right now; this ranking uses parks, water and streets away from traffic only.",
    nothingAvailable: "Neither the map tiles nor street life and landmarks could be read, so nothing can be scored and the fastest walk is the pick.",
    tooShort: "These points are under 200 m apart, so the direct walk is the only one.",
    alreadyLiveliest: (minutes: number) => `Your fastest walk is already the liveliest one within +${formatNumber(minutes, "en")} min.`,
    graphTooBig: "This walk is too long to read its map tiles, so the routes are API detours only and the ranking leaves out parks, water and traffic.",
    graphFailed: "The map tiles did not load, so the routes are API detours only and the ranking leaves out parks, water and traffic.",
    partial: "Partial results: open Route options to see why.",
    skipped: (n: number) => (n === 1 ? "1 route could not be computed." : `${n} routes could not be computed.`),
    longWalk: "This is built for walks; over 5 km few detours fit your extra time.",
    sources: "Parks, water and streets come from the basemap tiles; cafés, shops and landmarks from unmap places.",
    highlights: { park: "A park", life: "Cafés and street life", landmark: "Art and landmarks" },
    more_: (n: number) => `and ${n} more`,
    through: (metres: number) => `${Math.round(metres / 10) * 10} m of the walk`,
    options: "Route options",
    noResult: "No walk yet",
    said: (label: string, time: string, extra: string | null) => `${label}, ${time}${extra ? `, ${extra} over the fastest` : ""}.`,
    noRoute: "There is no walking route between these points. Try a start or destination on a street.",
    outside: "Start and destination must both be in Canada.",
    busy: "Too many requests. Try again in a moment.",
    keyRefused: "The API key was refused. Check it and its allowed origins.",
    unavailable: "The routing service did not answer. Try again in a moment.",
    failed: "The directions did not load. Try again.",
    retry: "Try again",
    errorTitle: "No directions",
    noKeyTitle: "Add your unmap key to load the map.",
    getKey: "Get a key",
    noKey: "No unmap key. Pass apiKey. On Next.js, set NEXT_PUBLIC_UNMAP_KEY in .env.local, then restart the dev server.",
  },
  fr: {
    title: "Trouver une marche plus vivante",
    subtitle: "Un itinéraire plus vivant",
    description: "Un itinéraire à pied qui échange une minute contre une plus belle marche : parcs, rivière, rues loin de la circulation, cafés et art public.",
    start: "Départ",
    destination: "Destination",
    from: (name: string) => `Depuis ${name}`,
    to: (name: string) => `Vers ${name}`,
    commute: (from: string, to: string) => `${from} à ${to}`,
    swap: "Inverser le départ et l'arrivée",
    samples: "Exemples",
    sample: "Exemple",
    dials: "Ce qui rend une marche vivante",
    reset: "Réinitialiser",
    routeOptions: "Options de l'itinéraire",
    show: "Afficher",
    hide: "Masquer",
    showMore: (n: number) => `Afficher ${n} de plus`,
    showFewer: "Afficher moins",
    signalUnavailable: "Indisponible",
    dialsUnavailable: "La vie de quartier et les repères sont indisponibles pour le moment : ces deux curseurs sont désactivés.",
    dialsBasemapUnavailable: "Les parcs, l'eau et la circulation sont indisponibles pour cette marche : ces trois curseurs sont désactivés.",
    pictureAlt: (kind: PictureKind) => `Illustration générée par IA (${PICTURE_NOUNS.fr[kind]}), pas une photo de ce lieu`,
    weights: { green: "Parcs et verdure", water: "Rivière et eau", quiet: "Loin de la circulation", life: "Cafés et commerces", landmarks: "Art et repères" },
    budget: "Temps de plus que j'accepte",
    budgetValue: (minutes: number) => `jusqu'à +${formatNumber(minutes, "fr")} min`,
    more: "Plus d'options",
    fewer: "Moins d'options",
    minGain: "Gain minimal",
    minGainValue: (points: number) => `${points} points`,
    minGainHint: "Un détour doit battre la marche la plus rapide d'au moins cette valeur pour être choisi.",
    method: "Marches trouvées par",
    methodFilter: { both: "Les deux", detour: "Détours de l'API", graph: "Graphe piéton" },
    methods: { detour: "Détour de l'API", graph: "Graphe piéton" },
    routes: "Itinéraires",
    livelier: "Itinéraire plus vivant",
    fastest: "Itinéraire le plus rapide",
    selected: "Itinéraire choisi",
    another: "Autre marche",
    minutes: (seconds: number) => `${Math.max(1, Math.round(seconds / 60))} min`,
    extra: (minutes: number) => `+${minutes > 0.05 ? Math.max(1, Math.round(minutes)) : 0} min`,
    overBudget: "Au-delà de votre temps de plus",
    underGain: "Gain trop faible pour être choisi",
    graphNote: "Chemin trouvé dans votre navigateur à partir des tuiles; ajusté et chronométré par l'appariement de trajets unmap.",
    go: "Obtenir l'itinéraire",
    going: "Recherche de marches...",
    calls: (n: number) => `${n} appels d'API sur ${CALL_BUDGET}`,
    callsBefore: `Jusqu'à ${CALL_BUDGET} appels d'API par recherche`,
    empty: "Obtenez l'itinéraire pour voir la marche la plus rapide et les plus vivantes à côté. Les curseurs décident de ce qui vaut un détour.",
    why: "Pourquoi cet itinéraire",
    aliveness: (route: number, fastest: number) => `vitalité ${route} contre ${fastest}`,
    signals: { green: "Verdure", water: "Eau", quiet: "Loin de la circulation", life: "Vie de quartier", landmarks: "Repères" },
    barsKey: "Barre : cette marche. Trait : la marche la plus rapide.",
    placesUnavailable:
      "La vie de quartier et les repères sont indisponibles pour le moment; ce classement utilise seulement les parcs, l'eau et les rues loin de la circulation.",
    nothingAvailable:
      "Ni les tuiles de la carte ni la vie de quartier et les repères n'ont pu être lus : rien ne peut être noté, et la marche la plus rapide est le choix.",
    tooShort: "Ces points sont à moins de 200 m l'un de l'autre : la marche directe est la seule.",
    alreadyLiveliest: (minutes: number) => `Votre marche la plus rapide est déjà la plus vivante à +${formatNumber(minutes, "fr")} min près.`,
    graphTooBig:
      "Cette marche est trop longue pour lire ses tuiles de carte : les itinéraires sont seulement des détours de l'API, et le classement laisse de côté les parcs, l'eau et la circulation.",
    graphFailed:
      "Les tuiles de la carte n'ont pas chargé : les itinéraires sont seulement des détours de l'API, et le classement laisse de côté les parcs, l'eau et la circulation.",
    partial: "Résultats partiels : ouvrez Options de l'itinéraire pour savoir pourquoi.",
    skipped: (n: number) => (n === 1 ? "1 itinéraire n'a pas pu être calculé." : `${n} itinéraires n'ont pas pu être calculés.`),
    longWalk: "Conçu pour la marche : au-delà de 5 km, peu de détours tiennent dans votre temps de plus.",
    sources: "Les parcs, l'eau et les rues viennent des tuiles de la carte; les cafés, commerces et repères, des lieux d'unmap.",
    highlights: { park: "Un parc", life: "Cafés et vie de quartier", landmark: "Art et repères" },
    more_: (n: number) => `et ${n} de plus`,
    through: (metres: number) => `${Math.round(metres / 10) * 10} m de la marche`,
    options: "Options de l'itinéraire",
    noResult: "Pas encore de marche",
    said: (label: string, time: string, extra: string | null) => `${label}, ${time}${extra ? `, soit ${extra} par rapport à la plus rapide` : ""}.`,
    noRoute: "Aucun itinéraire à pied ne relie ces points. Essayez un départ ou une arrivée sur une rue.",
    outside: "Le départ et l'arrivée doivent être au Canada.",
    busy: "Trop de requêtes. Réessayez dans un instant.",
    keyRefused: "La clé d'API a été refusée. Vérifiez-la, ainsi que ses origines autorisées.",
    unavailable: "Le service d'itinéraires n'a pas répondu. Réessayez dans un instant.",
    failed: "L'itinéraire n'a pas chargé. Réessayez.",
    retry: "Réessayer",
    errorTitle: "Aucun itinéraire",
    noKeyTitle: "Ajoutez votre clé unmap pour charger la carte.",
    getKey: "Obtenir une clé",
    noKey: "Aucune clé unmap. Passez apiKey. Avec Next.js, définissez NEXT_PUBLIC_UNMAP_KEY dans .env.local, puis redémarrez le serveur de développement.",
  },
} as const;

export function formatNumber(value: number, lang: AliveLang): string {
  return value.toLocaleString(lang === "fr" ? "fr-CA" : "en-CA", { maximumFractionDigits: 1 });
}

// ---------------------------------------------------------------------------------------------
// The SDK, adapted to what findWalks asks for.

/** The part of `new Unmap(...)` the walks need. */
export interface AliveClient {
  router: {
    route(from: LngLat, to: LngLat, opts: { mode: "pedestrian"; signal: AbortSignal }): Promise<WalkLeg>;
    match(coordinates: LngLat[], opts: { mode: "pedestrian"; signal: AbortSignal }): Promise<WalkLeg>;
  };
  places: {
    along(
      route: { type: "LineString"; coordinates: LngLat[] },
      category: readonly string[],
      opts: { radius: number; limit: number; signal: AbortSignal },
    ): Promise<{ data: { id: string; name: string; category: string | null; coordinates: [number, number] }[] }>;
  };
}

type TileReader = (opts: {
  key: string;
  bbox: [number, number, number, number];
  layers: readonly string[];
  maxTiles: number;
  signal: AbortSignal;
}) => Promise<{ features: Record<string, TileFeature[]>; requests: number }>;

/** The basemap layers the signals and the walking graph read. */
export const TILE_LAYERS = ["roads", "landuse", "water", "pois"] as const;

/**
 * findWalks' dependencies from one SDK client and the tile reader. A failed tile read says how many
 * tiles it covered, so the call counter stays exact; a RangeError was refused before any fetch.
 */
export function walkDeps(client: AliveClient, apiKey: string, read: TileReader = tileFeatures): WalkDeps {
  return {
    route: (from, to, signal) => client.router.route(from, to, { mode: "pedestrian", signal }),
    match: (coordinates, signal) => client.router.match(coordinates, { mode: "pedestrian", signal }),
    placesAlong: async (line, categories, radius, signal) => {
      const { data } = await client.places.along({ type: "LineString", coordinates: line }, categories, { radius, limit: 200, signal });
      return poisFromPlaces(data);
    },
    tiles: async (bbox, signal) => {
      try {
        return await read({ key: apiKey, bbox, layers: TILE_LAYERS, maxTiles: MAX_TILES, signal });
      } catch (caught) {
        if (!(caught instanceof RangeError) && typeof caught === "object" && caught !== null && !("requests" in caught)) {
          Object.assign(caught, { requests: tilesCovering(bbox, 14).length });
        }
        throw caught;
      }
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Reading a walk: where its highlights are, where a bubble goes.

export interface HighlightCard {
  kind: "park" | "life" | "landmark";
  at: LngLat;
  names: string[];
  /** Places of this kind beyond `names`. */
  extra: number;
  /** The places named on the card (life and landmark cards), for choosing its picture. */
  places: Poi[];
  /** Parks only: metres of the walk inside. */
  metres?: number;
}

/** Metres from the start of `coords` to the point on it nearest `p`. */
function alongM(coords: LngLat[], p: LngLat): number {
  if (coords.length < 2) return 0;
  const P = projector(coords[0]!);
  const q = P.to(p);
  let walked = 0;
  let best = { d: Infinity, at: 0 };
  for (let i = 1; i < coords.length; i++) {
    const a = P.to(coords[i - 1]!);
    const b = P.to(coords[i]!);
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    const t = len > 0 ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / (len * len))) : 0;
    const d = Math.hypot(a[0] + t * dx - q[0], a[1] + t * dy - q[1]);
    if (d < best.d) best = { d, at: walked + t * len };
    walked += len;
  }
  return best.at;
}

export const metresBetween = (a: LngLat, b: LngLat): number => {
  const P = projector(a);
  const [x, y] = P.to(b);
  return Math.hypot(x, y);
};

/** A street-life stretch: places within this of one another. */
const STRETCH_M = 120;

/** What each searched category is, for a place with no name: a description, never an invented name. */
export const CATEGORY_LABELS: Record<AliveLang, Record<string, string>> = {
  en: {
    "food.cafe": "Café",
    "food.bakery": "Bakery",
    "food.restaurant": "Restaurant",
    "food.bar": "Bar",
    "food.pub": "Pub",
    "food.ice_cream": "Ice cream shop",
    "shop.books": "Bookshop",
    "shop.clothes": "Clothing store",
    "culture.museum": "Museum",
    "culture.gallery": "Art gallery",
    "culture.theatre": "Theatre",
    "culture.arts_centre": "Arts centre",
    "culture.library": "Library",
    "tourism.attraction": "Attraction",
    "tourism.viewpoint": "Viewpoint",
    "tourism.artwork": "Public art",
  },
  fr: {
    "food.cafe": "Café",
    "food.bakery": "Boulangerie",
    "food.restaurant": "Restaurant",
    "food.bar": "Bar",
    "food.pub": "Pub",
    "food.ice_cream": "Bar laitier",
    "shop.books": "Librairie",
    "shop.clothes": "Boutique de vêtements",
    "culture.museum": "Musée",
    "culture.gallery": "Galerie d'art",
    "culture.theatre": "Théâtre",
    "culture.arts_centre": "Centre des arts",
    "culture.library": "Bibliothèque",
    "tourism.attraction": "Attrait touristique",
    "tourism.viewpoint": "Point de vue",
    "tourism.artwork": "Art public",
  },
};

/** A place's name, or what it is when it has none ("Public art"), or "Unnamed place" past that. */
export function placeName(place: Pick<Poi, "name" | "category">, lang: AliveLang): string {
  return place.name.trim() || CATEGORY_LABELS[lang][place.category] || (lang === "fr" ? "Lieu sans nom" : "Unnamed place");
}

/**
 * At most three cards for what a walk passes: the first park it enters, the stretch with the most
 * cafés and shops, and the first landmark, each with the real names it passes.
 */
export function highlightCards(coords: LngLat[], scores: Scores, nameOf: (place: Poi) => string = (place) => place.name): HighlightCard[] {
  const cards: HighlightCard[] = [];
  const first = <T,>(items: T[], at: (item: T) => LngLat) =>
    [...items].sort((a, b) => alongM(coords, at(a)) - alongM(coords, at(b)))[0];

  const park = first(scores.highlights.parks, (p) => p.at);
  if (park) cards.push({ kind: "park", at: park.at, names: [park.name], extra: 0, places: [], metres: park.metres });

  const life = scores.highlights.life;
  if (life.length) {
    const near = (a: Poi) => life.filter((b) => metresBetween(a.at, b.at) <= STRETCH_M);
    const centre = [...life].sort((a, b) => near(b).length - near(a).length || alongM(coords, a.at) - alongM(coords, b.at))[0]!;
    const stretch = near(centre).sort((a, b) => metresBetween(centre.at, a.at) - metresBetween(centre.at, b.at));
    cards.push({ kind: "life", at: centre.at, names: [...new Set(stretch.map(nameOf))].slice(0, 2), extra: Math.max(0, stretch.length - 2), places: stretch });
  }

  const landmark = first(scores.highlights.landmarks, (p) => p.at);
  if (landmark) cards.push({ kind: "landmark", at: landmark.at, names: [nameOf(landmark)], extra: 0, places: [landmark] });
  return cards;
}

/** The point of `coords` farthest from `ref`: where a detour's bubble reads as the detour's. */
export function apexOf(coords: LngLat[], ref: LngLat[]): LngLat {
  if (coords.length === 0) return [0, 0];
  let best = { d: -1, at: coords[Math.floor(coords.length / 2)]! };
  for (let i = 1; i < coords.length - 1; i++) {
    const p = coords[i]!;
    const d = Math.min(...ref.map((r) => metresBetween(p, r)));
    if (d > best.d) best = { d, at: p };
  }
  return best.at;
}

/** [[west, south], [east, north]] around some points. A loop: spreading a long route into Math.min overflows the stack. */
export function boundsOf(points: LngLat[]): [[number, number], [number, number]] {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const [x, y] of points) {
    w = Math.min(w, x);
    s = Math.min(s, y);
    e = Math.max(e, x);
    n = Math.max(n, y);
  }
  return [
    [w, s],
    [e, n],
  ];
}

/** What to tell the reader about a failed search. */
export function requestError(caught: unknown, lang: AliveLang): string {
  const copy = ALIVE_COPY[lang];
  const failure = typeof caught === "object" && caught !== null ? (caught as { code?: unknown; status?: unknown }) : {};
  const status = typeof failure.status === "number" ? failure.status : null;
  if (failure.code === "outside_coverage" || status === 422) return copy.outside;
  if (failure.code === "no_route" || status === 400) return copy.noRoute;
  if (status === 429) return copy.busy;
  if (status === 401 || status === 403) return copy.keyRefused;
  if (status === null || status >= 500) return copy.unavailable;
  return copy.failed;
}

/**
 * What the panel says about a finished search, in order, and whether any of it means the results
 * are partial (a source unavailable or a route that failed), which the phone's summary card hints
 * at. `fastestM` is the fastest walk's length, for the long-walk note.
 */
export function walkNotes(result: WalkResult, fastestM: number | null, lang: AliveLang): { notes: string[]; partial: boolean } {
  const copy = ALIVE_COPY[lang];
  const notes: string[] = [];
  if (!result.placesAvailable) notes.push(result.basemapAvailable ? copy.placesUnavailable : copy.nothingAvailable);
  if (result.tooShort) notes.push(copy.tooShort);
  if (result.graphSkipped === "too-big") notes.push(copy.graphTooBig);
  if (result.graphSkipped === "tiles-failed") notes.push(copy.graphFailed);
  if (result.skipped > 0) notes.push(copy.skipped(result.skipped));
  if (fastestM !== null && fastestM > LONG_WALK_M) notes.push(copy.longWalk);
  return { notes, partial: !result.placesAvailable || !result.basemapAvailable || result.skipped > 0 };
}

/**
 * The weights a ranking uses: a signal whose source could not be read is unknown, not zero, so its
 * weight is 0 and it leaves the ranking. Places feed street life and landmarks; the basemap tiles
 * feed parks, water and traffic.
 */
export function usableWeights<W extends Record<WeightKey, number>>(weights: W, result: Pick<WalkResult, "placesAvailable" | "basemapAvailable">): W {
  return {
    ...weights,
    ...(result.placesAvailable ? {} : { life: 0, landmarks: 0 }),
    ...(result.basemapAvailable ? {} : { green: 0, water: 0, quiet: 0 }),
  };
}

/** Results worth keeping for the same start and destination: not ones a passing outage degraded. */
export const cacheable = (result: WalkResult): boolean => result.placesAvailable && result.graphSkipped !== "tiles-failed";

export const isAbort = (caught: unknown): boolean =>
  typeof caught === "object" && caught !== null && (caught as { name?: unknown }).name === "AbortError";

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
}


// ---------------------------------------------------------------------------------------------
// The block's state, shared by its pieces.

/** A walk as ranked for the current dials: its extra minutes, its score, whether it may be picked. */
export type RankedWalk = ReturnType<typeof rank<Candidate>>["rows"][number];

export interface Endpoint {
  at: LngLat;
  /** A sample's or the search's name; null when the point came without one. */
  name: string | null;
}

export type Search =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "done"; result: WalkResult }
  | { state: "error"; error: unknown };

// ---------------------------------------------------------------------------------------------
// Pictures.

/** A small stable string hash (djb2), so a walk keeps its picture and different walks vary. */
function hash(text: string): number {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * A card's picture: for a life or landmark card, its places' most common category when `pictures`
 * has that category, else the card's kind; a variant chosen by the first place's id (or the kind and
 * the walk's id), the same on every render. `undefined` means draw the inline illustration.
 */
export function pictureFor(card: { kind: PictureKind; places: readonly Poi[] }, pictures: AlivePictures | undefined, walkId: string): string | undefined {
  if (!pictures) return undefined;
  const counts = new globalThis.Map<string, number>();
  for (const place of card.places) if (place.category) counts.set(place.category, (counts.get(place.category) ?? 0) + 1);
  // The most common category; between equally common ones, one that has pictures.
  let category: string | undefined;
  const has = (key: string) => (pictures[key]?.length ?? 0) > 0;
  for (const [key, n] of counts) {
    const best = category === undefined ? -1 : counts.get(category)!;
    if (n > best || (n === best && has(key) && !has(category!))) category = key;
  }
  const list = (category && pictures[category]?.length ? pictures[category] : pictures[card.kind]) ?? [];
  if (list.length === 0) return undefined;
  return list[hash(card.places[0]?.id ?? `${card.kind}:${walkId}`) % list.length];
}

// ---------------------------------------------------------------------------------------------
// Placing HTML on the map without covering the walk, the panel or each other. Screen pixels.

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** How much covering it costs per pixel; 1 by default. The panel and the Why card weigh more. */
  weight?: number;
}
export interface Point {
  x: number;
  y: number;
}
/**
 * Where a box sits relative to the point it points at; its tail is on the facing edge. The corner
 * sides keep the tail near one end of that edge (`top-left`: above the point, reaching left).
 */
export type Side = "top" | "bottom" | "left" | "right" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

/** How far from a corner side's near edge its tail sits. */
export const TAIL_INSET = 28;

export function rectAt(at: Point, size: { w: number; h: number }, side: Side, gap: number): Rect {
  switch (side) {
    case "top":
      return { x0: at.x - size.w / 2, x1: at.x + size.w / 2, y0: at.y - gap - size.h, y1: at.y - gap };
    case "bottom":
      return { x0: at.x - size.w / 2, x1: at.x + size.w / 2, y0: at.y + gap, y1: at.y + gap + size.h };
    case "left":
      return { x0: at.x - gap - size.w, x1: at.x - gap, y0: at.y - size.h / 2, y1: at.y + size.h / 2 };
    case "right":
      return { x0: at.x + gap, x1: at.x + gap + size.w, y0: at.y - size.h / 2, y1: at.y + size.h / 2 };
    case "top-left":
      return { x0: at.x + TAIL_INSET - size.w, x1: at.x + TAIL_INSET, y0: at.y - gap - size.h, y1: at.y - gap };
    case "top-right":
      return { x0: at.x - TAIL_INSET, x1: at.x - TAIL_INSET + size.w, y0: at.y - gap - size.h, y1: at.y - gap };
    case "bottom-left":
      return { x0: at.x + TAIL_INSET - size.w, x1: at.x + TAIL_INSET, y0: at.y + gap, y1: at.y + gap + size.h };
    case "bottom-right":
      return { x0: at.x - TAIL_INSET, x1: at.x - TAIL_INSET + size.w, y0: at.y + gap, y1: at.y + gap + size.h };
  }
}

const area = (r: Rect) => Math.max(0, r.x1 - r.x0) * Math.max(0, r.y1 - r.y0);
const meet = (a: Rect, b: Rect): Rect => ({ x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) });

/** Points every `step` px along screen polylines, so a box can tell whether it covers a line. */
export function densify(lines: Point[][], step = 10): Point[] {
  const out: Point[] = [];
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1]!;
      const b = line[i]!;
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
      for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
    }
    if (line.length) out.push(line[line.length - 1]!);
  }
  return out;
}

/** A spot `placeBox` chose, with what it still covers: `overlap` in weighted px², `covered` line points. */
export interface Placed {
  at: Point;
  side: Side;
  rect: Rect;
  cost: number;
  overlap: number;
  covered: number;
}

/**
 * The best spot for a box among `anchors` (tried in order) and `sides`: the one covering the least
 * of `obstacles` and `line` points and staying inside `bounds`. Ties keep the earlier try, so the
 * caller's order is its preference. Null when there is no anchor to try.
 */
export function placeBox(
  anchors: Point[],
  size: { w: number; h: number },
  sides: readonly Side[],
  obstacles: readonly Rect[],
  line: readonly Point[],
  bounds: Rect,
  gap: number,
): Placed | null {
  let best: Placed | null = null;
  for (const at of anchors) {
    for (const side of sides) {
      const rect = rectAt(at, size, side, gap);
      let overlap = (area(rect) - area(meet(rect, bounds))) * 4;
      for (const o of obstacles) overlap += area(meet(rect, o)) * (o.weight ?? 1);
      let covered = 0;
      for (const p of line) if (p.x > rect.x0 && p.x < rect.x1 && p.y > rect.y0 && p.y < rect.y1) covered++;
      const cost = overlap + covered * 400;
      if (!best || cost < best.cost) best = { at, side, rect, cost, overlap, covered };
      if (cost === 0) return best;
    }
  }
  return best;
}

/** Where a highlight card stands relative to its marker, in pixels. */
export interface CardSpot {
  /** The card's box, in screen pixels at the time of placing. */
  rect: Rect;
  /** Next to its marker: the side its tail is on. */
  side?: Side;
  /** Further out: a leader from the marker's rim to the card's edge, in screen pixels. */
  leader?: { x0: number; y0: number; x1: number; y1: number };
  cost: number;
}

/** The marker's radius, and how close to it the walk must stay visible (where the card points). */
const MARKER_R = 18;
export const MARKER_CLEAR = 60;

/**
 * A spot for a highlight card around its marker: first right beside it on one of `sides` (a tail
 * points at the marker), then on a ring of distances and angles (a leader line points at it). A
 * spot must stay inside `bounds`, overlap none of `obstacles`, and leave the picked walk visible
 * within MARKER_CLEAR px of the marker; among those it prefers near, little of the picked walk
 * covered, and above the marker. The basemap and the fastest walk may be covered freely. Null
 * when no spot qualifies.
 */
export function placeCard(
  marker: Point,
  size: { w: number; h: number },
  sides: readonly Side[],
  obstacles: readonly Rect[],
  pick: readonly Point[],
  bounds: Rect,
): CardSpot | null {
  const near = pick.filter((p) => Math.hypot(p.x - marker.x, p.y - marker.y) <= MARKER_CLEAR);
  const far = pick.filter((p) => Math.hypot(p.x - marker.x, p.y - marker.y) > MARKER_CLEAR);
  const inside = (r: Rect, p: Point) => p.x > r.x0 && p.x < r.x1 && p.y > r.y0 && p.y < r.y1;
  const fits = (r: Rect) =>
    r.x0 >= bounds.x0 && r.y0 >= bounds.y0 && r.x1 <= bounds.x1 && r.y1 <= bounds.y1 && obstacles.every((o) => area(meet(r, o)) < 1) && !near.some((p) => inside(r, p));
  const score = (r: Rect, distance: number) => distance + 200 * far.filter((p) => inside(r, p)).length + ((r.y0 + r.y1) / 2 > marker.y ? 40 : 0);
  let best: CardSpot | null = null;
  for (const side of sides) {
    const rect = rectAt(marker, size, side, 16);
    if (!fits(rect)) continue;
    const cost = score(rect, 0);
    if (!best || cost < best.cost) best = { rect, side, cost };
  }
  const hw = size.w / 2;
  const hh = size.h / 2;
  for (const distance of [48, 100, 160, 230]) {
    for (let k = 0; k < 12; k++) {
      // Starting straight up, the reference's favourite, then round the clock.
      const angle = -Math.PI / 2 + (k * Math.PI) / 6;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      // From the card's centre to its edge along the ray towards the marker.
      const edge = Math.min(Math.abs(dx) > 1e-6 ? hw / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-6 ? hh / Math.abs(dy) : Infinity);
      const cx = marker.x + dx * (distance + edge);
      const cy = marker.y + dy * (distance + edge);
      const rect = { x0: cx - hw, y0: cy - hh, x1: cx + hw, y1: cy + hh };
      if (!fits(rect)) continue;
      const cost = score(rect, distance);
      if (!best || cost < best.cost) {
        best = { rect, cost, leader: { x0: marker.x + dx * MARKER_R, y0: marker.y + dy * MARKER_R, x1: cx - dx * edge, y1: cy - dy * edge } };
      }
    }
  }
  return best;
}

