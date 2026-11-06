<script lang="ts">
// --- ski-resort-explorer helpers (kept identical across both lanes) ---
export type SkiLang = "en" | "fr";

/** The block's own map id, so a map elsewhere on the page never answers for it. */
export const SKI_MAP_ID = "ski-resort-explorer";

/** Where a reader gets an unmap key: the no-key state's first action. */
export const KEY_URL = "https://unmap.dev/dashboard";

/** All of Canada: where the map opens. */
export const CANADA_VIEW: { center: [number, number]; zoom: number } = { center: [-100, 56], zoom: 3 };

/** The camera tilt when an area is picked, so its terrain reads in 3D. */
export const AREA_PITCH = 60;

/** How long a pause in typing waits before the search asks the gateway. */
export const SEARCH_DEBOUNCE_MS = 250;

/** The activity filter: both, or one. */
export type SkiActivityFilter = "all" | "downhill" | "nordic";

/** The eight directions the aspect histogram is binned into, clockwise from north. */
export const ASPECTS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const;
export type SkiAspect = (typeof ASPECTS)[number];

/** Provinces and territories, in the order the filter lists them. */
export const PROVINCES = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"] as const;

export const SKI_COPY = {
  en: {
    title: "Ski areas",
    description: "Every ski area in Canada on 3D terrain. Search by name, filter by province or activity, and pick one for its numbers.",
    checking: "Loading ski areas...",
    search: "Search ski areas",
    searchPlaceholder: "Whistler, Mont-Sainte-Anne...",
    province: "Province or territory",
    allProvinces: "All provinces and territories",
    activity: "Activity",
    activities: { all: "All", downhill: "Downhill", nordic: "Nordic" },
    list: "Ski areas",
    count: (n: number) => (n === 1 ? "1 ski area" : `${n.toLocaleString("en-CA")} ski areas`),
    empty: "No ski area matches. Clear the search or the filters.",
    loading: "Searching...",
    back: "Back to all ski areas",
    selected: "Selected ski area",
    noPlace: "Location unknown",
    vertical: "Vertical",
    topBase: "Top / base",
    noElevation: "Not sampled",
    runs: "Runs",
    downhillKm: "Downhill",
    nordicKm: "Nordic",
    lifts: "Lifts",
    drive: "Drive",
    noDrive: "No city within reach",
    driveFrom: (time: string, from: string) => `${time} from ${from}`,
    aspect: "Aspect",
    aspectCaption: "Share of downhill run length facing each direction.",
    aspectNone: "No downhill runs to measure.",
    facing: (direction: string, share: string) => `Mostly faces ${direction} (${share}).`,
    directions: { n: "N", ne: "NE", e: "E", se: "SE", s: "S", sw: "SW", w: "W", nw: "NW" },
    directionNames: {
      n: "north",
      ne: "northeast",
      e: "east",
      se: "southeast",
      s: "south",
      sw: "southwest",
      w: "west",
      nw: "northwest",
    },
    websites: "Website",
    busy: "Too many requests. Try again in a moment.",
    keyRefused: "The API key was refused. Check it and try again.",
    unavailable: "The service didn't answer. Try again in a moment.",
    badSearch: "That search can't be run. Use letters or digits.",
    failed: "The search failed. Try again.",
    retry: "Try again",
    liftsDenied: "3D lifts need the Ski add-on on this key.",
    liftsMissing: "This ski area has no 3D lifts yet.",
    liftsFailed: "The 3D lifts did not load.",
    summary: "Every ski area in Canada on 3D terrain.",
    legend: "Legend",
    legendRuns: "Runs",
    legendKeys: {
      easy: "Easy",
      intermediate: "Intermediate",
      advanced: "Advanced",
      expert: "Expert",
      park: "Terrain park",
      nordic: "Nordic trail",
      lift: "Lift",
      lift3d: "Lift, cable in 3D",
    },
    difficulties: {
      easy: "Easy, green circle",
      intermediate: "Intermediate, blue square",
      advanced: "Advanced, black diamond",
      expert: "Expert, double black diamond",
      park: "Terrain park",
      unrated: "No difficulty given",
    },
    nordicTrail: "Nordic trail",
    unnamedRun: "Unnamed run",
    unnamedLift: "Unnamed lift",
    pitch: "Average pitch",
    faces: "Faces",
    rise: "Rise",
    length: "Length",
    towers: "Towers",
    aerialways: {
      cable_car: "Cable car",
      gondola: "Gondola",
      mixed_lift: "Chairs and gondolas",
      chair_lift: "Chairlift",
      drag_lift: "Drag lift",
      "t-bar": "T-bar",
      "j-bar": "J-bar",
      platter: "Platter lift",
      rope_tow: "Rope tow",
      magic_carpet: "Magic carpet",
      zip_line: "Zip line",
      goods: "Goods lift",
    } as Record<string, string>,
    lift: "Lift",
    deniedTitle: {
      addon_required: "Ski areas need the Ski add-on",
      dev_only: "Ski areas are free for development only",
      usage_limit_reached: "This month's development allowance is used",
    },
    deniedBody: {
      addon_required:
        "This key does not hold the Ski add-on, so the map shows the winter style on 3D terrain without ski areas, runs or lifts, and the list is off.",
      dev_only:
        "On the dev plan, ski areas work from localhost. From this origin they need a paid plan with the Ski add-on.",
      usage_limit_reached:
        "The dev plan's premium calls for this month are used. Ski areas come back next month, or now with a paid plan.",
    },
    unknownTitle: "Could not load ski areas",
    unknownBody: (status: number) =>
      status === 401
        ? "The gateway refused this key. Check the key and its allowed origins."
        : `The gateway answered ${status === 0 ? "nothing (a network error)" : `HTTP ${status}`}, so the list is off. The map shows the winter style on 3D terrain.`,
    pricing: "Plans and add-ons",
    pricingUrl: "https://unmap.dev/pricing",
    attribution: "Ski data © OpenStreetMap contributors",
    attributionUrl: "https://www.openstreetmap.org/copyright",
    licence: "Open Database Licence (ODbL)",
    licenceUrl: "https://opendatacommons.org/licenses/odbl/",
    disclaimer:
      "Terrain information only, not avalanche or safety advice. Check the area's own conditions and avalanche forecasts before you go.",
    provinceNames: {
      AB: "Alberta",
      BC: "British Columbia",
      MB: "Manitoba",
      NB: "New Brunswick",
      NL: "Newfoundland and Labrador",
      NS: "Nova Scotia",
      NT: "Northwest Territories",
      NU: "Nunavut",
      ON: "Ontario",
      PE: "Prince Edward Island",
      QC: "Quebec",
      SK: "Saskatchewan",
      YT: "Yukon",
    } as Record<string, string>,
    noKeyTitle: "Add your unmap key to load the map.",
    getKey: "Get a key",
    noKey:
      'No unmap key. Pass apiKey. On Next.js, set NEXT_PUBLIC_UNMAP_KEY in .env.local. On Nuxt, set NUXT_PUBLIC_UNMAP_KEY in .env. If you installed with unmap add, nuxt.config already declares runtimeConfig: { public: { unmapKey: "" } }; otherwise add it there. Then restart the dev server.',
  },
  fr: {
    title: "Stations de ski",
    description:
      "Toutes les stations de ski du Canada sur relief 3D. Cherchez par nom, filtrez par province ou par activité, et choisissez-en une pour ses chiffres.",
    checking: "Chargement des stations de ski...",
    search: "Chercher une station",
    searchPlaceholder: "Whistler, Mont-Sainte-Anne...",
    province: "Province ou territoire",
    allProvinces: "Toutes les provinces et tous les territoires",
    activity: "Activité",
    activities: { all: "Toutes", downhill: "Ski alpin", nordic: "Ski de fond" },
    list: "Stations de ski",
    count: (n: number) => (n === 1 ? "1 station de ski" : `${n.toLocaleString("fr-CA")} stations de ski`),
    empty: "Aucune station ne correspond. Effacez la recherche ou les filtres.",
    loading: "Recherche...",
    back: "Retour à toutes les stations",
    selected: "Station choisie",
    noPlace: "Emplacement inconnu",
    vertical: "Dénivelé",
    topBase: "Sommet / base",
    noElevation: "Non mesuré",
    runs: "Pistes",
    downhillKm: "Ski alpin",
    nordicKm: "Ski de fond",
    lifts: "Remontées",
    drive: "En voiture",
    noDrive: "Aucune ville à portée",
    driveFrom: (time: string, from: string) => `${time} de ${from}`,
    aspect: "Orientation",
    aspectCaption: "Part de la longueur des pistes de ski alpin orientée dans chaque direction.",
    aspectNone: "Aucune piste de ski alpin à mesurer.",
    facing: (direction: string, share: string) => `Surtout orientée ${direction} (${share}).`,
    directions: { n: "N", ne: "NE", e: "E", se: "SE", s: "S", sw: "SO", w: "O", nw: "NO" },
    directionNames: {
      n: "au nord",
      ne: "au nord-est",
      e: "à l'est",
      se: "au sud-est",
      s: "au sud",
      sw: "au sud-ouest",
      w: "à l'ouest",
      nw: "au nord-ouest",
    },
    websites: "Site Web",
    busy: "Trop de requêtes. Réessayez dans un instant.",
    keyRefused: "La clé API a été refusée. Vérifiez-la et réessayez.",
    unavailable: "Le service n'a pas répondu. Réessayez dans un instant.",
    badSearch: "Cette recherche est impossible. Utilisez des lettres ou des chiffres.",
    failed: "La recherche a échoué. Réessayez.",
    retry: "Réessayer",
    liftsDenied: "Les remontées 3D nécessitent le module complémentaire Ski sur cette clé.",
    liftsMissing: "Cette station n'a pas encore de remontées 3D.",
    liftsFailed: "Les remontées 3D ne se sont pas chargées.",
    summary: "Toutes les stations de ski du Canada sur relief 3D.",
    legend: "Légende",
    legendRuns: "Pistes",
    legendKeys: {
      easy: "Facile",
      intermediate: "Intermédiaire",
      advanced: "Difficile",
      expert: "Expert",
      park: "Parc à neige",
      nordic: "Piste de ski de fond",
      lift: "Remontée",
      lift3d: "Remontée, câble en 3D",
    },
    difficulties: {
      easy: "Facile, cercle vert",
      intermediate: "Intermédiaire, carré bleu",
      advanced: "Difficile, losange noir",
      expert: "Expert, double losange noir",
      park: "Parc à neige",
      unrated: "Difficulté non indiquée",
    },
    nordicTrail: "Piste de ski de fond",
    unnamedRun: "Piste sans nom",
    unnamedLift: "Remontée sans nom",
    pitch: "Pente moyenne",
    faces: "Orientée",
    rise: "Dénivelé",
    length: "Longueur",
    towers: "Pylônes",
    aerialways: {
      cable_car: "Téléphérique",
      gondola: "Télécabine",
      mixed_lift: "Télémixte",
      chair_lift: "Télésiège",
      drag_lift: "Téléski",
      "t-bar": "Téléski à archets",
      "j-bar": "Téléski à perche en J",
      platter: "Téléski à assiettes",
      rope_tow: "Fil-neige",
      magic_carpet: "Tapis roulant",
      zip_line: "Tyrolienne",
      goods: "Monte-charge",
    } as Record<string, string>,
    lift: "Remontée",
    deniedTitle: {
      addon_required: "Les stations de ski nécessitent le module complémentaire Ski",
      dev_only: "Les stations de ski sont gratuites en développement seulement",
      usage_limit_reached: "L'allocation de développement de ce mois est épuisée",
    },
    deniedBody: {
      addon_required:
        "Cette clé n'a pas le module complémentaire Ski : la carte montre le style hiver sur relief 3D sans stations, pistes ni remontées, et la liste est désactivée.",
      dev_only:
        "Avec le forfait de développement, les stations de ski fonctionnent depuis localhost. Depuis cette origine, il faut un forfait payant avec le module complémentaire Ski.",
      usage_limit_reached:
        "Les appels premium du forfait de développement sont épuisés pour ce mois. Les stations de ski reviennent le mois prochain, ou dès maintenant avec un forfait payant.",
    },
    unknownTitle: "Impossible de charger les stations de ski",
    unknownBody: (status: number) =>
      status === 401
        ? "La passerelle a refusé cette clé. Vérifiez la clé et ses origines autorisées."
        : `La passerelle a répondu ${status === 0 ? "rien (une erreur réseau)" : `HTTP ${status}`} : la liste est désactivée. La carte montre le style hiver sur relief 3D.`,
    pricing: "Forfaits et modules complémentaires",
    pricingUrl: "https://unmap.dev/fr/pricing",
    attribution: "Données de ski © les contributeurs d'OpenStreetMap",
    attributionUrl: "https://www.openstreetmap.org/copyright",
    licence: "Licence ouverte de bases de données (ODbL)",
    licenceUrl: "https://opendatacommons.org/licenses/odbl/",
    disclaimer:
      "Information sur le relief seulement, pas un avis sur les avalanches ni sur la sécurité. Consultez les conditions de la station et les bulletins d'avalanche avant de partir.",
    provinceNames: {
      AB: "Alberta",
      BC: "Colombie-Britannique",
      MB: "Manitoba",
      NB: "Nouveau-Brunswick",
      NL: "Terre-Neuve-et-Labrador",
      NS: "Nouvelle-Écosse",
      NT: "Territoires du Nord-Ouest",
      NU: "Nunavut",
      ON: "Ontario",
      PE: "Île-du-Prince-Édouard",
      QC: "Québec",
      SK: "Saskatchewan",
      YT: "Yukon",
    } as Record<string, string>,
    noKeyTitle: "Ajoutez votre clé unmap pour charger la carte.",
    getKey: "Obtenir une clé",
    noKey:
      'Aucune clé unmap. Passez apiKey. Avec Next.js, définissez NEXT_PUBLIC_UNMAP_KEY dans .env.local. Avec Nuxt, définissez NUXT_PUBLIC_UNMAP_KEY dans .env. Si vous avez installé le bloc avec unmap add, nuxt.config déclare déjà runtimeConfig: { public: { unmapKey: "" } } ; sinon, ajoutez-le. Redémarrez ensuite le serveur de développement.',
  },
};

/** Whether this key may read ski areas, as the first `/ski/areas` answered. */
export type SkiGate =
  | { state: "checking" }
  | { state: "granted" }
  | {
      state: "denied";
      /** `addon_required`: buy the add-on. `dev_only`: free from localhost only. `usage_limit_reached`: the dev plan's month is spent. */
      code: "addon_required" | "dev_only" | "usage_limit_reached";
      /** The SKU that unlocks it, e.g. `addon-ski`. */
      addon: string;
    }
  | { state: "unknown"; status: number };

/** The gate a failed first request means: a 403 with an add-on code is denied, anything else unknown. */
export function gateFrom(caught: unknown): SkiGate {
  const failure = typeof caught === "object" && caught !== null ? (caught as { status?: unknown; code?: unknown; addon?: unknown }) : {};
  const status = typeof failure.status === "number" ? failure.status : 0;
  const code = failure.code;
  if (status === 403 && (code === "addon_required" || code === "dev_only" || code === "usage_limit_reached")) {
    return { state: "denied", code, addon: typeof failure.addon === "string" ? failure.addon : "" };
  }
  return { state: "unknown", status };
}

/** What to tell the reader about a failed search once the list is up, by what the gateway said. */
export function requestError(caught: unknown, lang: SkiLang): string {
  const copy = SKI_COPY[lang];
  const failure = typeof caught === "object" && caught !== null ? (caught as { code?: unknown; status?: unknown }) : {};
  const status = typeof failure.status === "number" ? failure.status : null;
  if (status === 400) return copy.badSearch;
  if (status === 429) return copy.busy;
  if (status === 401 || status === 403) return copy.keyRefused;
  if (status === null || status === 0 || status >= 500) return copy.unavailable;
  return copy.failed;
}

/** The `areas()` options for the filters: nothing for "all", nothing for an empty search. */
export function areaQuery(q: string, province: string, activity: SkiActivityFilter): { q?: string; province?: string; activity?: "downhill" | "nordic" } {
  const text = q.trim();
  return {
    ...(text ? { q: text } : {}),
    ...(province && province !== "all" ? { province } : {}),
    ...(activity !== "all" ? { activity } : {}),
  };
}

const locale = (lang: SkiLang) => (lang === "fr" ? "fr-CA" : "en-CA");

/** Whole metres, grouped the way the language reads them: "1,631 m", "1 631 m". */
export function formatMetres(metres: number, lang: SkiLang): string {
  return `${new Intl.NumberFormat(locale(lang), { maximumFractionDigits: 0 }).format(metres)} m`;
}

/** Kilometres to one decimal: "150.5 km", "150,5 km". */
export function formatKm(km: number, lang: SkiLang): string {
  return `${new Intl.NumberFormat(locale(lang), { maximumFractionDigits: 1, minimumFractionDigits: 0 }).format(km)} km`;
}

/** A whole percentage: "30%", "30 %". */
export function formatShare(share: number, lang: SkiLang): string {
  return new Intl.NumberFormat(locale(lang), { style: "percent", maximumFractionDigits: 0 }).format(share);
}

/** A drive time: "45 min", "2 h", "2 h 3 min". The same in both languages. */
export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** "2 h 3 min from Vancouver", or null when no city is within reach. */
export function formatDrive(drive: { from: string; minutes: number } | null, lang: SkiLang): string | null {
  return drive ? SKI_COPY[lang].driveFrom(formatMinutes(drive.minutes), drive.from) : null;
}

/** "Whistler, British Columbia"; whichever half is known; "" when neither is. */
export function placeLine(area: { locality: string; province: string }, lang: SkiLang): string {
  const province = SKI_COPY[lang].provinceNames[area.province] ?? area.province;
  return [area.locality, province].filter((part) => part !== "").join(", ");
}

/** The aspect readout: one cell per direction in compass order, and the direction most runs face. */
export function aspectReadout(
  aspect: Partial<Record<SkiAspect, number>>,
  lang: SkiLang,
): { cells: Array<{ direction: SkiAspect; label: string; share: string; dominant: boolean }>; dominant: SkiAspect | null; summary: string } {
  const copy = SKI_COPY[lang];
  const value = (direction: SkiAspect) => (Number.isFinite(aspect[direction]) ? (aspect[direction] as number) : 0);
  const total = ASPECTS.reduce((sum, direction) => sum + value(direction), 0);
  const dominant = total > 0 ? ASPECTS.reduce((best, direction) => (value(direction) > value(best) ? direction : best), ASPECTS[0]) : null;
  return {
    cells: ASPECTS.map((direction) => ({
      direction,
      label: copy.directions[direction],
      share: formatShare(value(direction), lang),
      dominant: direction === dominant,
    })),
    dominant,
    summary: dominant ? copy.facing(copy.directionNames[dominant], formatShare(value(dominant), lang)) : copy.aspectNone,
  };
}

/** The websites safe to link: http and https only, since anyone can edit OSM. */
export function safeWebsites(urls: readonly string[]): string[] {
  const out: string[] = [];
  for (const url of urls) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") out.push(parsed.href);
    } catch {
      // Not a URL: not a link.
    }
  }
  return out;
}

/** A website as a reader recognizes it: the host without `www.`. */
export function siteLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** An area name as a URL slug: accents dropped, lower case, words joined by hyphens. */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The short key a link names an area by: its name as a slug (`nakiska`). Two areas of the same
 * name each add their OSM type and number (`fortress-mountain-resort-w909322254`), and a name
 * with nothing left to slug (no Latin letters) is the id. Clashes are found among `known`, every
 * area the block has listed, which the first, unfiltered list already holds in full.
 */
export function areaSlug(area: { id: string; name: string }, known: ReadonlyArray<{ id: string; name: string }>): string {
  const base = slugify(area.name);
  if (base === "") return area.id;
  if (!known.some((other) => other.id !== area.id && slugify(other.name) === base)) return base;
  const id = /^osm-(way|relation|node)-(\d+)$/.exec(area.id);
  return id ? `${base}-${id[1]![0]}${id[2]}` : `${base}-${slugify(area.id)}`;
}

/** The area a link names, by its slug or by its id, among `areas`. */
export function findArea<T extends { id: string; name: string }>(key: string, areas: readonly T[], known: ReadonlyArray<{ id: string; name: string }>): T | undefined {
  return areas.find((entry) => entry.id === key) ?? areas.find((entry) => areaSlug(entry, known) === key);
}

/** The labelled numbers the panel shows for an area, in a fixed order. */
export function statRows(
  area: {
    elevation: { top_m: number; base_m: number; vertical_m: number } | null;
    runs: { count: number; downhill_km: number; nordic_km: number };
    lifts: { count: number };
    drive: { from: string; minutes: number } | null;
  },
  lang: SkiLang,
): Array<[string, string]> {
  const copy = SKI_COPY[lang];
  const count = (n: number) => new Intl.NumberFormat(locale(lang)).format(n);
  const elevation = area.elevation;
  return [
    [copy.vertical, elevation ? formatMetres(elevation.vertical_m, lang) : copy.noElevation],
    [copy.topBase, elevation ? `${formatMetres(elevation.top_m, lang)} / ${formatMetres(elevation.base_m, lang)}` : copy.noElevation],
    [copy.runs, count(area.runs.count)],
    [copy.downhillKm, formatKm(area.runs.downhill_km, lang)],
    [copy.nordicKm, formatKm(area.runs.nordic_km, lang)],
    [copy.lifts, count(area.lifts.count)],
    [copy.drive, formatDrive(area.drive, lang) ?? copy.noDrive],
  ];
}

/** Where focus goes in the list for a key: the next, previous, first or last row; null for any other key. */
export function nextRow(key: string, index: number, count: number): number | null {
  if (count <= 0) return null;
  if (key === "ArrowDown") return Math.min(index + 1, count - 1);
  if (key === "ArrowUp") return Math.max(index - 1, 0);
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

/** A box on screen, as getBoundingClientRect() gives it. */
export interface SkiRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** Camera padding in pixels, as MapLibre takes it. */
export interface SkiPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** The panel's inset from the map edge, and the gutter the camera keeps. */
export const GUTTER = 24;
/** The least map, in pixels, a padded camera must have to frame at its full gutter. */
const MIN_FRAME = 120;
/** The tightened gutter, and the least strip the camera keeps to frame in beside a tall panel. */
const TIGHT = 8;
const MIN_STRIP = 32;

/**
 * Camera padding that keeps the framed area clear of the floating panel: its width on the left
 * when it floats beside the map, its height at the bottom when it is a sheet across it. An even
 * gutter when nothing is measured. When the full gutter would leave too little map, the gutter
 * tightens and the frame stays in the strip the panel leaves.
 */
export function panelPadding(map: SkiRect, panel: SkiRect | null, gutter = GUTTER): SkiPadding {
  const even = { top: gutter, right: gutter, bottom: gutter, left: gutter };
  if (!panel || panel.width <= 0 || panel.height <= 0 || map.width <= 0 || map.height <= 0) return even;
  const sheet = panel.width >= map.width * 0.6;
  const cover = Math.round(sheet ? map.bottom - panel.top : panel.right - map.left);
  const size = sheet ? map.height : map.width;
  if (size - 2 * gutter - cover >= MIN_FRAME) return sheet ? { ...even, bottom: cover + gutter } : { ...even, left: cover + gutter };
  const near = Math.min(cover + TIGHT, size - TIGHT - MIN_STRIP);
  return sheet ? { ...even, top: TIGHT, bottom: near } : { ...even, left: near, right: TIGHT };
}

/** True when the reader asked for less motion: the camera jumps instead of flying. */
export function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
}

/** The part of a MapLibre map the camera uses. */
export interface SkiCameraMap {
  getContainer(): { getBoundingClientRect(): SkiRect };
  cameraForBounds(bounds: [[number, number], [number, number]], options: Record<string, unknown>): { center: unknown; zoom: number } | undefined;
  flyTo(options: Record<string, unknown>): unknown;
  jumpTo(options: Record<string, unknown>): unknown;
}

/** The closest the camera comes to an area, so a small hill still shows its surroundings. */
export const AREA_MAX_ZOOM = 15;

/**
 * The bearing that faces an area's slopes: opposite the way most of its downhill run length
 * faces, so the camera looks up the mountain at the runs, as a resort's trail map does. North (0)
 * when the runs face every way about equally, or there are none to measure.
 */
export function slopeBearing(aspect: Partial<Record<SkiAspect, number>>): number {
  let x = 0;
  let y = 0;
  ASPECTS.forEach((direction, index) => {
    const share = Number.isFinite(aspect[direction]) ? (aspect[direction] as number) : 0;
    x += share * Math.sin((index * Math.PI) / 4);
    y += share * Math.cos((index * Math.PI) / 4);
  });
  if (Math.hypot(x, y) < 0.1) return 0;
  const facing = ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
  return Math.round((facing + 180) % 360);
}

/**
 * The camera on an area: its bbox fitted clear of the panel, turned to face its slopes
 * (`slopeBearing`), tilted to `AREA_PITCH` and centred halfway up its vertical, so on 3D terrain
 * the runs sit in the middle of the free map rather than below a sea-level centre. Null when the
 * map cannot fit the bbox (a map with no size yet).
 */
export function areaCamera(
  map: SkiCameraMap,
  area: { bbox: [number, number, number, number]; aspect: Partial<Record<SkiAspect, number>>; elevation: { top_m: number; base_m: number } | null },
  panel: SkiRect | null,
): Record<string, unknown> | null {
  const [west, south, east, north] = area.bbox;
  const padding = panelPadding(map.getContainer().getBoundingClientRect(), panel);
  const bearing = slopeBearing(area.aspect);
  const fit = map.cameraForBounds(
    [
      [west, south],
      [east, north],
    ],
    { padding, bearing },
  );
  if (!fit || !Number.isFinite(fit.zoom)) return null;
  return {
    center: fit.center,
    // The fit is top-down; tilted, the far half shrinks as the near half grows, so the bbox still fits.
    zoom: Math.min(fit.zoom, AREA_MAX_ZOOM),
    bearing,
    pitch: AREA_PITCH,
    padding,
    ...(area.elevation ? { elevation: (area.elevation.top_m + area.elevation.base_m) / 2 } : {}),
  };
}

/** Fly to an area (`areaCamera`), or jump there when the reader asked for less motion. */
export function flyToArea(map: SkiCameraMap, area: Parameters<typeof areaCamera>[1], panel: SkiRect | null): void {
  const camera = areaCamera(map, area, panel);
  if (!camera) return;
  if (reducedMotion()) map.jumpTo(camera);
  else map.flyTo({ ...camera, duration: 1800, essential: true });
}

/**
 * The MapLibre options 3D lifts need when the map is created: an antialiased WebGL context, so
 * cables draw smooth. The same value as `deckMapOptions` in @unmap/deck, kept here so the block
 * does not import that package before 3D lifts are on.
 */
export const LIFTS_MAP_OPTIONS: { canvasContextAttributes: { antialias: true } } = { canvasContextAttributes: { antialias: true } };

/**
 * How far the map tilts. MapLibre stops at 60 degrees; a ski area reads best from lower, looking
 * across the slope, so the explorer allows 85 (a little short of the horizon, where terrain breaks).
 */
export const SKI_MAX_PITCH = 85;

/** The map's options, one object for each value of `lifts3d`, made once. */
const SKI_MAP_OPTIONS = {
  off: { maxPitch: SKI_MAX_PITCH },
  on: { maxPitch: SKI_MAX_PITCH, ...LIFTS_MAP_OPTIONS },
} as const;

/**
 * The MapLibre options the explorer's map is created with, plus the 3D lifts' when they are on.
 * Always the same object for the same `lifts3d`: the map is rebuilt when this object changes, so a
 * new one on every render would rebuild it on every render.
 */
export function skiMapOptions(lifts3d: boolean): { maxPitch: number; canvasContextAttributes?: { antialias: true } } {
  return lifts3d ? SKI_MAP_OPTIONS.on : SKI_MAP_OPTIONS.off;
}

/** What to tell the reader when an area's 3D lifts did not load, by what the gateway said. */
export function liftsError(caught: unknown, lang: SkiLang): string {
  const copy = SKI_COPY[lang];
  const failure = typeof caught === "object" && caught !== null ? (caught as { code?: unknown; status?: unknown }) : {};
  const code = failure.code;
  if (failure.status === 403 && (code === "addon_required" || code === "dev_only" || code === "usage_limit_reached")) return copy.liftsDenied;
  if (failure.status === 404) return copy.liftsMissing;
  return `${copy.liftsFailed} ${requestError(caught, lang)}`;
}

/** The style layers the `ski` overlay draws (apps/gateway/src/overlays.ts). */
export const SKI_LAYERS = {
  downhill: "overlay_ski_runs_downhill",
  nordic: "overlay_ski_runs_nordic",
  expertCore: "overlay_ski_runs_expert_core",
  lifts: "overlay_ski_lifts",
  liftsCasing: "overlay_ski_lifts_casing",
  liftsTowers: "overlay_ski_lifts_towers",
  labels: "overlay_ski_ski_area_labels",
} as const;

/** The 2D layers that draw a lift, hidden while the 3D lifts draw them instead. */
const LIFT_2D_LAYERS = [SKI_LAYERS.liftsCasing, SKI_LAYERS.lifts, SKI_LAYERS.liftsTowers] as const;

/** A `#rrggbb` colour as deck.gl's RGBA, or null for anything else. */
export function hexToRgba(color: unknown, alpha = 255): [number, number, number, number] | null {
  if (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color)) return null;
  const n = Number.parseInt(color.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, alpha];
}

/** The part of a MapLibre map 3D lifts read and change. */
export interface SkiLiftsMap {
  getTerrain(): { exaggeration?: number } | null | undefined;
  getLayer?(id: string): unknown;
  getPaintProperty?(id: string, name: string): unknown;
  setLayoutProperty?(id: string, name: string, value: unknown): unknown;
}

/** One lift as the 3D file holds it: the part the cables, the towers and a popup read. */
export interface SkiLift3d {
  id: string;
  name: string | null;
  aerialway: string;
  stations: [[number, number, number], [number, number, number]];
  pylons: Array<[number, number, number]>;
  cable: Array<[number, number, number]>;
}

/** How far a tower is drawn below the cable: about the height the pipeline hangs a cable above the ground. */
export const TOWER_DROP_M = 9;

/** Every pylon as a short vertical line under the cable, carrying the lift it holds up. */
export function liftTowers(lifts: readonly SkiLift3d[]): Array<SkiLift3d & { of: SkiLift3d }> {
  return lifts.flatMap((lift) =>
    lift.pylons.map((pylon, index) => ({
      ...lift,
      id: `${lift.id}:tower:${index}`,
      cable: [pylon, [pylon[0], pylon[1], pylon[2] - TOWER_DROP_M]] as Array<[number, number, number]>,
      of: lift,
    })),
  );
}

/** The deck.gl layer ids the 3D lifts draw, bottom first. */
export const LIFT_LAYER_IDS = ["unmap-lift-cables-casing", "unmap-lift-towers", "unmap-lift-cables"] as const;

/** A light casing under every cable, so it reads against dark woods and above the 2D lift line. */
const CASING: [number, number, number, number] = [255, 255, 255, 220];

/** Finds the lift drawn under a point on screen, or null. */
export type SkiLiftPicker = (x: number, y: number) => SkiLift3d | null;

/**
 * Draw one area's lifts in 3D: import @unmap/deck (only now, never at module load), fetch the
 * area's lifts-3d (one call), and add one interleaved deck.gl overlay at the map's terrain
 * exaggeration: each cable on a light casing, and a tower under every pylon. The 2D lift lines are
 * hidden while it is on, so a lift is drawn once. `onPicker` receives the function that finds the
 * lift under a point, and null when the overlay comes off. Returns the function that cancels a
 * pending load and takes the overlay off.
 */
export function showLifts3d(
  map: SkiLiftsMap,
  options: { key: string; areaId: string; gateway?: string; onError: (caught: unknown) => void; onPicker?: (pick: SkiLiftPicker | null) => void },
): () => void {
  const controller = new AbortController();
  let overlay: { remove(): void; overlay?: { pickObject?(opts: Record<string, unknown>): { object?: unknown } | null } } | null = null;
  let hidden = false;
  import("@unmap/deck")
    .then(async ({ createDeckOverlay, fetchLifts3d, liftCablesLayer, LIFT_COLORS }) => {
      const doc = await fetchLifts3d({ key: options.key, areaId: options.areaId, gateway: options.gateway, signal: controller.signal });
      if (controller.signal.aborted) return;
      const exaggeration = map.getTerrain()?.exaggeration ?? 1;
      const lifts = ((doc as { lifts?: SkiLift3d[] }).lifts ?? []) as SkiLift3d[];
      const every = (color: [number, number, number, number]) => Object.fromEntries(Object.keys(LIFT_COLORS ?? {}).map((key) => [key, color]));
      const casing = every(CASING);
      // One colour for every lift, the style's lift red, so 3D and 2D lifts agree and neither
      // reads as a run; the aerialway is in the popup.
      const red = hexToRgba(map.getLayer?.(SKI_LAYERS.lifts) ? map.getPaintProperty?.(SKI_LAYERS.lifts, "line-color") : null);
      const cable = red ? { colors: every(red) } : {};
      // Drawn over the terrain, not into it: the rendered terrain is coarser than the DEM the heights
      // were sampled from, so a cable a few metres up would otherwise vanish in stretches into it.
      const onTop = <L,>(layer: L): L =>
        typeof (layer as { clone?: unknown }).clone === "function"
          ? (layer as unknown as { clone(props: Record<string, unknown>): L }).clone({ parameters: { depthCompare: "always" } })
          : layer;
      overlay = createDeckOverlay(map as unknown as Parameters<typeof createDeckOverlay>[0], {
        layers: [
          onTop(liftCablesLayer(lifts as never, { id: LIFT_LAYER_IDS[0], exaggeration, width: 4, colors: casing, pickable: true })),
          onTop(liftCablesLayer(liftTowers(lifts) as never, { id: LIFT_LAYER_IDS[1], exaggeration, width: 1.5, pickable: true, ...cable })),
          onTop(liftCablesLayer(doc, { id: LIFT_LAYER_IDS[2], exaggeration, width: 2.5, pickable: true, ...cable })),
        ],
      });
      for (const id of LIFT_2D_LAYERS) {
        if (!map.getLayer?.(id)) continue;
        map.setLayoutProperty?.(id, "visibility", "none");
        hidden = true;
      }
      const drawn = overlay;
      options.onPicker?.((x, y) => {
        const hit = drawn.overlay?.pickObject?.({ x, y, radius: 6, layerIds: [...LIFT_LAYER_IDS] })?.object as (SkiLift3d & { of?: SkiLift3d }) | undefined;
        return hit ? (hit.of ?? hit) : null;
      });
    })
    .catch((caught: unknown) => {
      if (!controller.signal.aborted) options.onError(caught ?? new Error("failed"));
    });
  return () => {
    controller.abort();
    if (overlay) options.onPicker?.(null);
    overlay?.remove();
    overlay = null;
    // A style swap has already put the 2D lines back; only an overlay taken off here restores them.
    if (hidden) for (const id of LIFT_2D_LAYERS) if (map.getLayer?.(id)) map.setLayoutProperty?.(id, "visibility", "visible");
  };
}

/** The compass direction a bearing in degrees falls in. */
export function aspectOf(degrees: number): SkiAspect {
  return ASPECTS[Math.round((((degrees % 360) + 360) % 360) / 45) % 8]!;
}

/** Ground length of a path in metres, ignoring height. */
export function pathLength(path: ReadonlyArray<readonly [number, number, ...number[]]>): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const [lng1, lat1] = path[i - 1]!;
    const [lng2, lat2] = path[i]!;
    const r = Math.PI / 180;
    const dx = (lng2 - lng1) * r * Math.cos(((lat1 + lat2) / 2) * r) * 6371000;
    const dy = (lat2 - lat1) * r * 6371000;
    total += Math.hypot(dx, dy);
  }
  return total;
}

/** What a popup says about a run, a 2D lift or a 3D lift. */
export type SkiFeature =
  | { kind: "run"; name: string | null; pisteType: string; difficulty: string | null; pitch: number | null; aspect: number | null }
  | { kind: "lift"; name: string | null; aerialway: string | null; lift: SkiLift3d | null };

/** A run's tile properties as a popup reads them. */
export function runFeature(properties: Record<string, unknown>): SkiFeature {
  const text = (value: unknown) => (typeof value === "string" && value !== "" ? value : null);
  const number = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  return {
    kind: "run",
    name: text(properties.name),
    pisteType: text(properties.piste_type) ?? "downhill",
    difficulty: text(properties.difficulty),
    pitch: number(properties.pitch_avg_deg),
    aspect: number(properties.aspect),
  };
}

/** A lift, from its tile properties (2D) or its 3D record. */
export function liftFeature(source: Record<string, unknown> | SkiLift3d): SkiFeature {
  const lift = Array.isArray((source as SkiLift3d).cable) ? (source as SkiLift3d) : null;
  const name = typeof source.name === "string" && source.name !== "" ? source.name : null;
  const aerialway = lift ? lift.aerialway : typeof source.aerialway === "string" ? source.aerialway : null;
  return { kind: "lift", name, aerialway, lift };
}

/** Identifies a feature, so hovering along one run or lift keeps one card open. */
export function featureKey(feature: SkiFeature): string {
  if (feature.kind === "lift") return `lift:${feature.lift?.id ?? ""}:${feature.name ?? ""}:${feature.aerialway ?? ""}`;
  return `run:${feature.name ?? ""}:${feature.pisteType}:${feature.difficulty ?? ""}:${feature.pitch ?? ""}:${feature.aspect ?? ""}`;
}

/** The run difficulty a tile value is drawn as (overlays.ts groups OSM's values the same way). */
export function difficultyKey(difficulty: string | null): "easy" | "intermediate" | "advanced" | "expert" | "park" | "unrated" {
  if (difficulty === "novice" || difficulty === "easy") return "easy";
  if (difficulty === "intermediate" || difficulty === "advanced" || difficulty === "park") return difficulty;
  if (difficulty === "expert" || difficulty === "freeride" || difficulty === "extreme") return "expert";
  return "unrated";
}

/** A popup's title, its kind line and its rows. */
export function featureDetails(feature: SkiFeature, lang: SkiLang): { title: string; kind: string; rows: Array<[string, string]> } {
  const copy = SKI_COPY[lang];
  const degrees = (n: number) => `${new Intl.NumberFormat(locale(lang), { maximumFractionDigits: 0 }).format(n)}°`;
  if (feature.kind === "run") {
    const rows: Array<[string, string]> = [];
    if (feature.pitch !== null) rows.push([copy.pitch, degrees(feature.pitch)]);
    if (feature.aspect !== null) rows.push([copy.faces, copy.directionNames[aspectOf(feature.aspect)]]);
    return {
      title: feature.name ?? copy.unnamedRun,
      kind: feature.pisteType === "nordic" ? copy.nordicTrail : copy.difficulties[difficultyKey(feature.difficulty)],
      rows,
    };
  }
  const rows: Array<[string, string]> = [];
  const lift = feature.lift;
  if (lift) {
    const [bottom, top] = lift.stations;
    rows.push([copy.rise, formatMetres(Math.abs(top[2] - bottom[2]), lang)]);
    const metres = pathLength(lift.cable.length >= 2 ? lift.cable : lift.stations);
    rows.push([copy.length, metres >= 1000 ? formatKm(metres / 1000, lang) : formatMetres(metres, lang)]);
    if (lift.pylons.length > 0) rows.push([copy.towers, new Intl.NumberFormat(locale(lang)).format(lift.pylons.length)]);
  }
  return {
    title: feature.name ?? copy.unnamedLift,
    kind: (feature.aerialway && copy.aerialways[feature.aerialway]) || copy.lift,
    rows,
  };
}

/** The legend's rows, in the order a trail map lists them. */
export const LEGEND_KEYS = ["easy", "intermediate", "advanced", "expert", "park", "nordic", "lift"] as const;
export type SkiLegendKey = (typeof LEGEND_KEYS)[number];

/**
 * The colour of each legend row, read from the style the map is drawing, so the legend always
 * matches the lines (and the night palette on a dark style). The downhill colours are the
 * `match` on `difficulty` in the runs layer's `line-color`; a row the style does not give is null.
 */
export function legendColors(paint: { downhill?: unknown; nordic?: unknown; lifts?: unknown }): Record<SkiLegendKey, string | null> {
  const colors: Record<SkiLegendKey, string | null> = { easy: null, intermediate: null, advanced: null, expert: null, park: null, nordic: null, lift: null };
  const expr = paint.downhill;
  if (Array.isArray(expr) && expr[0] === "match") {
    for (let i = 2; i + 1 < expr.length; i += 2) {
      const labels = Array.isArray(expr[i]) ? (expr[i] as unknown[]) : [expr[i]];
      const color = expr[i + 1];
      if (typeof color !== "string") continue;
      for (const label of labels) {
        const key = typeof label === "string" ? difficultyKey(label) : "unrated";
        if (key !== "unrated" && colors[key] === null) colors[key] = color;
      }
    }
  }
  if (typeof paint.nordic === "string") colors.nordic = paint.nordic;
  if (typeof paint.lifts === "string") colors.lift = paint.lifts;
  return colors;
}

/** Tailwind heights for an aspect bar, so a bar is sized by a class and never an inline style. */
const BAR_HEIGHTS = ["h-0", "h-0.5", "h-1", "h-1.5", "h-2", "h-2.5", "h-3", "h-3.5", "h-4", "h-5", "h-6", "h-7", "h-8"] as const;

/** The bar class for a share, scaled to the largest share. */
export function barHeight(share: number, largest: number): string {
  if (!(largest > 0) || !(share > 0)) return BAR_HEIGHTS[0];
  return BAR_HEIGHTS[Math.max(1, Math.round((share / largest) * (BAR_HEIGHTS.length - 1)))]!;
}

/** The three figures an area's header shows large, and the rest of its numbers as rows. */
export function areaFigures(area: Parameters<typeof statRows>[0], lang: SkiLang): { tiles: Array<[string, string]>; rows: Array<[string, string]> } {
  const [vertical, topBase, runs, downhill, nordic, lifts, drive] = statRows(area, lang);
  return { tiles: [vertical!, runs!, lifts!], rows: [topBase!, downhill!, nordic!, drive!] };
}
// --- end ski-resort-explorer helpers ---
</script>

<script setup lang="ts">
/**
 * <UnmapSkiResortExplorer> - every ski area in Canada on the winter style in 3D: a searchable
 * list (name, province, activity) beside the map, and, for the area you pick, its vertical, runs,
 * lifts, aspect and drive time. Picking an area flies to it, turned to face its slopes and tilted
 * onto its terrain. Click a run or a lift on the map for its card (difficulty, pitch and aspect;
 * kind, rise and length), and the legend says what each colour and line means. A full-bleed map
 * with a floating panel, a bottom sheet on a phone.
 *
 * The list needs the Ski add-on. The block's first `/ski/areas` call says whether your key holds
 * it. If it does not, the map still renders (the winter style on 3D terrain, without the `ski`
 * overlay, which would be refused) and the panel says why and what unlocks it.
 *
 * Metering: every authenticated request is one call. The block calls `GET /ski/areas` once on
 * load and again when a filter changes (a search waits for a pause in typing), then the map's own
 * style and tile requests. Picking an area makes no call: the list already holds it. With
 * `lifts3d` on, picking an area also calls `GET /ski/areas/{id}/lifts-3d` (again after a style swap, which redraws the map), and the first such
 * pick imports @unmap/deck (deck.gl); with it off, neither is ever loaded.
 *
 * The data is derived from OpenStreetMap and is ODbL; the panel carries the attribution and the
 * licence. It is terrain information, not avalanche or safety advice, and the panel says so.
 *
 * Composes the map item on your shadcn-vue Card, Field, Input, Select, ToggleGroup, Table, Badge,
 * Alert, Button and Spinner. Installed by `npx shadcn-vue add` with its page at
 * app/pages/ski-resort-explorer.vue. Edit freely.
 */
import { computed, onBeforeUnmount, shallowRef, useId, useTemplateRef, watch, type HTMLAttributes } from "vue";
import { Ski, type SkiArea } from "@unmap/sdk";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { UnmapMap } from "@/components/ui/map";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useMapStore } from "@/lib/map-context";

const props = withDefaults(
  defineProps<{
    /** unmap API key with the Ski add-on. The page passes NUXT_PUBLIC_UNMAP_KEY. With none, the block asks for one and loads nothing. */
    apiKey: string;
    /** Gateway base URL. Defaults to the unmap production gateway. */
    gateway?: string;
    /** Language of the copy, the province names and the map labels. Defaults to "en". */
    lang?: SkiLang;
    /** Where the map opens, [longitude, latitude]: the initial camera only. Defaults to the middle of Canada. */
    center?: [number, number];
    /** The opening zoom: the initial camera only, like `center`. Defaults to 3, all of Canada. */
    zoom?: number;
    /** Vertical exaggeration of the 3D terrain, 0.1 to 5. Omit for the gateway's default, 1. */
    exaggeration?: number;
    /**
     * Draw the picked area's lift cables in 3D, on its terrain. Off by default. When on, the map is
     * created antialiased (switching it recreates the map), and picking an area imports
     * @unmap/deck and calls `/ski/areas/{id}/lifts-3d` per area, and again after a style swap.
     */
    lifts3d?: boolean;
    /**
     * The area to show, by its slug (`nakiska`, see `areaSlug`) or its id, such as one read from the
     * page URL (`v-model:area`). Picks that area once the list holds it; `null` closes it. Omit it
     * and the block keeps its own selection.
     */
    area?: string | null;
    class?: HTMLAttributes["class"];
  }>(),
  { lang: "en", center: () => CANADA_VIEW.center, zoom: CANADA_VIEW.zoom, lifts3d: false, area: undefined },
);

const emit = defineEmits<{
  /** The area's slug, and the area, when the reader picks one; nulls when they close it. */
  "update:area": [slug: string | null, area: SkiArea | null];
}>();

// The opening camera, kept: after this the reader moves the map, not the props.
const opening = { center: props.center, zoom: props.zoom };

/** What the list holds: the areas, whether an answer is pending, and the last failure. */
type SkiList = { areas: SkiArea[]; pending: boolean; error: unknown };

const ACTIVITY_FILTERS = ["all", "downhill", "nordic"] as const;

// Vue's inject reads only a component's ancestors, so `useMap()` here could not see the map this
// component renders. It resolves the store that map registers in instead.
const mapStore = useMapStore();
const map = computed(() => mapStore.get(SKI_MAP_ID)?.map ?? null);
// Ready once the style has loaded: the terrain, and its exaggeration, are on the map. A style swap
// (a new exaggeration, light or dark) clears it, so the cables are drawn again on the new one.
const mapReady = computed(() => mapStore.get(SKI_MAP_ID)?.ready ?? false);

const copy = computed(() => SKI_COPY[props.lang]);
const hasKey = computed(() => props.apiKey.trim() !== "");
const ski = computed(() => new Ski({ key: props.apiKey, gateway: props.gateway }));
const gate = shallowRef<SkiGate>({ state: "checking" });
const granted = computed(() => gate.value.state === "granted");
const attempt = shallowRef(0);
const text = shallowRef("");
const q = shallowRef("");
const province = shallowRef("all");
const activity = shallowRef<SkiActivityFilter>("all");
const list = shallowRef<SkiList>({ areas: [], pending: true, error: null });
// Every area listed so far, by id: what an area's slug is kept unique among.
const known = new Map<string, SkiArea>();
const selected = shallowRef<SkiArea | null>(null);
const liftsFailure = shallowRef<unknown>(null);
const liftsAttempt = shallowRef(0);
const panel = useTemplateRef<HTMLElement>("panel");
const listEl = useTemplateRef<HTMLElement>("rows");
const uid = useId();
const searchId = `${uid}-search`;
const provinceId = `${uid}-province`;
const listId = `${uid}-list`;
const aspectId = `${uid}-aspect`;

const gateCode = computed(() => (gate.value.state === "denied" ? gate.value.code : gate.value.state === "unknown" ? "unknown" : null));
const gateTitle = computed(() => (gate.value.state === "denied" ? copy.value.deniedTitle[gate.value.code] : copy.value.unknownTitle));
const gateBody = computed(() =>
  gate.value.state === "denied" ? copy.value.deniedBody[gate.value.code] : gate.value.state === "unknown" ? copy.value.unknownBody(gate.value.status) : "",
);
const aspect = computed(() => (selected.value ? aspectReadout(selected.value.aspect, props.lang) : null));
const figures = computed(() => (selected.value ? areaFigures(selected.value, props.lang) : null));
const websites = computed(() => (selected.value ? safeWebsites(selected.value.websites) : []));
const largestShare = computed(() => Math.max(0, ...ASPECTS.map((direction) => selected.value?.aspect[direction] ?? 0)));
const said = computed(() => {
  if (selected.value) return `${selected.value.name}. ${placeLine(selected.value, props.lang)}`;
  return list.value.pending ? "" : copy.value.count(list.value.areas.length);
});
const provinceItems = computed(() => PROVINCES.map((code) => ({ value: code, label: copy.value.provinceNames[code] ?? code })));

// A new key starts over: its add-on answer is its own.
watch([() => props.apiKey, () => props.gateway], () => {
  gate.value = { state: "checking" };
  selected.value = null;
});

// The search waits for a pause in typing; the filters apply at once.
watch(text, (value, _previous, onCleanup) => {
  const timer = setTimeout(() => {
    q.value = value;
  }, SEARCH_DEBOUNCE_MS);
  onCleanup(() => clearTimeout(timer));
});

// One /ski/areas per key and per filter set. The first answer is also the add-on gate.
watch(
  [ski, hasKey, q, province, activity, attempt],
  ([client, keyed, search, region, kind], _previous, onCleanup) => {
    if (!keyed) return;
    const controller = new AbortController();
    list.value = { ...list.value, pending: true };
    client.areas({ ...areaQuery(search, region, kind), signal: controller.signal }).then(
      ({ data }) => {
        if (controller.signal.aborted) return;
        if (gate.value.state !== "granted") gate.value = { state: "granted" };
        list.value = { areas: data, pending: false, error: null };
      },
      (caught: unknown) => {
        if (controller.signal.aborted) return;
        if (gate.value.state === "checking") gate.value = gateFrom(caught);
        list.value = { ...list.value, pending: false, error: caught ?? new Error("failed") };
      },
    );
    onCleanup(() => controller.abort());
  },
  { immediate: true },
);

// Fly to the picked area once the map is there.
watch(
  [map, selected],
  ([live, area]) => {
    if (!live || !area) return;
    flyToArea(live as unknown as SkiCameraMap, area, panel.value?.getBoundingClientRect() ?? null);
  },
  { flush: "post" },
);

// The page's area, once the list holds it: a shared link, or the page's back button.
watch(
  [() => props.area, () => list.value.areas],
  ([key, areas]) => {
    for (const entry of areas) known.set(entry.id, entry);
    if (key === undefined) return;
    if (key === null) {
      selected.value = null;
      return;
    }
    const found = findArea(key, areas, [...known.values()]);
    if (found && selected.value?.id !== found.id) selected.value = found;
  },
  { immediate: true },
);

// The picked area's lift cables in 3D: one overlay at a time, taken off when the area changes,
// lifts3d turns off or the block unmounts. A new area, or lifts off, clears the last failure.
watch(
  [() => props.lifts3d, granted, () => selected.value?.id ?? null, map, mapReady, () => props.apiKey, () => props.gateway, liftsAttempt],
  ([on, open, areaId, live, ready, key, gateway], previous, onCleanup) => {
    if (!previous || previous[0] !== on || previous[2] !== areaId) liftsFailure.value = null;
    if (!on || !open || !areaId || !live || !ready) return;
    const stop = showLifts3d(live as unknown as SkiLiftsMap, {
      key,
      areaId,
      gateway,
      onError: (caught) => {
        liftsFailure.value = caught;
      },
      onPicker: (next) => {
        liftPicker.value = next;
      },
    });
    onCleanup(stop);
  },
  { immediate: true },
);

/** The part of a MapLibre map the popup and the legend read. */
interface SkiPopupMap {
  getLayer(id: string): unknown;
  getPaintProperty?(id: string, name: string): unknown;
  getZoom?(): number;
  queryRenderedFeatures(geometry: [[number, number], [number, number]], options: { layers: string[] }): Array<{ layer?: { id?: string }; properties?: Record<string, unknown> }>;
  project(lngLat: [number, number]): { x: number; y: number };
  getCanvas(): { style: { cursor: string } };
  on(type: string, listener: (event: never) => void): unknown;
  off(type: string, listener: (event: never) => void): unknown;
}
type MapPointer = { point: { x: number; y: number }; lngLat: { lng: number; lat: number } };

/** How near, in pixels, the pointer must be to a run or a lift to open it. */
const HIT = 5;
/** The zoom the runs and lifts appear at (overlays.ts), and so the legend with them. */
const RUNS_MINZOOM = 11;

const liftPicker = shallowRef<SkiLiftPicker | null>(null);
const popup = shallowRef<{ feature: SkiFeature; key: string } | null>(null);
/** Where the card points, kept out of reactive state: it changes on every pointer move. */
let popupAt: [number, number] | null = null;
const popupEl = useTemplateRef<HTMLElement>("popupCard");
const popupDetails = computed(() => (popup.value ? featureDetails(popup.value.feature, props.lang) : null));
const popupSymbol = computed(() => {
  const feature = popup.value?.feature;
  if (!feature || feature.kind !== "run" || feature.pisteType === "nordic") return null;
  const key = difficultyKey(feature.difficulty);
  return key === "unrated" ? null : key;
});
const legend = shallowRef<{ shown: boolean; colors: Record<SkiLegendKey, string | null>; core: string | null } | null>(null);
const legendWide = typeof window === "undefined" || window.matchMedia?.("(min-width: 640px)")?.matches !== false;
const LEGEND_SYMBOLS = ["easy", "intermediate", "advanced", "expert"] as const;

/** What is under a point: a 3D lift first, then a 2D lift, a run, or an area's label. */
function featureAt(live: SkiPopupMap, point: { x: number; y: number }): SkiFeature | { kind: "area"; id: string } | null {
  const lift = (props.lifts3d ? liftPicker.value : null)?.(point.x, point.y);
  if (lift) return liftFeature(lift);
  const layers = [SKI_LAYERS.lifts, SKI_LAYERS.downhill, SKI_LAYERS.nordic, SKI_LAYERS.labels].filter((id) => live.getLayer(id));
  if (layers.length === 0) return null;
  const hits = live.queryRenderedFeatures(
    [
      [point.x - HIT, point.y - HIT],
      [point.x + HIT, point.y + HIT],
    ],
    { layers },
  );
  for (const id of layers) {
    const hit = hits.find((feature) => feature.layer?.id === id);
    if (!hit) continue;
    const properties = hit.properties ?? {};
    if (id === SKI_LAYERS.labels) return typeof properties.id === "string" ? { kind: "area", id: properties.id } : null;
    return id === SKI_LAYERS.lifts ? liftFeature(properties) : runFeature(properties);
  }
  return null;
}

/** Pins the card above its point; hidden while the point is off the map. */
function placePopup() {
  const target = map.value as unknown as SkiPopupMap | null;
  const card = popupEl.value;
  if (!target || !card || !popupAt) return;
  const { x, y } = target.project(popupAt);
  const parent = card.parentElement?.getBoundingClientRect();
  const inside = parent && parent.width > 0 ? x >= 0 && y >= 0 && x <= parent.width && y <= parent.height : true;
  card.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, calc(-100% - 14px))`;
  card.style.visibility = inside ? "visible" : "hidden";
}

/** Opens the card on a run or a lift under the pointer, and closes it on anything else. */
function showPopup(event: MapPointer, found: SkiFeature | { kind: "area"; id: string } | null) {
  if (!found || found.kind === "area") {
    popupAt = null;
    popup.value = null;
    return;
  }
  popupAt = [event.lngLat.lng, event.lngLat.lat];
  const key = featureKey(found);
  if (popup.value?.key !== key) popup.value = { feature: found, key };
  placePopup();
}

// Hover a run or a lift for its card, which follows the pointer; on a touch screen, with no
// hover, a tap opens it and a tap elsewhere closes it. Clicking an area's name on the map picks
// that area. It reads what the map already drew: no request.
watch(
  [map, granted],
  ([live, open], _previous, onCleanup) => {
    const target = live as unknown as SkiPopupMap | null;
    if (!target || !open || typeof target.on !== "function") return;
    let frame = 0;
    const onClick = (event: MapPointer) => {
      const found = featureAt(target, event.point);
      if (found && found.kind === "area") {
        showPopup(event, null);
        const area = list.value.areas.find((entry) => entry.id === found.id);
        if (area) pick(area);
        return;
      }
      showPopup(event, found);
    };
    const onMove = (event: MapPointer) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const found = featureAt(target, event.point);
        target.getCanvas().style.cursor = found ? "pointer" : "";
        showPopup(event, found);
      });
    };
    const onOut = () => {
      cancelAnimationFrame(frame);
      popupAt = null;
      popup.value = null;
    };
    const readLegend = () => {
      const paint = (id: string) => (target.getLayer(id) ? target.getPaintProperty?.(id, "line-color") : undefined);
      const core = paint(SKI_LAYERS.expertCore);
      legend.value = {
        shown: (target.getZoom?.() ?? 0) >= RUNS_MINZOOM - 0.5,
        colors: legendColors({ downhill: paint(SKI_LAYERS.downhill), nordic: paint(SKI_LAYERS.nordic), lifts: paint(SKI_LAYERS.lifts) }),
        core: typeof core === "string" ? core : null,
      };
    };
    readLegend();
    target.on("click", onClick as never);
    target.on("mousemove", onMove as never);
    target.on("mouseout", onOut as never);
    target.on("zoomend", readLegend as never);
    target.on("styledata", readLegend as never);
    onCleanup(() => {
      cancelAnimationFrame(frame);
      target.off("click", onClick as never);
      target.off("mousemove", onMove as never);
      target.off("mouseout", onOut as never);
      target.off("zoomend", readLegend as never);
      target.off("styledata", readLegend as never);
      target.getCanvas().style.cursor = "";
    });
  },
  { immediate: true },
);

// A new area, or lifts drawn another way, closes the card.
watch([() => selected.value?.id, () => props.lifts3d, liftPicker], () => {
  popup.value = null;
});

// Place the card as it opens, and keep it on its point as the camera moves.
watch(
  [map, popup, popupEl],
  ([live, open, card], _previous, onCleanup) => {
    const target = live as unknown as SkiPopupMap | null;
    if (!target || !open || !card) return;
    placePopup();
    target.on("move", placePopup as never);
    onCleanup(() => target.off("move", placePopup as never));
  },
  { flush: "post" },
);

function onEscape(event: KeyboardEvent) {
  if (event.key === "Escape") popup.value = null;
}
if (typeof window !== "undefined") window.addEventListener("keydown", onEscape);
onBeforeUnmount(() => {
  if (typeof window !== "undefined") window.removeEventListener("keydown", onEscape);
});

function pick(next: SkiArea | null) {
  selected.value = next;
  if (next) known.set(next.id, next);
  emit("update:area", next ? areaSlug(next, [...known.values()]) : null, next);
}

function retry() {
  gate.value = { state: "checking" };
  attempt.value += 1;
}

function retryLifts() {
  liftsFailure.value = null;
  liftsAttempt.value += 1;
}

function chooseProvince(next: unknown) {
  province.value = typeof next === "string" && next ? next : "all";
}

// Pressing the pressed item empties the group; the filter keeps its value.
function chooseActivity(next: unknown) {
  if (next === "all" || next === "downhill" || next === "nordic") activity.value = next;
}

// Arrow keys, Home and End move between rows; Tab leaves the list.
function onListKey(event: KeyboardEvent) {
  const rows = [...(listEl.value?.querySelectorAll<HTMLElement>("[data-ski-area-id]") ?? [])];
  const index = rows.indexOf(document.activeElement as HTMLElement);
  const next = nextRow(event.key, index < 0 ? -1 : index, rows.length);
  if (next === null) return;
  event.preventDefault();
  rows[index < 0 && event.key === "ArrowDown" ? 0 : next]?.focus();
}
</script>

<template>
  <!-- Where the map would be: the block's gutter, the Alert at a readable width, the first action first. -->
  <div
    v-if="!hasKey"
    data-unmap-block="ski-resort-explorer"
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
  <!-- Where the map will be: the answer is one request away, so a quiet line, not a skeleton of a map. -->
  <div
    v-else-if="gate.state === 'checking'"
    data-unmap-block="ski-resort-explorer"
    data-state="checking"
    :class="['flex h-full min-h-[480px] items-center justify-center gap-2 bg-muted/40 p-4 sm:p-6', props.class]"
  >
    <Spinner class="size-4 text-muted-foreground" />
    <p aria-live="polite" class="text-sm text-muted-foreground">{{ copy.checking }}</p>
  </div>
  <div v-else data-unmap-block="ski-resort-explorer" :class="['relative h-full min-h-[480px]', props.class]">
    <UnmapMap
      :id="SKI_MAP_ID"
      :api-key="props.apiKey"
      :gateway="props.gateway"
      :lang="props.lang"
      map-style="winter"
      :terrain="true"
      :exaggeration="props.exaggeration"
      :overlays="granted ? ['ski'] : undefined"
      :maplibre="skiMapOptions(props.lifts3d)"
      :center="opening.center"
      :zoom="opening.zoom"
      class="h-full"
    >
      <p data-testid="ski-announce" aria-live="polite" class="sr-only">{{ said }}</p>
      <div
        v-if="granted && popup && popupDetails"
        ref="popupCard"
        role="tooltip"
        :aria-label="popupDetails.title"
        data-testid="ski-feature"
        class="pointer-events-none absolute top-0 left-0 z-20 w-60 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95"
      >
        <div class="flex min-w-0 flex-col gap-0.5">
          <p class="text-sm leading-tight font-semibold">{{ popupDetails.title }}</p>
          <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <svg v-if="popupSymbol" aria-hidden="true" viewBox="0 0 16 16" class="size-3.5 shrink-0">
              <circle v-if="popupSymbol === 'easy'" cx="8" cy="8" r="6" fill="currentColor" />
              <rect v-else-if="popupSymbol === 'intermediate'" x="2.5" y="2.5" width="11" height="11" fill="currentColor" />
              <path v-else-if="popupSymbol === 'advanced'" d="M8 1.5 14.5 8 8 14.5 1.5 8Z" fill="currentColor" />
              <path v-else-if="popupSymbol === 'expert'" d="M4.5 3 8.5 8 4.5 13 0.5 8ZM11.5 3 15.5 8 11.5 13 7.5 8Z" fill="currentColor" />
              <rect v-else x="1" y="5.5" width="14" height="5" rx="2.5" fill="currentColor" />
            </svg>
            {{ popupDetails.kind }}
          </p>
        </div>
        <dl v-if="popupDetails.rows.length > 0" class="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 border-t pt-2 text-xs">
          <div v-for="[label, value] in popupDetails.rows" :key="label" class="contents">
            <dt class="text-muted-foreground">{{ label }}</dt>
            <dd class="text-right font-medium tabular-nums">{{ value }}</dd>
          </div>
        </dl>
      </div>
      <details
        v-if="granted && legend?.shown"
        :open="legendWide"
        data-testid="ski-legend"
        class="group absolute top-3 left-3 z-10 rounded-lg border bg-popover/95 text-popover-foreground shadow-md backdrop-blur sm:top-auto sm:right-3 sm:bottom-10 sm:left-auto"
      >
        <summary class="cursor-pointer list-none px-3 py-2 text-xs font-semibold select-none [&::-webkit-details-marker]:hidden">{{ copy.legend }}</summary>
        <ul class="flex flex-col gap-1.5 px-3 pb-3 text-xs">
          <li v-for="key in LEGEND_SYMBOLS" :key="key" class="flex items-center gap-2">
            <span class="flex w-4 justify-center">
              <svg aria-hidden="true" viewBox="0 0 16 16" class="size-3.5 shrink-0">
                <circle v-if="key === 'easy'" cx="8" cy="8" r="6" :fill="legend.colors.easy ?? 'currentColor'" />
                <rect v-else-if="key === 'intermediate'" x="2.5" y="2.5" width="11" height="11" :fill="legend.colors.intermediate ?? 'currentColor'" />
                <path v-else-if="key === 'advanced'" d="M8 1.5 14.5 8 8 14.5 1.5 8Z" :fill="legend.colors.advanced ?? 'currentColor'" />
                <path v-else d="M4.5 3 8.5 8 4.5 13 0.5 8ZM11.5 3 15.5 8 11.5 13 7.5 8Z" :fill="legend.colors.expert ?? 'currentColor'" />
              </svg>
            </span>
            <svg aria-hidden="true" viewBox="0 0 24 10" class="h-2.5 w-6 shrink-0">
              <line x1="1" y1="5" x2="23" y2="5" :stroke="legend.colors[key] ?? 'currentColor'" :stroke-width="key === 'expert' ? 5 : 2.5" stroke-linecap="round" />
              <line v-if="key === 'expert'" x1="1" y1="5" x2="23" y2="5" :stroke="legend.core ?? 'var(--popover)'" stroke-width="1.6" stroke-linecap="round" />
            </svg>
            {{ copy.legendKeys[key] }}
          </li>
          <li class="flex items-center gap-2">
            <span class="w-4" />
            <svg aria-hidden="true" viewBox="0 0 24 10" class="h-2.5 w-6 shrink-0">
              <line x1="1" y1="5" x2="23" y2="5" :stroke="legend.colors.park ?? 'currentColor'" stroke-width="2.5" stroke-linecap="round" />
            </svg>
            {{ copy.legendKeys.park }}
          </li>
          <li class="flex items-center gap-2">
            <span class="w-4" />
            <svg aria-hidden="true" viewBox="0 0 24 10" class="h-2.5 w-6 shrink-0">
              <line x1="1" y1="5" x2="23" y2="5" :stroke="legend.colors.nordic ?? 'currentColor'" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="3 2.5" />
            </svg>
            {{ copy.legendKeys.nordic }}
          </li>
          <li class="flex items-center gap-2">
            <span class="w-4" />
            <svg aria-hidden="true" viewBox="0 0 24 10" class="h-2.5 w-6 shrink-0">
              <line x1="1" y1="5" x2="23" y2="5" stroke="var(--popover)" stroke-width="4.5" stroke-linecap="round" />
              <line x1="1" y1="5" x2="23" y2="5" :stroke="legend.colors.lift ?? 'currentColor'" stroke-width="2.5" stroke-linecap="round" />
              <path d="M6 1.5v7M12 1.5v7M18 1.5v7" :stroke="legend.colors.lift ?? 'currentColor'" stroke-width="1.4" />
            </svg>
            {{ props.lifts3d ? copy.legendKeys.lift3d : copy.legendKeys.lift }}
          </li>
        </ul>
      </details>
      <!-- A card floating on the map at 24 px; below `sm`, a sheet across the bottom (at most half the map) that clears the attribution. -->
      <div
        ref="panel"
        class="absolute inset-x-4 bottom-10 z-10 flex max-h-[50%] flex-col sm:inset-x-auto sm:top-6 sm:bottom-auto sm:left-6 sm:max-h-[calc(100%-3rem)] sm:w-[23rem] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-300 sm:motion-safe:slide-in-from-bottom-0 sm:motion-safe:slide-in-from-left-4"
      >
        <Card class="flex min-h-0 flex-1 flex-col gap-0 py-0">
          <section
            v-if="granted && selected && aspect && figures"
            :key="selected.id"
            :aria-label="copy.selected"
            data-testid="ski-area"
            class="flex min-h-0 flex-1 flex-col motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
          >
            <CardHeader class="gap-3 border-b pt-4 pb-4">
              <Button type="button" variant="ghost" size="sm" class="-ml-2 w-fit text-muted-foreground" @click="pick(null)">
                <span aria-hidden="true">‹</span>
                {{ copy.back }}
              </Button>
              <div class="flex min-w-0 flex-col gap-1">
                <h3 class="text-xl leading-tight font-semibold text-balance">{{ selected.name }}</h3>
                <p class="text-sm text-muted-foreground">{{ placeLine(selected, props.lang) || copy.noPlace }}</p>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <Badge v-for="name in selected.activities" :key="name" variant="secondary">{{ copy.activities[name] }}</Badge>
                <Badge v-if="selected.status && selected.status !== 'operating'" variant="outline">{{ selected.status }}</Badge>
              </div>
            </CardHeader>
            <CardContent class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain py-4">
              <Alert v-if="props.lifts3d && liftsFailure" variant="destructive" role="alert" data-unmap-lifts-error="">
                <AlertDescription class="flex flex-col items-start gap-2">
                  <span>{{ liftsError(liftsFailure, props.lang) }}</span>
                  <Button type="button" variant="outline" size="sm" @click="retryLifts">{{ copy.retry }}</Button>
                </AlertDescription>
              </Alert>
              <dl class="grid grid-cols-3 gap-2">
                <div v-for="[label, value] in figures.tiles" :key="label" class="flex flex-col gap-0.5 rounded-lg bg-muted/60 px-3 py-2.5">
                  <dt class="text-xs text-muted-foreground">{{ label }}</dt>
                  <dd class="text-lg leading-tight font-semibold tabular-nums">{{ value }}</dd>
                </div>
              </dl>
              <dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                <div v-for="[label, value] in figures.rows" :key="label" class="contents">
                  <dt class="text-muted-foreground">{{ label }}</dt>
                  <dd class="text-right font-medium tabular-nums">{{ value }}</dd>
                </div>
              </dl>
              <div class="flex flex-col gap-2">
                <p class="text-sm font-medium">{{ copy.aspect }}</p>
                <Table :aria-describedby="aspectId" class="table-fixed">
                  <TableHeader>
                    <TableRow class="border-0 hover:bg-transparent">
                      <TableHead v-for="cell in aspect.cells" :key="cell.direction" scope="col" class="h-auto px-0 pb-1 text-center align-bottom">
                        <span aria-hidden="true" class="flex h-8 items-end justify-center">
                          <span
                            :data-dominant="cell.dominant ? 'true' : undefined"
                            :class="['block w-3 rounded-sm bg-muted-foreground/35 data-[dominant=true]:bg-primary', barHeight(selected.aspect[cell.direction] ?? 0, largestShare)]"
                          />
                        </span>
                        <abbr :title="copy.directionNames[cell.direction]" class="mt-1 block text-xs font-medium no-underline">{{ cell.label }}</abbr>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow class="border-0 hover:bg-transparent">
                      <TableCell
                        v-for="cell in aspect.cells"
                        :key="cell.direction"
                        :data-dominant="cell.dominant ? 'true' : undefined"
                        class="px-0 py-0.5 text-center text-xs text-muted-foreground tabular-nums data-[dominant=true]:font-semibold data-[dominant=true]:text-foreground"
                        >{{ cell.share }}</TableCell
                      >
                    </TableRow>
                  </TableBody>
                </Table>
                <p :id="aspectId" class="text-xs text-muted-foreground">{{ aspect.summary }} {{ copy.aspectCaption }}</p>
              </div>
              <p v-if="websites.length > 0" class="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                <span class="text-muted-foreground">{{ copy.websites }}</span>
                <a v-for="url in websites" :key="url" class="font-medium text-primary underline underline-offset-4" :href="url" target="_blank" rel="noreferrer">{{
                  siteLabel(url)
                }}</a>
              </p>
            </CardContent>
          </section>
          <template v-else>
            <CardHeader class="gap-1 pt-4 pb-3">
              <CardTitle role="heading" aria-level="2">{{ copy.title }}</CardTitle>
              <CardDescription class="max-sm:hidden">{{ copy.summary }}</CardDescription>
            </CardHeader>
            <CardContent v-if="gateCode" class="pb-4">
              <Alert :data-unmap-addon-gate="gateCode">
                <AlertTitle class="line-clamp-none">{{ gateTitle }}</AlertTitle>
                <AlertDescription class="flex flex-col items-start gap-2">
                  <p>{{ gateBody }}</p>
                  <a
                    v-if="gate.state === 'denied'"
                    class="font-medium text-primary underline underline-offset-4"
                    :href="copy.pricingUrl"
                    target="_blank"
                    rel="noreferrer"
                    >{{ copy.pricing }}</a
                  >
                  <Button v-else type="button" variant="outline" size="sm" @click="retry">{{ copy.retry }}</Button>
                </AlertDescription>
              </Alert>
            </CardContent>
            <template v-if="granted">
              <div data-testid="ski-tools" class="flex shrink-0 flex-col gap-3 border-b px-6 pb-4">
                <Field>
                  <FieldLabel :for="searchId" class="sr-only">{{ copy.search }}</FieldLabel>
                  <Input
                    :id="searchId"
                    v-model="text"
                    type="search"
                    autocomplete="off"
                    :placeholder="copy.searchPlaceholder"
                    :aria-controls="listId"
                  />
                </Field>
                <div class="flex flex-wrap items-center gap-2">
                  <Field class="min-w-0 flex-1">
                    <FieldLabel :for="provinceId" class="sr-only">{{ copy.province }}</FieldLabel>
                    <Select :model-value="province" @update:model-value="chooseProvince">
                      <SelectTrigger :id="provinceId" class="w-full">
                        <SelectValue :placeholder="copy.allProvinces" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{{ copy.allProvinces }}</SelectItem>
                        <SelectItem v-for="item in provinceItems" :key="item.value" :value="item.value">{{ item.label }}</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    :aria-label="copy.activity"
                    :model-value="activity"
                    @update:model-value="chooseActivity"
                  >
                    <ToggleGroupItem v-for="value in ACTIVITY_FILTERS" :key="value" :value="value" class="px-2.5 aria-pressed:font-semibold">{{
                      copy.activities[value]
                    }}</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>
              <CardContent class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain py-3">
                <p data-testid="ski-count" class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Spinner v-if="list.pending" class="size-3.5" />
                  {{ list.pending ? copy.loading : copy.count(list.areas.length) }}
                </p>
                <Alert v-if="list.error" variant="destructive" role="alert">
                  <AlertDescription class="flex flex-col items-start gap-2">
                    <span>{{ requestError(list.error, props.lang) }}</span>
                    <Button type="button" variant="outline" size="sm" @click="attempt += 1">{{ copy.retry }}</Button>
                  </AlertDescription>
                </Alert>
                <p v-if="!list.pending && !list.error && list.areas.length === 0" class="text-sm">{{ copy.empty }}</p>
                <ul :id="listId" ref="rows" :aria-label="copy.list" class="-mx-3 flex flex-col" @keydown="onListKey">
                  <li v-for="area in list.areas" :key="area.id">
                    <Button
                      type="button"
                      variant="ghost"
                      :data-ski-area-id="area.id"
                      class="h-auto w-full justify-between gap-3 rounded-md px-3 py-2 text-left whitespace-normal"
                      @click="pick(area)"
                    >
                      <span class="flex min-w-0 flex-col items-start gap-0.5">
                        <span class="font-medium">{{ area.name }}</span>
                        <span class="text-xs font-normal text-muted-foreground">{{ placeLine(area, props.lang) }}</span>
                      </span>
                      <span v-if="area.elevation" class="shrink-0 text-xs font-normal text-muted-foreground tabular-nums">{{
                        formatMetres(area.elevation.vertical_m, props.lang)
                      }}</span>
                    </Button>
                  </li>
                </ul>
              </CardContent>
            </template>
          </template>
          <div data-testid="ski-credits" class="flex shrink-0 flex-col gap-1 border-t px-6 py-3 text-xs text-muted-foreground">
            <p>
              <a class="underline underline-offset-2" :href="copy.attributionUrl" target="_blank" rel="noreferrer">{{ copy.attribution }}</a>,
              <a class="underline underline-offset-2" :href="copy.licenceUrl" target="_blank" rel="noreferrer">{{ copy.licence }}</a>.
            </p>
            <p>{{ copy.disclaimer }}</p>
          </div>
        </Card>
      </div>
    </UnmapMap>
  </div>
</template>
