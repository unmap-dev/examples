"use client";

/**
 * <SkiResortExplorer> - every ski area in Canada on the winter style in 3D: a searchable list
 * (name, province, activity) beside the map, and, for the area you pick, its vertical, runs,
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
 * Composes the map item on your shadcn Card, Field, Input, Select, ToggleGroup, Table, Badge,
 * Alert, Button and Spinner. Installed by `npx shadcn add` with its page at
 * app/ski-resort-explorer/page.tsx. Edit freely.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Ski, type SkiArea } from "@unmap/sdk";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Map } from "@/components/ui/map";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useMap, useMapReady } from "@/lib/map-context";

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

export interface SkiResortExplorerProps {
  /** unmap API key with the Ski add-on. The page passes NEXT_PUBLIC_UNMAP_KEY. With none, the block asks for one and loads nothing. */
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
   * page URL. Picks that area once the list holds it; `null` closes it. Omit it and the block keeps
   * its own selection.
   */
  area?: string | null;
  /** Fires with the area's slug, and the area, when the reader picks one; with nulls when they close it. */
  onAreaChange?: (slug: string | null, area: SkiArea | null) => void;
  className?: string;
}

/** What the list holds: the first answer pending, the areas, or a failed search over the last areas. */
type SkiList = { areas: SkiArea[]; pending: boolean; error: unknown };

export function SkiResortExplorer({
  apiKey,
  gateway,
  lang = "en",
  center = CANADA_VIEW.center,
  zoom = CANADA_VIEW.zoom,
  exaggeration,
  lifts3d = false,
  area,
  onAreaChange,
  className,
}: SkiResortExplorerProps) {
  const copy = SKI_COPY[lang];
  const hasKey = apiKey.trim() !== "";
  const ski = useMemo(() => new Ski({ key: apiKey, gateway }), [apiKey, gateway]);
  // The opening camera, kept: after this the reader moves the map, not the props.
  const [opening] = useState(() => ({ center, zoom }));
  const [gate, setGate] = useState<SkiGate>({ state: "checking" });
  const [attempt, setAttempt] = useState(0);
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [province, setProvince] = useState("all");
  const [activity, setActivity] = useState<SkiActivityFilter>("all");
  const [list, setList] = useState<SkiList>({ areas: [], pending: true, error: null });
  const [selected, setSelected] = useState<SkiArea | null>(null);
  const [liftsFailure, setLiftsFailure] = useState<unknown>(null);
  const [liftsAttempt, setLiftsAttempt] = useState(0);
  const [liftPicker, setLiftPickerState] = useState<SkiLiftPicker | null>(null);
  // A picker is a function: wrapped, so setState stores it rather than calling it.
  const setLiftPicker = useCallback((next: SkiLiftPicker | null) => setLiftPickerState(() => next), []);
  const panelRef = useRef<HTMLDivElement | null>(null);
  // Every area listed so far, by id: what an area's slug is kept unique among.
  const knownRef = useRef(new globalThis.Map<string, SkiArea>());
  const listRef = useRef<HTMLUListElement | null>(null);
  const uid = useId();
  const searchId = `${uid}-search`;
  const provinceId = `${uid}-province`;
  const listId = `${uid}-list`;

  // A new key starts over: its add-on answer is its own.
  useEffect(() => {
    setGate({ state: "checking" });
    setSelected(null);
  }, [apiKey, gateway]);

  // The search waits for a pause in typing; the filters apply at once.
  useEffect(() => {
    const timer = setTimeout(() => setQ(text), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  // One /ski/areas per key and per filter set. The first answer is also the add-on gate.
  useEffect(() => {
    if (!hasKey) return;
    const controller = new AbortController();
    setList((current) => ({ ...current, pending: true }));
    ski.areas({ ...areaQuery(q, province, activity), signal: controller.signal }).then(
      ({ data }) => {
        if (controller.signal.aborted) return;
        setGate((current) => (current.state === "granted" ? current : { state: "granted" }));
        setList({ areas: data, pending: false, error: null });
      },
      (caught: unknown) => {
        if (controller.signal.aborted) return;
        setGate((current) => (current.state === "checking" ? gateFrom(caught) : current));
        setList((current) => ({ ...current, pending: false, error: caught ?? new Error("failed") }));
      },
    );
    return () => controller.abort();
  }, [ski, hasKey, q, province, activity, attempt]);

  // Remember every area listed, before the page's area is looked up among them.
  useEffect(() => {
    for (const entry of list.areas) knownRef.current.set(entry.id, entry);
  }, [list.areas]);

  // The page's area, once the list holds it: a shared link, or the page's back button.
  useEffect(() => {
    if (area === undefined) return;
    if (area === null) {
      setSelected(null);
      return;
    }
    const found = findArea(area, list.areas, [...knownRef.current.values()]);
    if (found) setSelected((current) => (current?.id === found.id ? current : found));
  }, [area, list.areas]);

  // A new area, or lifts turned off, clears the last lifts failure.
  useEffect(() => {
    setLiftsFailure(null);
  }, [selected?.id, lifts3d]);

  function pick(next: SkiArea | null) {
    setSelected(next);
    if (next) knownRef.current.set(next.id, next);
    onAreaChange?.(next ? areaSlug(next, [...knownRef.current.values()]) : null, next);
  }

  function retry() {
    setGate({ state: "checking" });
    setAttempt((current) => current + 1);
  }

  function retryLifts() {
    setLiftsFailure(null);
    setLiftsAttempt((current) => current + 1);
  }

  // Arrow keys, Home and End move between rows; Tab leaves the list.
  function onListKey(event: KeyboardEvent<HTMLUListElement>) {
    const rows = [...(listRef.current?.querySelectorAll<HTMLElement>("[data-ski-area-id]") ?? [])];
    const index = rows.indexOf(document.activeElement as HTMLElement);
    const next = nextRow(event.key, index < 0 ? -1 : index, rows.length);
    if (next === null) return;
    event.preventDefault();
    rows[index < 0 && event.key === "ArrowDown" ? 0 : next]?.focus();
  }

  if (!hasKey) {
    // Where the map would be: the block's gutter, the Alert at a readable width, the first action first.
    return (
      <div
        data-unmap-block="ski-resort-explorer"
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
  if (gate.state === "checking") {
    // Where the map will be: the answer is one request away, so a quiet line, not a skeleton of a map.
    return (
      <div
        data-unmap-block="ski-resort-explorer"
        data-state="checking"
        className={["flex h-full min-h-[480px] items-center justify-center gap-2 bg-muted/40 p-4 sm:p-6", className].filter(Boolean).join(" ")}
      >
        <Spinner className="size-4 text-muted-foreground" />
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {copy.checking}
        </p>
      </div>
    );
  }

  const granted = gate.state === "granted";
  const said = selected ? `${selected.name}. ${placeLine(selected, lang)}` : list.pending ? "" : copy.count(list.areas.length);
  const aspect = selected ? aspectReadout(selected.aspect, lang) : null;

  const figures = selected ? areaFigures(selected, lang) : null;
  const websites = selected ? safeWebsites(selected.websites) : [];
  const largestShare = aspect ? Math.max(...ASPECTS.map((direction) => selected?.aspect[direction] ?? 0)) : 0;

  return (
    <div data-unmap-block="ski-resort-explorer" className={["relative h-full min-h-[480px]", className].filter(Boolean).join(" ")}>
      <Map
        id={SKI_MAP_ID}
        apiKey={apiKey}
        gateway={gateway}
        lang={lang}
        style="winter"
        terrain
        {...(exaggeration != null ? { exaggeration } : {})}
        {...(granted ? { overlays: ["ski"] } : {})}
        maplibre={skiMapOptions(lifts3d)}
        center={opening.center}
        zoom={opening.zoom}
        className="h-full"
      >
        <FlyToArea area={selected} panelRef={panelRef} />
        {lifts3d && granted && selected ? (
          <Lifts3d key={liftsAttempt} areaId={selected.id} apiKey={apiKey} gateway={gateway} onError={setLiftsFailure} onPicker={setLiftPicker} />
        ) : null}
        {granted ? (
          <SkiFeaturePopup
            lang={lang}
            liftPicker={lifts3d ? liftPicker : null}
            areaKey={selected?.id ?? ""}
            onArea={(id) => {
              const found = list.areas.find((entry) => entry.id === id);
              if (found) pick(found);
            }}
          />
        ) : null}
        {granted ? <SkiLegend lang={lang} lifts3d={lifts3d} /> : null}
        <p data-testid="ski-announce" aria-live="polite" className="sr-only">
          {said}
        </p>
        {/* A card floating on the map at 24 px; below `sm`, a sheet across the bottom (at most half the map) that clears the attribution. */}
        <div
          ref={panelRef}
          className="absolute inset-x-4 bottom-10 z-10 flex max-h-[50%] flex-col sm:inset-x-auto sm:top-6 sm:bottom-auto sm:left-6 sm:max-h-[calc(100%-3rem)] sm:w-[23rem] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-300 sm:motion-safe:slide-in-from-bottom-0 sm:motion-safe:slide-in-from-left-4"
        >
          <Card className="flex min-h-0 flex-1 flex-col gap-0 py-0">
            {granted && selected && aspect && figures ? (
              <section
                key={selected.id}
                aria-label={copy.selected}
                data-testid="ski-area"
                className="flex min-h-0 flex-1 flex-col motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
              >
                <CardHeader className="gap-3 border-b pt-4 pb-4">
                  <Button type="button" variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground" onClick={() => pick(null)}>
                    <span aria-hidden="true">‹</span>
                    {copy.back}
                  </Button>
                  <div className="flex min-w-0 flex-col gap-1">
                    <h3 className="text-xl leading-tight font-semibold text-balance">{selected.name}</h3>
                    <p className="text-sm text-muted-foreground">{placeLine(selected, lang) || copy.noPlace}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.activities.map((name) => (
                      <Badge key={name} variant="secondary">
                        {copy.activities[name]}
                      </Badge>
                    ))}
                    {selected.status && selected.status !== "operating" ? <Badge variant="outline">{selected.status}</Badge> : null}
                  </div>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain py-4">
                  {lifts3d && liftsFailure ? (
                    <Alert variant="destructive" role="alert" data-unmap-lifts-error="">
                      <AlertDescription className="flex flex-col items-start gap-2">
                        <span>{liftsError(liftsFailure, lang)}</span>
                        <Button type="button" variant="outline" size="sm" onClick={retryLifts}>
                          {copy.retry}
                        </Button>
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  <dl className="grid grid-cols-3 gap-2">
                    {figures.tiles.map(([label, value]) => (
                      <div key={label} className="flex flex-col gap-0.5 rounded-lg bg-muted/60 px-3 py-2.5">
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="text-lg leading-tight font-semibold tabular-nums">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                    {figures.rows.map(([label, value]) => (
                      <div key={label} className="contents">
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="text-right font-medium tabular-nums">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium">{copy.aspect}</p>
                    <Table aria-describedby={`${uid}-aspect`} className="table-fixed">
                      <TableHeader>
                        <TableRow className="border-0 hover:bg-transparent">
                          {aspect.cells.map((cell) => (
                            <TableHead key={cell.direction} scope="col" className="h-auto px-0 pb-1 text-center align-bottom">
                              <span aria-hidden="true" className="flex h-8 items-end justify-center">
                                <span
                                  data-dominant={cell.dominant ? "true" : undefined}
                                  className={`block w-3 rounded-sm bg-muted-foreground/35 data-[dominant=true]:bg-primary ${barHeight(selected.aspect[cell.direction] ?? 0, largestShare)}`}
                                />
                              </span>
                              <abbr title={copy.directionNames[cell.direction]} className="mt-1 block text-xs font-medium no-underline">
                                {cell.label}
                              </abbr>
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow className="border-0 hover:bg-transparent">
                          {aspect.cells.map((cell) => (
                            <TableCell
                              key={cell.direction}
                              data-dominant={cell.dominant ? "true" : undefined}
                              className="px-0 py-0.5 text-center text-xs text-muted-foreground tabular-nums data-[dominant=true]:font-semibold data-[dominant=true]:text-foreground"
                            >
                              {cell.share}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableBody>
                    </Table>
                    <p id={`${uid}-aspect`} className="text-xs text-muted-foreground">
                      {aspect.summary} {copy.aspectCaption}
                    </p>
                  </div>
                  {websites.length > 0 ? (
                    <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                      <span className="text-muted-foreground">{copy.websites}</span>
                      {websites.map((url) => (
                        <a key={url} className="font-medium text-primary underline underline-offset-4" href={url} target="_blank" rel="noreferrer">
                          {siteLabel(url)}
                        </a>
                      ))}
                    </p>
                  ) : null}
                </CardContent>
              </section>
            ) : (
              <>
                <CardHeader className="gap-1 pt-4 pb-3">
                  <CardTitle role="heading" aria-level={2}>
                    {copy.title}
                  </CardTitle>
                  <CardDescription className="max-sm:hidden">{copy.summary}</CardDescription>
                </CardHeader>
                {gate.state === "denied" || gate.state === "unknown" ? (
                  <CardContent className="pb-4">
                    <Alert data-unmap-addon-gate={gate.state === "denied" ? gate.code : "unknown"}>
                      <AlertTitle className="line-clamp-none">{gate.state === "denied" ? copy.deniedTitle[gate.code] : copy.unknownTitle}</AlertTitle>
                      <AlertDescription className="flex flex-col items-start gap-2">
                        <p>{gate.state === "denied" ? copy.deniedBody[gate.code] : copy.unknownBody(gate.status)}</p>
                        {gate.state === "denied" ? (
                          <a className="font-medium text-primary underline underline-offset-4" href={copy.pricingUrl} target="_blank" rel="noreferrer">
                            {copy.pricing}
                          </a>
                        ) : (
                          <Button type="button" variant="outline" size="sm" onClick={retry}>
                            {copy.retry}
                          </Button>
                        )}
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                ) : null}
                {granted ? (
                  <>
                    <div data-testid="ski-tools" className="flex shrink-0 flex-col gap-3 border-b px-6 pb-4">
                      <Field>
                        <FieldLabel htmlFor={searchId} className="sr-only">
                          {copy.search}
                        </FieldLabel>
                        <Input
                          id={searchId}
                          type="search"
                          autoComplete="off"
                          placeholder={copy.searchPlaceholder}
                          value={text}
                          aria-controls={listId}
                          onChange={(event) => setText(event.target.value)}
                        />
                      </Field>
                      <div className="flex flex-wrap items-center gap-2">
                        <Field className="min-w-0 flex-1">
                          <FieldLabel htmlFor={provinceId} className="sr-only">
                            {copy.province}
                          </FieldLabel>
                          <Select
                            items={[
                              { value: "all", label: copy.allProvinces },
                              ...PROVINCES.map((code) => ({ value: code, label: copy.provinceNames[code] ?? code })),
                            ]}
                            value={province}
                            onValueChange={(next: unknown) => setProvince(typeof next === "string" && next ? next : "all")}
                          >
                            <SelectTrigger id={provinceId} size="sm" className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">{copy.allProvinces}</SelectItem>
                              {PROVINCES.map((code) => (
                                <SelectItem key={code} value={code}>
                                  {copy.provinceNames[code] ?? code}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <ToggleGroup
                          variant="outline"
                          size="sm"
                          aria-label={copy.activity}
                          value={[activity]}
                          // Pressing the pressed item empties the group; the filter keeps its value.
                          onValueChange={(next: unknown[]) => {
                            const value = next[0];
                            if (value === "all" || value === "downhill" || value === "nordic") setActivity(value);
                          }}
                        >
                          {(["all", "downhill", "nordic"] as const).map((value) => (
                            <ToggleGroupItem key={value} value={value} className="px-2.5 aria-pressed:font-semibold">
                              {copy.activities[value]}
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                      </div>
                    </div>
                    <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain py-3">
                      <p data-testid="ski-count" className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        {list.pending ? <Spinner className="size-3.5" /> : null}
                        {list.pending ? copy.loading : copy.count(list.areas.length)}
                      </p>
                      {list.error ? (
                        <Alert variant="destructive" role="alert">
                          <AlertDescription className="flex flex-col items-start gap-2">
                            <span>{requestError(list.error, lang)}</span>
                            <Button type="button" variant="outline" size="sm" onClick={() => setAttempt((current) => current + 1)}>
                              {copy.retry}
                            </Button>
                          </AlertDescription>
                        </Alert>
                      ) : null}
                      {!list.pending && !list.error && list.areas.length === 0 ? <p className="text-sm">{copy.empty}</p> : null}
                      <ul ref={listRef} id={listId} aria-label={copy.list} className="-mx-3 flex flex-col" onKeyDown={onListKey}>
                        {list.areas.map((area) => (
                          <li key={area.id}>
                            <Button
                              type="button"
                              variant="ghost"
                              data-ski-area-id={area.id}
                              className="h-auto w-full justify-between gap-3 rounded-md px-3 py-2 text-left whitespace-normal"
                              onClick={() => pick(area)}
                            >
                              <span className="flex min-w-0 flex-col items-start gap-0.5">
                                <span className="font-medium">{area.name}</span>
                                <span className="text-xs font-normal text-muted-foreground">{placeLine(area, lang)}</span>
                              </span>
                              {area.elevation ? (
                                <span className="shrink-0 text-xs font-normal text-muted-foreground tabular-nums">
                                  {formatMetres(area.elevation.vertical_m, lang)}
                                </span>
                              ) : null}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </>
                ) : null}
              </>
            )}
            <div data-testid="ski-credits" className="flex shrink-0 flex-col gap-1 border-t px-6 py-3 text-xs text-muted-foreground">
              <p>
                <a className="underline underline-offset-2" href={copy.attributionUrl} target="_blank" rel="noreferrer">
                  {copy.attribution}
                </a>
                ,{" "}
                <a className="underline underline-offset-2" href={copy.licenceUrl} target="_blank" rel="noreferrer">
                  {copy.licence}
                </a>
                .
              </p>
              <p>{copy.disclaimer}</p>
            </div>
          </Card>
        </div>
      </Map>
    </div>
  );
}

/** Flies to the picked area. It renders inside <Map>, where useMap() can see the map. */
function FlyToArea({ area, panelRef }: { area: SkiArea | null; panelRef: RefObject<HTMLDivElement | null> }) {
  const map = useMap(SKI_MAP_ID);
  useEffect(() => {
    if (!map || !area) return;
    flyToArea(map as unknown as SkiCameraMap, area, panelRef.current?.getBoundingClientRect() ?? null);
  }, [map, area, panelRef]);
  return null;
}

/** The picked area's lifts in 3D, while it renders: one overlay, taken off when it unmounts. */
function Lifts3d({
  areaId,
  apiKey,
  gateway,
  onError,
  onPicker,
}: {
  areaId: string;
  apiKey: string;
  gateway?: string;
  onError: (caught: unknown) => void;
  onPicker: (pick: SkiLiftPicker | null) => void;
}) {
  const map = useMap(SKI_MAP_ID);
  // Ready once the style has loaded: the terrain, and its exaggeration, are on the map. A style
  // swap (a new exaggeration, light or dark) clears it, so the cables are drawn again on the new one.
  const ready = useMapReady(SKI_MAP_ID);
  useEffect(() => {
    if (!map || !ready) return;
    return showLifts3d(map as unknown as SkiLiftsMap, { key: apiKey, areaId, gateway, onError, onPicker });
  }, [map, ready, areaId, apiKey, gateway, onError, onPicker]);
  return null;
}

/** The part of a MapLibre map the popup reads. */
interface SkiPopupMap {
  getLayer(id: string): unknown;
  queryRenderedFeatures(geometry: [[number, number], [number, number]], options: { layers: string[] }): Array<{ layer?: { id?: string }; properties?: Record<string, unknown> }>;
  project(lngLat: [number, number]): { x: number; y: number };
  getCanvas(): { style: { cursor: string } };
  on(type: string, listener: (event: { point: { x: number; y: number }; lngLat: { lng: number; lat: number } }) => void): unknown;
  off(type: string, listener: (event: { point: { x: number; y: number }; lngLat: { lng: number; lat: number } }) => void): unknown;
}

/** How near, in pixels, the pointer must be to a run or a lift to open it. */
const HIT = 5;

/** What is under a point: a 3D lift first, then a 2D lift, a run, or an area's label. */
function featureAt(map: SkiPopupMap, point: { x: number; y: number }, liftPicker: SkiLiftPicker | null): SkiFeature | { kind: "area"; id: string } | null {
  const lift = liftPicker?.(point.x, point.y);
  if (lift) return liftFeature(lift);
  const layers = [SKI_LAYERS.lifts, SKI_LAYERS.downhill, SKI_LAYERS.nordic, SKI_LAYERS.labels].filter((id) => map.getLayer(id));
  if (layers.length === 0) return null;
  const hits = map.queryRenderedFeatures(
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

/**
 * Hover a run or a lift for its name, kind and numbers, in a card that follows the pointer; on a
 * touch screen, with no hover, a tap opens it and a tap elsewhere closes it. Clicking an area's
 * name on the map picks that area. It reads what the map already drew, so it makes no request.
 */
function SkiFeaturePopup({
  lang,
  liftPicker,
  areaKey,
  onArea,
}: {
  lang: SkiLang;
  liftPicker: SkiLiftPicker | null;
  areaKey: string;
  onArea: (id: string) => void;
}) {
  const map = useMap(SKI_MAP_ID) as unknown as SkiPopupMap | null;
  const [open, setOpen] = useState<{ feature: SkiFeature; key: string } | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const atRef = useRef<[number, number] | null>(null);
  const pickerRef = useRef(liftPicker);
  const areaRef = useRef(onArea);
  pickerRef.current = liftPicker;
  areaRef.current = onArea;

  // Pins the card above its point; hidden while the point is off the map.
  const place = useCallback(() => {
    const card = cardRef.current;
    const at = atRef.current;
    if (!card || !at || !map) return;
    const { x, y } = map.project(at);
    const parent = card.parentElement?.getBoundingClientRect();
    const inside = parent && parent.width > 0 ? x >= 0 && y >= 0 && x <= parent.width && y <= parent.height : true;
    card.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, calc(-100% - 14px))`;
    card.style.visibility = inside ? "visible" : "hidden";
  }, [map]);

  useEffect(() => {
    if (!map || typeof map.on !== "function") return;
    let frame = 0;
    const show = (event: { point: { x: number; y: number }; lngLat: { lng: number; lat: number } }, found: SkiFeature | { kind: "area"; id: string } | null) => {
      if (!found || found.kind === "area") {
        atRef.current = null;
        setOpen(null);
        return;
      }
      atRef.current = [event.lngLat.lng, event.lngLat.lat];
      const key = featureKey(found);
      setOpen((current) => (current?.key === key ? current : { feature: found, key }));
      place();
    };
    const onClick = (event: { point: { x: number; y: number }; lngLat: { lng: number; lat: number } }) => {
      const found = featureAt(map, event.point, pickerRef.current);
      if (found && found.kind === "area") {
        show(event, null);
        areaRef.current(found.id);
        return;
      }
      show(event, found);
    };
    const onMove = (event: { point: { x: number; y: number }; lngLat: { lng: number; lat: number } }) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const found = featureAt(map, event.point, pickerRef.current);
        map.getCanvas().style.cursor = found ? "pointer" : "";
        show(event, found);
      });
    };
    const onOut = () => {
      cancelAnimationFrame(frame);
      atRef.current = null;
      setOpen(null);
    };
    map.on("click", onClick);
    map.on("mousemove", onMove);
    map.on("mouseout", onOut);
    return () => {
      cancelAnimationFrame(frame);
      map.off("click", onClick);
      map.off("mousemove", onMove);
      map.off("mouseout", onOut);
      map.getCanvas().style.cursor = "";
    };
  }, [map, place]);

  // A new area, or lifts drawn another way, closes the card.
  useEffect(() => setOpen(null), [areaKey, liftPicker]);

  // Place the card as it opens, and keep it on its point as the camera moves.
  useEffect(() => {
    if (!map || !open) return;
    place();
    map.on("move", place as never);
    return () => {
      map.off("move", place as never);
    };
  }, [map, open, place]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;
  const details = featureDetails(open.feature, lang);
  const symbol = open.feature.kind === "run" && open.feature.pisteType !== "nordic" ? difficultyKey(open.feature.difficulty) : null;
  return (
    <div
      ref={cardRef}
      role="tooltip"
      aria-label={details.title}
      data-testid="ski-feature"
      className="pointer-events-none absolute top-0 left-0 z-20 w-60 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm leading-tight font-semibold">{details.title}</p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {symbol && symbol !== "unrated" ? <DifficultySymbol kind={symbol} /> : null}
          {details.kind}
        </p>
      </div>
      {details.rows.length > 0 ? (
        <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 border-t pt-2 text-xs">
          {details.rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right font-medium tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/** The trail-map symbol for a difficulty, in the colour the map draws it (or the text colour). */
function DifficultySymbol({ kind, color }: { kind: "easy" | "intermediate" | "advanced" | "expert" | "park"; color?: string | null }) {
  const paint = color ?? "currentColor";
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5 shrink-0">
      {kind === "easy" ? <circle cx="8" cy="8" r="6" fill={paint} /> : null}
      {kind === "intermediate" ? <rect x="2.5" y="2.5" width="11" height="11" fill={paint} /> : null}
      {kind === "advanced" ? <path d="M8 1.5 14.5 8 8 14.5 1.5 8Z" fill={paint} /> : null}
      {kind === "expert" ? <path d="M4.5 3 8.5 8 4.5 13 0.5 8ZM11.5 3 15.5 8 11.5 13 7.5 8Z" fill={paint} /> : null}
      {kind === "park" ? <rect x="1" y="5.5" width="14" height="5" rx="2.5" fill={paint} /> : null}
    </svg>
  );
}

/** The part of a MapLibre map the legend reads. */
interface SkiLegendMap {
  getLayer(id: string): unknown;
  getPaintProperty(id: string, name: string): unknown;
  getZoom(): number;
  on(type: string, listener: () => void): unknown;
  off(type: string, listener: () => void): unknown;
}

/** The zoom the runs and lifts appear at (overlays.ts), and so the legend with them. */
const RUNS_MINZOOM = 11;

/**
 * What the run colours, the trail symbols and the lines mean, in the colours the style draws them.
 * Shown from the zoom the runs appear at; open by default on a wide screen, folded on a phone.
 */
function SkiLegend({ lang, lifts3d }: { lang: SkiLang; lifts3d: boolean }) {
  const map = useMap(SKI_MAP_ID) as unknown as SkiLegendMap | null;
  const copy = SKI_COPY[lang];
  const [state, setState] = useState<{ shown: boolean; colors: Record<SkiLegendKey, string | null>; core: string | null } | null>(null);
  const [wide] = useState(() => typeof window === "undefined" || window.matchMedia?.("(min-width: 640px)")?.matches !== false);

  useEffect(() => {
    if (!map || typeof map.on !== "function") return;
    const read = () => {
      const paint = (id: string) => (map.getLayer(id) ? map.getPaintProperty(id, "line-color") : undefined);
      setState({
        shown: map.getZoom() >= RUNS_MINZOOM - 0.5,
        colors: legendColors({ downhill: paint(SKI_LAYERS.downhill), nordic: paint(SKI_LAYERS.nordic), lifts: paint(SKI_LAYERS.lifts) }),
        core: ((core) => (typeof core === "string" ? core : null))(paint(SKI_LAYERS.expertCore)),
      });
    };
    read();
    map.on("zoomend", read);
    map.on("styledata", read);
    return () => {
      map.off("zoomend", read);
      map.off("styledata", read);
    };
  }, [map]);

  if (!state?.shown) return null;
  const { colors, core } = state;
  const sample = (key: SkiLegendKey, kind: "solid" | "double" | "dashed" | "lift" = "solid") => (
    <svg aria-hidden="true" viewBox="0 0 24 10" className="h-2.5 w-6 shrink-0">
      {kind === "lift" ? <line x1="1" y1="5" x2="23" y2="5" stroke="var(--popover)" strokeWidth={4.5} strokeLinecap="round" /> : null}
      <line x1="1" y1="5" x2="23" y2="5" stroke={colors[key] ?? "currentColor"} strokeWidth={kind === "double" ? 5 : 2.5} strokeLinecap="round" strokeDasharray={kind === "dashed" ? "3 2.5" : undefined} />
      {kind === "double" ? <line x1="1" y1="5" x2="23" y2="5" stroke={core ?? "var(--popover)"} strokeWidth={1.6} strokeLinecap="round" /> : null}
      {kind === "lift" ? <path d="M6 1.5v7M12 1.5v7M18 1.5v7" stroke={colors[key] ?? "currentColor"} strokeWidth={1.4} /> : null}
    </svg>
  );
  return (
    <details
      open={wide}
      data-testid="ski-legend"
      className="group absolute top-3 left-3 z-10 rounded-lg border bg-popover/95 text-popover-foreground shadow-md backdrop-blur sm:top-auto sm:right-3 sm:bottom-10 sm:left-auto"
    >
      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold select-none [&::-webkit-details-marker]:hidden">
        {copy.legend}
      </summary>
      <ul className="flex flex-col gap-1.5 px-3 pb-3 text-xs">
        {(["easy", "intermediate", "advanced", "expert"] as const).map((key) => (
          <li key={key} className="flex items-center gap-2">
            <span className="flex w-4 justify-center">
              <DifficultySymbol kind={key} color={colors[key]} />
            </span>
            {sample(key, key === "expert" ? "double" : "solid")}
            {copy.legendKeys[key]}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span className="w-4" />
          {sample("park")}
          {copy.legendKeys.park}
        </li>
        <li className="flex items-center gap-2">
          <span className="w-4" />
          {sample("nordic", "dashed")}
          {copy.legendKeys.nordic}
        </li>
        <li className="flex items-center gap-2">
          <span className="w-4" />
          {sample("lift", "lift")}
          {lifts3d ? copy.legendKeys.lift3d : copy.legendKeys.lift}
        </li>
      </ul>
    </details>
  );
}
