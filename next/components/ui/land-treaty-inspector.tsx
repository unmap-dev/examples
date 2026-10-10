"use client";

/**
 * <LandTreatyInspector> - click anywhere, or search a legal land description, and get one answer
 * card for that point: the survey cell (hatched on the map) and the treaty records the Crown has
 * published for it (dotted on the map). A full-bleed map with a floating panel, a bottom sheet on
 * a phone. Every survey unit at the point is listed under the answer; pick one to hatch it instead.
 *
 * Legal land (the `survey.dls` and `survey.nts` overlays, legal land search and survey identify)
 * needs an add-on with legal land: Legal Land, or Energy or Agriculture, which include it. The
 * block asks the gateway once whether your key holds one and composes the gated parts only if it
 * does: a refused overlay would make the whole style request fail. Without it the panel says why,
 * links the pricing page, and keeps the treaty context, which is on every plan, with a
 * municipality lookup in place of the survey cell.
 *
 * Metering: every authenticated request is one call. The block makes the add-on probe (one
 * `GET /layers/survey.dls/22/0/0`, in the Legal Land bucket), then the map's own style and tile
 * requests. Each map click or chosen search result makes one `GET /identify` and one
 * `GET /geocode/reverse` with `include=treaties` (the treaty panel's lookup; a coordinate typed
 * into the panel makes the same two). The search box makes one `GET /geocode/autocomplete` per
 * pause in typing.
 *
 * Treaty context is the Crown's published representation of historic and modern treaties (CIRNAC,
 * Open Government Licence - Canada), not a map of Indigenous nations or a determination of rights;
 * the treaty panel says so in its own words. Composes the map, legal-land-search and
 * treaty-context items on your shadcn Card, Alert, Button and Spinner. Installed by
 * `npx shadcn add` with its page at app/land-treaty-inspector/page.tsx. Edit freely.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Geocoder as GeocoderClient, type GeocodeResult, type TreatySelection } from "@unmap/geocoding";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LegalLandSearch } from "@/components/ui/legal-land-search";
import { Map } from "@/components/ui/map";
import { Spinner } from "@/components/ui/spinner";
import { TreatyContext } from "@/components/ui/treaty-context";
import { useMap, useMapGeneration, useMapReady } from "@/lib/map-context";
import { HELPER_KEY, accentColor, tokenColor } from "@/lib/map-layers";

// --- land-treaty-inspector helpers (kept identical across both lanes) ---
export type LandLang = "en" | "fr";

/** The block's own map id, so a map elsewhere on the page never answers for it. */
export const LAND_MAP_ID = "land-treaty-inspector";

/** Where a reader gets an unmap key: the no-key state's first action. */
export const KEY_URL = "https://unmap.dev/dashboard";

export const LAND_COPY = {
  en: {
    title: "Legal land and treaties",
    intro: "Click anywhere for the survey cell and the treaty records at that point, or search a legal land description.",
    introTouch: "Tap anywhere for the survey cell and the treaty records at that point, or search a legal land description.",
    introDenied: "Click anywhere for the municipality and the treaty records at that point.",
    introDeniedTouch: "Tap anywhere for the municipality and the treaty records at that point.",
    checking: "Checking this key's add-ons...",
    search: "Search legal land",
    searchHint: "A quarter, section or LSD, like NW-25-24-1-W5.",
    empty: "Click anywhere on the map.",
    emptyTouch: "Tap anywhere on the map.",
    emptyHint: "The answer for that point lands here.",
    legend: "On the map",
    legendCell: "Survey cell",
    legendTreaty: "Treaty records",
    loading: "Looking up this point...",
    treatyLoading: "Checking treaty records...",
    units: {
      lsd: "Legal subdivision",
      qtr: "Quarter section",
      sec: "Section",
      twp: "Township",
    } as Record<string, string>,
    provinces: { AB: "Alberta", SK: "Saskatchewan", MB: "Manitoba", BC: "British Columbia" } as Record<string, string>,
    cells: "Survey cells at this point",
    cellsHint: "Pick one to hatch it on the map.",
    separator: ": ",
    noCell: "No survey cell here",
    noCellHint: "This map hatches Dominion Land Survey cells on the Prairies and NTS cells in British Columbia.",
    municipalityLabel: "Municipality",
    municipality: (name: string) => `Municipality: ${name}`,
    noMunicipality: "Not inside a municipality",
    noMunicipalityHint: "The lookup covers incorporated places.",
    treatyNone: "No treaty record in this dataset",
    /** The contract's own words for a point with no record (docs/indigenous-context/contract.md, "Interface copy"). */
    treatyNoneHint: "This does not determine Indigenous rights or whether land is unceded.",
    treatyUnavailable: "Treaty context is unavailable",
    treatyUnavailableHint: "Try the point again in a moment.",
    categories: { historic: "Historic treaty", modern: "Modern treaty" } as Record<string, string>,
    more: (count: number) => `and ${count} more`,
    hiddenOnMap: "hidden on map",
    sayTreaty: (name: string, caption: string) => `${name}, ${caption.charAt(0).toLowerCase()}${caption.slice(1)}.`,
    sayCell: (unit: string, name: string, province: string) => `${unit} ${name}${province ? `, ${province}` : ""}.`,
    sayNoCell: "No survey cell at this point.",
    sayNoMunicipality: "Not inside a municipality.",
    keyRefused: "The gateway refused this key. Check the key and its add-ons, then try again.",
    busy: "Too many requests. Try again in a moment.",
    outside: "That point is outside Canada. Legal land and treaty context cover Canada.",
    unavailable: "The service didn't answer. Try again in a moment.",
    failed: "The lookup failed. Try again.",
    retry: "Try again",
    deniedTitle: {
      addon_required: "Legal land needs the Legal Land add-on",
      dev_only: "Legal land is free for development only",
      usage_limit_reached: "This month's development allowance is used",
    },
    deniedBody: {
      addon_required:
        "This key holds no add-on with legal land (Legal Land, or Energy or Agriculture, which include it), so survey cells and legal land search are off. Treaty context is part of every plan: pick a point on the map to look it up.",
      dev_only:
        "On the dev plan, legal land works from localhost and preview origins. From this origin it needs a paid plan with an add-on that includes it: Legal Land, Energy or Agriculture. Treaty context still works: pick a point on the map.",
      usage_limit_reached:
        "The dev plan's premium calls for this month are used. Legal land comes back next month, or now with a paid plan. Treaty context still works: pick a point on the map.",
    },
    unknownTitle: "Could not check the Legal Land add-on",
    unknownBody: (status: number) =>
      status === 401
        ? "The gateway refused this key. Check the key and its allowed origins."
        : `The gateway answered ${status === 0 ? "nothing (a network error)" : `HTTP ${status}`}, so survey cells and legal land search are off. Treaty context still works: pick a point on the map.`,
    pricing: "Plans and add-ons",
    pricingUrl: "https://unmap.dev/pricing",
    surveyCredit:
      "Survey grids: Alberta, Saskatchewan, Manitoba and British Columbia open data, and Natural Resources Canada, under open data licences.",
    fold: "Hide details",
    unfold: "Show details",
    noKeyTitle: "Add your unmap key to load the map.",
    getKey: "Get a key",
    noKey:
      'No unmap key. Pass apiKey. On Next.js, set NEXT_PUBLIC_UNMAP_KEY in .env.local. On Nuxt, set NUXT_PUBLIC_UNMAP_KEY in .env. If you installed with unmap add, nuxt.config already declares runtimeConfig: { public: { unmapKey: "" } }; otherwise add it there. Then restart the dev server.',
  },
  fr: {
    title: "Terres légales et traités",
    intro: "Cliquez n'importe où pour la cellule d'arpentage et les traités à ce point, ou cherchez une description légale.",
    introTouch: "Touchez n'importe où pour la cellule d'arpentage et les traités à ce point, ou cherchez une description légale.",
    introDenied: "Cliquez n'importe où pour la municipalité et les traités à ce point.",
    introDeniedTouch: "Touchez n'importe où pour la municipalité et les traités à ce point.",
    checking: "Vérification des modules complémentaires de cette clé...",
    search: "Chercher une terre légale",
    searchHint: "Un quart, une section ou une subdivision légale, par exemple NW-25-24-1-W5.",
    empty: "Cliquez n'importe où sur la carte.",
    emptyTouch: "Touchez n'importe où sur la carte.",
    emptyHint: "La réponse pour ce point s'affiche ici.",
    legend: "Sur la carte",
    legendCell: "Cellule d'arpentage",
    legendTreaty: "Traités",
    loading: "Recherche de ce point...",
    treatyLoading: "Recherche des traités...",
    units: {
      lsd: "Subdivision légale",
      qtr: "Quart de section",
      sec: "Section",
      twp: "Canton",
    } as Record<string, string>,
    provinces: { AB: "Alberta", SK: "Saskatchewan", MB: "Manitoba", BC: "Colombie-Britannique" } as Record<string, string>,
    cells: "Cellules d'arpentage à ce point",
    cellsHint: "Choisissez-en une pour la hachurer sur la carte.",
    separator: "\u00a0: ",
    noCell: "Aucune cellule d'arpentage ici",
    noCellHint: "Cette carte hachure les cellules de l'arpentage fédéral des Prairies et du SNRC en Colombie-Britannique.",
    municipalityLabel: "Municipalité",
    municipality: (name: string) => `Municipalité\u00a0: ${name}`,
    noMunicipality: "Hors d'une municipalité",
    noMunicipalityHint: "La recherche couvre les lieux constitués.",
    treatyNone: "Aucun traité dans ce jeu de données",
    treatyNoneHint: "Ce résultat ne détermine ni les droits autochtones ni si le territoire est non cédé.",
    treatyUnavailable: "Le contexte des traités est indisponible",
    treatyUnavailableHint: "Réessayez ce point dans un instant.",
    categories: { historic: "Traité historique", modern: "Traité moderne" } as Record<string, string>,
    more: (count: number) => `et ${count} de plus`,
    hiddenOnMap: "masqué sur la carte",
    sayTreaty: (name: string, caption: string) => `${name}, ${caption.charAt(0).toLowerCase()}${caption.slice(1)}.`,
    sayCell: (unit: string, name: string, province: string) => `${unit} ${name}${province ? `, ${province}` : ""}.`,
    sayNoCell: "Aucune cellule d'arpentage à ce point.",
    sayNoMunicipality: "Hors d'une municipalité.",
    keyRefused: "La passerelle a refusé cette clé. Vérifiez la clé et ses modules complémentaires, puis réessayez.",
    busy: "Trop de requêtes. Réessayez dans un instant.",
    outside: "Ce point est hors du Canada. Les terres légales et le contexte des traités couvrent le Canada.",
    unavailable: "Le service n'a pas répondu. Réessayez dans un instant.",
    failed: "La recherche a échoué. Réessayez.",
    retry: "Réessayer",
    deniedTitle: {
      addon_required: "Les terres légales nécessitent le module complémentaire Terres légales",
      dev_only: "Les terres légales sont gratuites en développement seulement",
      usage_limit_reached: "L'allocation de développement de ce mois est épuisée",
    },
    deniedBody: {
      addon_required:
        "Cette clé n'a aucun module qui comprend les terres légales (Terres légales, ou Énergie ou Agriculture, qui les comprennent)\u00a0: les cellules d'arpentage et la recherche de terres légales sont désactivées. Le contexte des traités fait partie de chaque forfait\u00a0: choisissez un point sur la carte pour le consulter.",
      dev_only:
        "Avec le forfait de développement, les terres légales fonctionnent depuis localhost et les origines de prévisualisation. Depuis cette origine, il faut un forfait payant avec un module qui les comprend\u00a0: Terres légales, Énergie ou Agriculture. Le contexte des traités fonctionne toujours\u00a0: choisissez un point sur la carte.",
      usage_limit_reached:
        "Les appels premium du forfait de développement sont épuisés pour ce mois. Les terres légales reviennent le mois prochain, ou dès maintenant avec un forfait payant. Le contexte des traités fonctionne toujours\u00a0: choisissez un point sur la carte.",
    },
    unknownTitle: "Impossible de vérifier le module complémentaire Terres légales",
    unknownBody: (status: number) =>
      status === 401
        ? "La passerelle a refusé cette clé. Vérifiez la clé et ses origines autorisées."
        : `La passerelle a répondu ${status === 0 ? "rien (une erreur réseau)" : `HTTP ${status}`}\u00a0: les cellules d'arpentage et la recherche de terres légales sont désactivées. Le contexte des traités fonctionne toujours\u00a0: choisissez un point sur la carte.`,
    pricing: "Forfaits et modules complémentaires",
    pricingUrl: "https://unmap.dev/fr/pricing",
    surveyCredit:
      "Grilles d'arpentage\u00a0: données ouvertes de l'Alberta, de la Saskatchewan, du Manitoba et de la Colombie-Britannique, et Ressources naturelles Canada, sous licences de données ouvertes.",
    fold: "Masquer les détails",
    unfold: "Afficher les détails",
    noKeyTitle: "Ajoutez votre clé unmap pour charger la carte.",
    getKey: "Obtenir une clé",
    noKey:
      'Aucune clé unmap. Passez apiKey. Avec Next.js, définissez NEXT_PUBLIC_UNMAP_KEY dans .env.local. Avec Nuxt, définissez NUXT_PUBLIC_UNMAP_KEY dans .env. Si vous avez installé le bloc avec unmap add, nuxt.config déclare déjà runtimeConfig: { public: { unmapKey: "" } } ; sinon, ajoutez-le. Redémarrez ensuite le serveur de développement.',
  },
};

/** Whether this key may read an add-on layer, as the gateway answered. */
export type AddonGate =
  | { state: "checking" }
  | { state: "granted" }
  | {
      state: "denied";
      /** `addon_required`: buy the add-on. `dev_only`: free from localhost only. `usage_limit_reached`: the dev plan's month is spent. */
      code: "addon_required" | "dev_only" | "usage_limit_reached";
      /** The SKU that unlocks it, e.g. `addon-legal-land`. */
      addon: string;
      /** The gateway's own explanation, in English. */
      message: string;
    }
  | { state: "unknown"; status: number };

/**
 * Ask the gateway whether `apiKey` may read the catalog layer `layer`. One request, metered like
 * any other: a tile at zoom 22, past every archive, which the gateway answers 204 once the add-on
 * check has passed and 403 with a reason when it has not. Nothing is drawn from it. A network
 * failure or any other status is `unknown`; an aborted probe rejects with the AbortError.
 */
export async function probeAddon(
  apiKey: string,
  layer: string,
  gateway = "https://api.unmap.dev",
  signal?: AbortSignal,
): Promise<AddonGate> {
  const url = `${gateway.replace(/\/+$/, "")}/layers/${encodeURIComponent(layer)}/22/0/0?key=${encodeURIComponent(apiKey)}`;
  let response: { ok: boolean; status: number; json(): Promise<unknown> };
  try {
    response = await fetch(url, { signal });
  } catch (caught) {
    if ((caught as { name?: unknown } | null)?.name === "AbortError") throw caught;
    return { state: "unknown", status: 0 };
  }
  if (response.ok) return { state: "granted" };
  if (response.status === 403) {
    const body = (await response.json().catch(() => null)) as { code?: unknown; addon?: unknown; message?: unknown } | null;
    const code = body?.code;
    if (code === "addon_required" || code === "dev_only" || code === "usage_limit_reached") {
      return {
        state: "denied",
        code,
        addon: typeof body?.addon === "string" ? body.addon : "",
        message: typeof body?.message === "string" ? body.message : "",
      };
    }
  }
  return { state: "unknown", status: response.status };
}

/** The identify layers legal land needs: the Dominion Land Survey and the NTS grid. */
export const LEGAL_LAYERS = ["survey.dls", "survey.nts"];

/** The overlays to compose: legal land only when the key holds it, the core treaties always. */
export function gatedOverlays(gate: AddonGate): string[] {
  return gate.state === "granted" ? ["treaties", ...LEGAL_LAYERS] : ["treaties"];
}

/** Survey units from the smallest up. The smallest under a point is the one outlined. */
export const LAND_UNITS = ["lsd", "qtr", "sec", "twp"] as const;

/** An identify row, as `/identify` returns it. */
export interface LandRow {
  layer: string;
  id: string;
  name: string;
  unit?: string;
  province?: string;
  geometry?: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
}

function unitRank(unit: string | undefined): number {
  const index = (LAND_UNITS as readonly string[]).indexOf(unit ?? "");
  return index === -1 ? LAND_UNITS.length : index;
}

/** The survey rows, smallest unit first; municipality rows left out. */
export function sortCells(rows: LandRow[]): LandRow[] {
  return rows
    .filter((row) => (LEGAL_LAYERS as readonly string[]).includes(row.layer))
    .sort((a, b) => unitRank(a.unit) - unitRank(b.unit));
}

/**
 * The survey cell to outline: the one named `preferred` (the description that was searched, so a
 * searched quarter outlines the quarter, not the legal subdivision at its centre), else the
 * smallest unit present.
 */
export function pickCell(rows: LandRow[], preferred?: string): LandRow | undefined {
  const cells = sortCells(rows);
  return (preferred ? cells.find((row) => row.name === preferred) : undefined) ?? cells[0];
}

/** A unit's name for people, in the interface language; an unknown unit as the gateway spells it. */
export function unitLabel(unit: string | undefined, lang: LandLang): string {
  return LAND_COPY[lang].units[unit ?? ""] ?? unit ?? "";
}

/** A province's name for people, from its two-letter code; an unknown code as it came. */
export function provinceLabel(code: string | undefined, lang: LandLang): string {
  return LAND_COPY[lang].provinces[code ?? ""] ?? code ?? "";
}

/** The treaty record ids a lookup matched, once each and sorted, for the highlight filter. */
export function matchedTreatyIds(context: { matches?: Array<{ id: string }> } | undefined): string[] {
  return [...new Set((context?.matches ?? []).map((match) => match.id))].sort();
}

/**
 * A square RGBA tile for `fill-pattern`, in `colour` on transparent: `"hatch"` is diagonal stripes
 * (the selected survey cell), `"dots"` a dot grid (the treaties at the point). They differ by
 * shape, not only by colour. `colour` is `#rrggbb`; anything else draws in black.
 */
export function patternImage(
  colour: string,
  kind: "hatch" | "dots",
  size = 8,
): { width: number; height: number; data: Uint8ClampedArray } {
  const valid = /^#[0-9a-f]{6}$/i.test(colour);
  const channels = [1, 3, 5].map((at) => (valid ? Number.parseInt(colour.slice(at, at + 2), 16) : 0));
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      // One thin line or one small dot per tile: sparse enough that the map under it still reads.
      const on = kind === "hatch" ? (x + y) % size === 0 : (x % size === 1 || x % size === 2) && (y % size === 1 || y % size === 2);
      if (!on) continue;
      const at = (y * size + x) * 4;
      data[at] = channels[0]!;
      data[at + 1] = channels[1]!;
      data[at + 2] = channels[2]!;
      data[at + 3] = 255;
    }
  }
  return { width: size, height: size, data };
}

export const LAND_CELL_SOURCE = "land-treaty-inspector-cell";
export const LAND_CELL_FILL = "land-treaty-inspector-cell-fill";
export const LAND_CELL_LINE = "land-treaty-inspector-cell-line";
export const LAND_POINT_SOURCE = "land-treaty-inspector-point";
export const LAND_POINT = "land-treaty-inspector-point";
export const LAND_HATCH = "land-treaty-inspector-hatch";
export const TREATY_HIGHLIGHT = "land-treaty-inspector-treaties";
export const TREATY_DOTS = "land-treaty-inspector-dots";
export const TREATY_EDGE = "land-treaty-inspector-treaty-edge";
/** The layers `overlays: ["treaties"]` composes (the ids createTreatyOverlay relies on too). */
export const TREATY_FILL_LAYER = "overlay_treaties_fill_historic";
export const TREATY_LINE_LAYER = "overlay_treaties_line_historic";

/** The style's own treaty source, read off the gateway's treaty fill layer, or null without it. */
export function treatySource(
  layers: Array<{ id: string; type?: string; source?: unknown; "source-layer"?: unknown }>,
): { source: string; sourceLayer: string } | null {
  const layer = layers.find((entry) => entry.id === TREATY_FILL_LAYER);
  return layer && typeof layer.source === "string" && typeof layer["source-layer"] === "string"
    ? { source: layer.source, sourceLayer: layer["source-layer"] }
    : null;
}

/** The part of a MapLibre map the selection draws with. */
export interface SelectionMap {
  getStyle(): { layers?: Array<{ id: string; type: string; source?: unknown; "source-layer"?: unknown }> } | undefined;
  getLayer(id: string): unknown;
  getSource(id: string): unknown;
  addSource(id: string, source: Record<string, unknown>): unknown;
  removeSource(id: string): unknown;
  addLayer(layer: Record<string, unknown>, beforeId?: string): unknown;
  removeLayer(id: string): unknown;
  hasImage(id: string): boolean;
  addImage(id: string, image: { width: number; height: number; data: Uint8ClampedArray }): unknown;
  removeImage(id: string): unknown;
}

function setPattern(map: SelectionMap, id: string, image: { width: number; height: number; data: Uint8ClampedArray }) {
  if (map.hasImage(id)) map.removeImage(id);
  map.addImage(id, image);
}

/** Take the selection off the map: the point, the cell, their sources and the treaty highlight. */
export function clearSelection(map: SelectionMap): void {
  for (const id of [LAND_POINT, TREATY_EDGE, TREATY_HIGHLIGHT, LAND_CELL_LINE, LAND_CELL_FILL]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  for (const id of [LAND_POINT_SOURCE, LAND_CELL_SOURCE]) {
    if (map.getSource(id)) map.removeSource(id);
  }
}

/**
 * Draw the selection from scratch: the survey cell hatched in `colours.cell` with an outline,
 * below the labels; the matched treaty records dotted in `colours.treaty` on the style's own
 * treaty source, below the treaty outlines; and, given `point`, the looked-up coordinate as a dot
 * ringed in `colours.halo`. The pattern images are replaced each time, so a new theme recolours
 * them. Call it again after a style swap.
 */
export function applySelection(
  map: SelectionMap,
  cell: LandRow | undefined,
  treatyIds: string[],
  colours: { cell: string; treaty: string; halo?: string },
  point?: [number, number],
): void {
  clearSelection(map);
  const layers = map.getStyle()?.layers ?? [];
  const labels = layers.find((layer) => layer.type === "symbol")?.id;
  const metadata = { [HELPER_KEY]: true };
  if (cell?.geometry) {
    setPattern(map, LAND_HATCH, patternImage(colours.cell, "hatch"));
    map.addSource(LAND_CELL_SOURCE, { type: "geojson", data: { type: "Feature", properties: {}, geometry: cell.geometry } });
    map.addLayer({ id: LAND_CELL_FILL, type: "fill", source: LAND_CELL_SOURCE, paint: { "fill-pattern": LAND_HATCH }, metadata }, labels);
    map.addLayer(
      { id: LAND_CELL_LINE, type: "line", source: LAND_CELL_SOURCE, paint: { "line-color": colours.cell, "line-width": 2 }, metadata },
      labels,
    );
  }
  const treaties = treatySource(layers);
  if (treatyIds.length > 0 && treaties) {
    setPattern(map, TREATY_DOTS, patternImage(colours.treaty, "dots"));
    const before = map.getLayer(TREATY_LINE_LAYER) ? TREATY_LINE_LAYER : labels;
    const filter = ["in", ["get", "id"], ["literal", treatyIds]];
    // A treaty is often larger than the view: the dots fade as the map zooms in, and a dotted edge
    // carries the shape where the fill would only be texture.
    map.addLayer(
      {
        id: TREATY_HIGHLIGHT,
        type: "fill",
        source: treaties.source,
        "source-layer": treaties.sourceLayer,
        filter,
        paint: { "fill-pattern": TREATY_DOTS, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0.8, 8, 0.45, 12, 0.2] },
        metadata,
      },
      before,
    );
    map.addLayer(
      {
        id: TREATY_EDGE,
        type: "line",
        source: treaties.source,
        "source-layer": treaties.sourceLayer,
        filter,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": colours.treaty, "line-width": 2.5, "line-dasharray": [0, 2] },
        metadata,
      },
      before,
    );
  }
  if (point) {
    map.addSource(LAND_POINT_SOURCE, {
      type: "geojson",
      data: { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: point } },
    });
    map.addLayer(
      {
        id: LAND_POINT,
        type: "circle",
        source: LAND_POINT_SOURCE,
        paint: {
          "circle-radius": 5,
          "circle-color": colours.cell,
          "circle-stroke-width": colours.halo ? 2 : 0,
          "circle-stroke-color": colours.halo ?? colours.cell,
        },
        metadata,
      },
      labels,
    );
  }
}

/** [[west, south], [east, north]] around a polygon's rings, for fitBounds. A loop: no spread into Math.min. */
export function geometryBounds(geometry: LandRow["geometry"]): [[number, number], [number, number]] | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  const visit = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") {
      if (value[0] < west) west = value[0];
      if (value[0] > east) east = value[0];
      if (value[1] < south) south = value[1];
      if (value[1] > north) north = value[1];
      return;
    }
    for (const item of value) visit(item);
  };
  visit(geometry?.coordinates);
  return west <= east && south <= north
    ? [
        [west, south],
        [east, north],
      ]
    : null;
}

/** True when two [lng, lat] name the same point (the gateway echoes a coordinate back as it was sent). */
export function samePoint(a: [number, number] | undefined, b: [number, number] | undefined): boolean {
  return !!a && !!b && Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;
}

/** What to tell the reader about a failed lookup, by what the gateway said. */
export function lookupError(caught: unknown, lang: LandLang): string {
  const copy = LAND_COPY[lang];
  const failure = typeof caught === "object" && caught !== null ? (caught as { code?: unknown; status?: unknown }) : {};
  const status = typeof failure.status === "number" ? failure.status : null;
  if (failure.code === "outside_coverage") return copy.outside;
  if (status === 429) return copy.busy;
  if (status === 401 || status === 403) return copy.keyRefused;
  if (status === null || status >= 500) return copy.unavailable;
  return copy.failed;
}

/** A box on screen, as getBoundingClientRect() gives it. */
export interface LandRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** Camera padding in pixels, as fitBounds takes it. */
export interface LandPadding {
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
/** How close a searched cell is framed, and how long the camera takes to get there. */
export const CELL_MAX_ZOOM = 15;
export const CAMERA_MS = 600;

/**
 * Camera padding that keeps what the camera frames clear of the floating panel: its width on the
 * left when it floats beside the map, its height at the bottom when it is a sheet across it. An
 * even gutter when nothing is measured. When the full gutter would leave too little map (a tall
 * sheet on a small phone), the gutter tightens and the frame stays in the strip the panel leaves,
 * never behind the panel.
 */
export function panelPadding(map: LandRect, panel: LandRect | null, gutter = GUTTER): LandPadding {
  const even = { top: gutter, right: gutter, bottom: gutter, left: gutter };
  if (!panel || panel.width <= 0 || panel.height <= 0 || map.width <= 0 || map.height <= 0) return even;
  const sheet = panel.width >= map.width * 0.6;
  const cover = Math.round(sheet ? map.bottom - panel.top : panel.right - map.left);
  const size = sheet ? map.height : map.width;
  if (size - 2 * gutter - cover >= MIN_FRAME) return sheet ? { ...even, bottom: cover + gutter } : { ...even, left: cover + gutter };
  const near = Math.min(cover + TIGHT, size - TIGHT - MIN_STRIP);
  return sheet ? { ...even, top: TIGHT, bottom: near } : { ...even, left: near, right: TIGHT };
}

/** The pixel offset that centres a point in the padded area: easeTo's `offset`, which, unlike its `padding`, does not stick. */
export function paddingOffset(padding: LandPadding): [number, number] {
  return [(padding.left - padding.right) / 2, (padding.top - padding.bottom) / 2];
}

/** Downtown Calgary: DLS townships, sections and Treaty 7 in view. */
export const CALGARY: [number, number] = [-114.0719, 51.0447];

export function isAbort(caught: unknown): boolean {
  return typeof caught === "object" && caught !== null && (caught as { name?: unknown }).name === "AbortError";
}

/** True when the reader asked for less motion: the camera jumps to a searched cell. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
}

/** True on a touch screen, where the copy says tap. Read after mount. */
export function coarsePointer(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)")?.matches === true;
}

/** Below Tailwind's `sm` the panel is a bottom sheet. */
export const PHONE_QUERY = "not all and (min-width: 40rem)";

/** True on a phone-width screen, where the answer leads the sheet once there is one. False on the server. */
export function phoneWidth(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.(PHONE_QUERY)?.matches === true;
}

/** The pattern swatches the answer card and the legend share with the map: hatch for the cell, dots for treaties. */
export const SWATCH = {
  hatch: "size-4 shrink-0 border-2 border-primary bg-[repeating-linear-gradient(135deg,var(--primary)_0_1px,transparent_1px_4px)]",
  dots: "size-4 shrink-0 border-2 border-dotted border-foreground bg-[radial-gradient(var(--foreground)_0.8px,transparent_1.2px)] bg-[length:5px_5px] bg-[position:0.5px_0.5px]",
  none: "size-4 shrink-0",
};
// --- end land-treaty-inspector helpers ---

export interface LandTreatyInspectorProps {
  /** unmap API key. The page passes NEXT_PUBLIC_UNMAP_KEY. With none, the block asks for one and loads nothing. */
  apiKey: string;
  /** Gateway base URL. Defaults to the unmap production gateway. */
  gateway?: string;
  /** Language of the copy, the treaty panel and the map labels. Defaults to "en". */
  lang?: LandLang;
  /** Where the map opens, [longitude, latitude]: the initial camera only, a later change does not move the map. Defaults to downtown Calgary. */
  center?: [number, number];
  /** The opening zoom: the initial camera only, like `center`. Defaults to 11. */
  zoom?: number;
  className?: string;
}

export function LandTreatyInspector({ apiKey, gateway, lang = "en", center = CALGARY, zoom = 11, className }: LandTreatyInspectorProps) {
  const copy = LAND_COPY[lang];
  const hasKey = apiKey.trim() !== "";
  const [gate, setGate] = useState<AddonGate>({ state: "checking" });
  // The opening camera, kept: after this the reader moves the map, not the props.
  const [opening] = useState(() => ({ center, zoom }));

  // One probe per key. Nothing gated is composed until it answers: a refused overlay would make
  // the whole style request fail.
  useEffect(() => {
    if (!hasKey) return;
    const controller = new AbortController();
    setGate({ state: "checking" });
    probeAddon(apiKey, "survey.dls", gateway, controller.signal).then(
      (answer) => {
        if (!controller.signal.aborted) setGate(answer);
      },
      () => {
        // Aborted: a newer probe or the unmount owns the state.
      },
    );
    return () => controller.abort();
  }, [apiKey, gateway, hasKey]);

  if (!hasKey) {
    // Where the map would be: the block's gutter, the Alert at a readable width, the first action first.
    return (
      <div
        data-unmap-block="land-treaty-inspector"
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
        data-unmap-block="land-treaty-inspector"
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
  return (
    <div data-unmap-block="land-treaty-inspector" className={["relative h-full min-h-[480px]", className].filter(Boolean).join(" ")}>
      <Map
        id={LAND_MAP_ID}
        apiKey={apiKey}
        gateway={gateway}
        style="muted"
        lang={lang}
        overlays={gatedOverlays(gate)}
        center={opening.center}
        zoom={opening.zoom}
        className="h-full"
      >
        <Inspector apiKey={apiKey} gateway={gateway} lang={lang} gate={gate} center={opening.center} zoom={opening.zoom} />
      </Map>
    </div>
  );
}

/** Where the land answer stands. `at` is the point it is for. */
type LandView =
  | { kind: "idle" }
  | { kind: "loading"; at: [number, number] }
  | { kind: "error"; at: [number, number]; message: string; preferred?: string; framed: boolean }
  | { kind: "result"; at: [number, number]; rows: LandRow[]; cell?: LandRow };

/** The treaty panel's last word, kept with the point it was for: an answer, or a failed lookup. */
type TreatyAnswer = { at: [number, number] | undefined; selection?: TreatySelection; failed?: boolean };

/** One line of the answer card: a pattern swatch, a value and a quieter caption. */
function AnswerRow({
  swatch,
  value,
  caption,
  size,
  busy,
  wrap,
  valueLang,
  testId,
}: {
  swatch: keyof typeof SWATCH;
  value: string;
  caption: string;
  size: "headline" | "line";
  busy?: boolean;
  /** The caption wraps instead of truncating: it is a sentence that must be read whole. */
  wrap?: boolean;
  /** The value's own language, when it is not the interface's. */
  valueLang?: string;
  testId: string;
}) {
  return (
    <div data-testid={testId} className="flex min-w-0 items-start gap-3">
      <span className="flex h-7 shrink-0 items-center">
        {busy ? <Spinner className="size-4 text-muted-foreground" /> : <span aria-hidden="true" data-swatch={swatch} className={SWATCH[swatch]} />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <p
          lang={valueLang}
          className={
            busy
              ? "flex h-7 items-center truncate text-sm text-muted-foreground"
              : size === "headline"
                ? "truncate text-2xl leading-7 font-semibold tracking-tight tabular-nums"
                : "truncate text-base leading-7 font-medium"
          }
        >
          {value}
        </p>
        <p className={wrap ? "min-h-5 text-sm text-muted-foreground" : "min-h-5 truncate text-sm text-muted-foreground"}>{caption}</p>
      </div>
    </div>
  );
}

/** Everything that needs the map. It renders inside <Map>, where useMap() can see it. */
function Inspector({
  apiKey,
  gateway,
  lang,
  gate,
  center,
  zoom,
}: {
  apiKey: string;
  gateway?: string;
  lang: LandLang;
  gate: AddonGate;
  center: [number, number];
  zoom: number;
}) {
  const copy = LAND_COPY[lang];
  const granted = gate.state === "granted";
  const map = useMap(LAND_MAP_ID);
  const ready = useMapReady(LAND_MAP_ID);
  const generation = useMapGeneration(LAND_MAP_ID);
  const client = useMemo(() => new GeocoderClient({ key: apiKey, gateway }), [apiKey, gateway]);
  // The point handed to the treaty panel: a chosen search result. Cleared when the card moves to
  // another point. A chosen result waits one render in `nextPoint`, so the panel always sees it
  // as new: the same result chosen again (after a failed lookup, say) asks again.
  const [point, setPoint] = useState<[number, number] | undefined>(undefined);
  const [nextPoint, setNextPoint] = useState<[number, number] | null>(null);
  const [land, setLand] = useState<LandView>({ kind: "idle" });
  const [treaty, setTreaty] = useState<TreatyAnswer | null>(null);
  // On a phone the sheet can fold to the answer, to give the map back.
  const [folded, setFolded] = useState(false);
  // Read after mount: the server cannot know the pointer, so the first pass says "click".
  const [touch, setTouch] = useState(false);
  // A phone-width screen, where the answer leads the sheet in the DOM as well as on screen, so
  // the keyboard meets it first. The panel mounts only after the add-on probe, so on the client.
  const [phone, setPhone] = useState(phoneWidth);
  const abortRef = useRef<AbortController | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const movedRef = useRef(false);
  const landAtRef = useRef<[number, number] | undefined>(undefined);
  const uid = useId();
  const gateId = `${uid}-gate`;
  const searchId = `${uid}-search`;
  const detailsId = `${uid}-details`;

  const landAt = land.kind === "idle" ? undefined : land.at;

  function padding(): LandPadding {
    const container = map?.getContainer();
    if (!container) return panelPadding({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }, null);
    return panelPadding(container.getBoundingClientRect(), panelRef.current?.getBoundingClientRect() ?? null);
  }

  /** The camera eases to the cell, clear of the panel; with no cell drawn, to the point itself. */
  function frame(cell: LandRow | undefined, at?: [number, number]) {
    if (!map) return;
    const bounds = geometryBounds(cell?.geometry);
    const duration = prefersReducedMotion() ? 0 : CAMERA_MS;
    if (bounds) map.fitBounds(bounds, { padding: padding(), maxZoom: CELL_MAX_ZOOM, duration });
    else if (at) map.easeTo({ center: at, offset: paddingOffset(padding()), duration });
    else return;
    movedRef.current = true;
  }

  /**
   * One identify at a time: a new one aborts the last, and only the latest may set state. A
   * searched description or a typed coordinate is framed once it answers; a click is where the
   * reader is already looking.
   */
  function lookUp(at: [number, number], preferred?: string, framed = preferred !== undefined) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    landAtRef.current = at;
    setLand({ kind: "loading", at });
    // On a phone the whole sheet scrolls: bring the answer, which leads it now, back into view.
    if (contentRef.current) contentRef.current.scrollTop = 0;
    client
      .identify({ at, layers: granted ? LEGAL_LAYERS : ["municipalities"], geometry: granted, signal: controller.signal })
      .then(({ results }) => {
        if (abortRef.current !== controller) return;
        const rows = results as LandRow[];
        const view: LandView = { kind: "result", at, rows, cell: granted ? pickCell(rows, preferred) : undefined };
        setLand(view);
        if (framed) frame(view.cell, at);
      })
      .catch((caught: unknown) => {
        if (abortRef.current !== controller || isAbort(caught)) return;
        setLand({ kind: "error", at, message: lookupError(caught, lang), preferred, framed });
      });
  }
  const lookUpRef = useRef(lookUp);
  lookUpRef.current = lookUp;

  // A map click looks up the point. The treaty panel answers the same click itself. The reader
  // has chosen where to look, so the opening view never snaps back after it.
  useEffect(() => {
    if (!map) return;
    const onClick = (event: { lngLat: { lng: number; lat: number } }) => {
      movedRef.current = true;
      setPoint(undefined);
      setNextPoint(null);
      lookUpRef.current([event.lngLat.lng, event.lngLat.lat]);
    };
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [map]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      abortRef.current = null;
    },
    [],
  );

  useEffect(() => setTouch(coarsePointer()), []);

  useEffect(() => {
    const media = typeof window === "undefined" ? undefined : window.matchMedia?.(PHONE_QUERY);
    if (!media) return;
    const update = () => setPhone(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (!nextPoint) return;
    setPoint(nextPoint);
    setNextPoint(null);
  }, [nextPoint]);

  // The opening view sits in the map the panel leaves, without a move to watch: now, again when
  // the map resizes, the panel has slid in or the sheet folds, until the reader looks somewhere.
  const placeRef = useRef({ center, zoom });
  placeRef.current = { center, zoom };
  useEffect(() => {
    if (!map) return;
    const place = () => {
      if (movedRef.current) return;
      map.easeTo({ ...placeRef.current, offset: paddingOffset(padding()), duration: 0 });
    };
    // The camera's own moves carry no originalEvent; a drag, a wheel or a key does.
    const onMoveStart = (event?: { originalEvent?: unknown }) => {
      if (event?.originalEvent) movedRef.current = true;
    };
    // Measured again once the panel has slid in: mid-slide it sits off its final place.
    const panel = panelRef.current;
    const onSlidIn = (event: Event) => {
      if (event.target === panel) place();
    };
    place();
    map.on("resize", place);
    map.on("movestart", onMoveStart as never);
    panel?.addEventListener("animationend", onSlidIn);
    return () => {
      map.off("resize", place);
      map.off("movestart", onMoveStart as never);
      panel?.removeEventListener("animationend", onSlidIn);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, folded]);

  // The treaty answer counts only for the point the card is about; a stale one draws nothing.
  const treatyCurrent = treaty && landAt && (treaty.at === undefined || samePoint(treaty.at, landAt)) ? treaty : null;
  const selection = treatyCurrent?.selection;
  const hidden: string[] = selection?.hidden ?? [];
  const matches = selection?.context.matches ?? [];
  // The card and the dots speak for the categories the panel shows; a hidden one is only named.
  const visible = matches.filter((match) => !hidden.includes(match.category));
  const shownTreaty = visible[0] ?? matches[0];
  const treatyFailed = !!treatyCurrent && (treatyCurrent.failed === true || selection?.context.status === "unavailable");
  const treatyKey = treatyFailed ? "" : matchedTreatyIds({ matches: visible }).join("|");
  const cell = land.kind === "result" ? land.cell : undefined;
  const pointKey = landAt ? landAt.join(",") : "";

  // The patterned selection, drawn again whenever it changes and after every style swap.
  useEffect(() => {
    if (!map || !ready) return;
    let removed = false;
    const onRemove = () => {
      removed = true;
    };
    map.on("remove", onRemove);
    if (map.getStyle()) {
      const accent = accentColor(map, undefined, undefined);
      applySelection(
        map as unknown as SelectionMap,
        cell,
        treatyKey ? treatyKey.split("|") : [],
        { cell: accent, treaty: tokenColor(map, "--foreground") ?? accent, halo: tokenColor(map, "--background") ?? undefined },
        pointKey ? (pointKey.split(",").map(Number) as [number, number]) : undefined,
      );
    }
    return () => {
      map.off("remove", onRemove);
      if (!removed && map.getStyle()) clearSelection(map as unknown as SelectionMap);
    };
  }, [map, ready, generation, cell, treatyKey, pointKey]);

  function chooseLand(result: GeocodeResult) {
    movedRef.current = true;
    setPoint(undefined);
    setNextPoint([result.lng, result.lat]);
    lookUp([result.lng, result.lat], result.name);
  }

  function chooseCell(row: LandRow) {
    if (land.kind !== "result") return;
    setLand({ ...land, cell: row });
    frame(row);
  }

  /** A treaty-panel point the card is not about yet (a typed coordinate): the card follows it. */
  function follow(at: [number, number] | undefined) {
    if (!at || samePoint(at, landAtRef.current)) return;
    setPoint(undefined);
    setNextPoint(null);
    lookUpRef.current(at, undefined, true);
  }

  function onTreaties(next: TreatySelection) {
    const echoed = next.context?.point;
    const at: [number, number] | undefined = echoed ? [echoed.lng, echoed.lat] : undefined;
    setTreaty({ at, selection: next });
    follow(at);
  }

  function onTreatyError(_error: unknown, at: [number, number] | null) {
    setTreaty({ at: at ?? landAtRef.current, failed: true });
    follow(at ?? undefined);
  }

  function retry() {
    if (land.kind === "error") lookUp(land.at, land.preferred, land.framed);
  }

  const cells = land.kind === "result" ? sortCells(land.rows) : [];
  const municipality = land.kind === "result" ? land.rows.find((row) => row.layer === "municipalities") : undefined;
  const intro = granted ? (touch ? copy.introTouch : copy.intro) : touch ? copy.introDeniedTouch : copy.introDenied;
  const hideWhenFolded = "max-sm:data-[folded=true]:hidden";
  const answered = land.kind !== "idle";
  const answerLeads = phone && answered;
  const treatyCaption = shownTreaty
    ? [copy.categories[shownTreaty.category] ?? shownTreaty.category, visible.length === 0 ? copy.hiddenOnMap : visible.length > 1 ? copy.more(visible.length - 1) : ""]
        .filter(Boolean)
        .join(", ")
    : "";

  // What the live region says, once both halves of the answer have settled: the cell or the
  // municipality, then the treaty line. A failed land lookup speaks through its own alert.
  const landSaid =
    land.kind !== "result"
      ? ""
      : granted
        ? cell
          ? copy.sayCell(unitLabel(cell.unit, lang), cell.name, provinceLabel(cell.province, lang))
          : copy.sayNoCell
        : municipality
          ? `${copy.municipality(municipality.name)}.`
          : copy.sayNoMunicipality;
  const treatySaid = !treatyCurrent
    ? ""
    : treatyFailed
      ? `${copy.treatyUnavailable}.`
      : shownTreaty
        ? copy.sayTreaty(shownTreaty.name, treatyCaption)
        : `${copy.treatyNone}.`;
  const said = (land.kind === "result" || land.kind === "error") && treatyCurrent ? [landSaid, treatySaid].filter(Boolean).join(" ") : "";

  const landRow =
    land.kind === "loading" ? (
      <AnswerRow testId="land-answer-cell" swatch="none" value={copy.loading} caption="" size="headline" busy />
    ) : land.kind !== "result" ? null : granted ? (
      cell ? (
        <AnswerRow
          testId="land-answer-cell"
          swatch="hatch"
          value={cell.name}
          caption={[unitLabel(cell.unit, lang), provinceLabel(cell.province, lang)].filter(Boolean).join(", ")}
          size="headline"
        />
      ) : (
        <AnswerRow testId="land-answer-cell" swatch="none" value={copy.noCell} caption={copy.noCellHint} size="line" />
      )
    ) : municipality ? (
      <AnswerRow testId="land-answer-cell" swatch="none" value={municipality.name} caption={copy.municipalityLabel} size="headline" />
    ) : (
      <AnswerRow testId="land-answer-cell" swatch="none" value={copy.noMunicipality} caption={copy.noMunicipalityHint} size="line" />
    );

  const treatyRow = !landAt ? null : !treatyCurrent ? (
    <AnswerRow testId="land-answer-treaty" swatch="none" value={copy.treatyLoading} caption="" size="line" busy />
  ) : treatyFailed ? (
    <AnswerRow testId="land-answer-treaty" swatch="none" value={copy.treatyUnavailable} caption={copy.treatyUnavailableHint} size="line" />
  ) : shownTreaty ? (
    <AnswerRow
      testId="land-answer-treaty"
      swatch={visible.length > 0 ? "dots" : "none"}
      value={shownTreaty.name}
      valueLang={shownTreaty.name_lang && shownTreaty.name_lang !== lang ? shownTreaty.name_lang : undefined}
      caption={treatyCaption}
      size="line"
    />
  ) : (
    <AnswerRow testId="land-answer-treaty" swatch="none" value={copy.treatyNone} caption={copy.treatyNoneHint} size="line" wrap />
  );

  // The answer card: always there and tall enough for both lines, or an error and its retry, so
  // nothing jumps when it arrives. On a phone, once there is an answer, it leads the sheet: it is
  // placed first in the DOM rather than reordered by CSS, so keyboard order matches what is seen.
  const answerSlot = (
    <div data-testid="land-answer" className="flex min-h-[7.5rem] shrink-0 flex-col justify-center gap-3">
      {land.kind === "error" ? (
        <>
          <Alert variant="destructive" role="alert">
            <AlertDescription className="flex flex-row flex-wrap items-center justify-between gap-2">
              <span className="min-w-0">{land.message}</span>
              <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={retry}>
                {copy.retry}
              </Button>
            </AlertDescription>
          </Alert>
          {treatyRow}
        </>
      ) : land.kind === "idle" ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-base font-medium">{touch ? copy.emptyTouch : copy.empty}</p>
            <p className="text-sm text-muted-foreground">{copy.emptyHint}</p>
          </div>
          <ul aria-label={copy.legend} className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {granted ? (
              <li className="flex items-center gap-1.5">
                <span aria-hidden="true" data-swatch="hatch" className={SWATCH.hatch} />
                {copy.legendCell}
              </li>
            ) : null}
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" data-swatch="dots" className={SWATCH.dots} />
              {copy.legendTreaty}
            </li>
          </ul>
        </div>
      ) : (
        <div key={pointKey} className="flex flex-col gap-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
          {landRow}
          {treatyRow}
        </div>
      )}
    </div>
  );

  return (
    <>
      <p data-testid="land-announce" aria-live="polite" className="sr-only">
        {said}
      </p>
      {/* A card floating on the map at 24 px; below `sm`, a sheet across the bottom (at most half the map) that clears the attribution. */}
      <div
        ref={panelRef}
        className="absolute inset-x-4 bottom-10 z-10 flex max-h-[50%] flex-col sm:inset-x-auto sm:top-6 sm:bottom-auto sm:left-6 sm:max-h-[calc(100%-3rem)] sm:w-[22rem] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-300 sm:motion-safe:slide-in-from-bottom-0 sm:motion-safe:slide-in-from-left-4"
      >
        <Card className="flex min-h-0 flex-1 flex-col">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle role="heading" aria-level={2} className="min-w-0">
                {copy.title}
              </CardTitle>
              {/* An icon, so the title keeps the width of a phone's sheet; its name says what it does. */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 sm:hidden"
                aria-label={folded ? copy.unfold : copy.fold}
                title={folded ? copy.unfold : copy.fold}
                aria-expanded={!folded}
                aria-controls={`${granted ? searchId : gateId} ${detailsId}`}
                onClick={() => setFolded((current) => !current)}
              >
                <span aria-hidden="true">{folded ? "▴" : "▾"}</span>
              </Button>
            </div>
            <CardDescription className="max-sm:hidden">{intro}</CardDescription>
          </CardHeader>
          {/* The search and the answer stay put and the details below them scroll; on a phone the
              whole sheet scrolls, and once there is an answer it leads the sheet. */}
          <CardContent ref={contentRef} className="flex min-h-0 flex-1 flex-col gap-4 max-sm:overflow-y-auto max-sm:overscroll-contain">
            {answerLeads ? answerSlot : null}
            {gate.state === "denied" || gate.state === "unknown" ? (
              <Alert
                id={gateId}
                data-folded={folded}
                data-unmap-addon-gate={gate.state === "denied" ? gate.code : "unknown"}
                className={`shrink-0 ${hideWhenFolded}`}
              >
                <AlertTitle className="line-clamp-none">{gate.state === "denied" ? copy.deniedTitle[gate.code] : copy.unknownTitle}</AlertTitle>
                <AlertDescription className="flex flex-col items-start gap-2">
                  {/* On a phone, once there is an answer, the title and the way forward are enough. */}
                  <p data-gate-body="" className={answered ? "max-sm:hidden" : undefined}>
                    {gate.state === "denied" ? copy.deniedBody[gate.code] : copy.unknownBody(gate.status)}
                  </p>
                  <a className="font-medium text-primary underline underline-offset-4" href={copy.pricingUrl} target="_blank" rel="noreferrer">
                    {copy.pricing}
                  </a>
                </AlertDescription>
              </Alert>
            ) : null}
            {granted ? (
              <div id={searchId} data-folded={folded} className={`flex shrink-0 flex-col gap-1 ${hideWhenFolded}`}>
                {/* `[&>p]:hidden` hides the geocoder's own coverage line; the example below says more. */}
                <LegalLandSearch
                  mapId={LAND_MAP_ID}
                  apiKey={apiKey}
                  gateway={gateway}
                  lang={lang}
                  placeholder={copy.search}
                  flyToZoom={13}
                  errorText={(caught) => lookupError(caught, lang)}
                  onSelect={chooseLand}
                  className="[&>p]:hidden"
                />
                <p className="text-xs text-muted-foreground">{copy.searchHint}</p>
              </div>
            ) : null}
            {answerLeads ? null : answerSlot}
            <div
              id={detailsId}
              data-folded={folded}
              className={`-mx-2 flex min-h-0 flex-1 flex-col gap-4 border-t px-2 pt-4 sm:overflow-y-auto sm:overscroll-contain max-sm:flex-none ${hideWhenFolded}`}
            >
              {land.kind === "result" && granted && cells.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">{copy.cells}</p>
                  <p className="text-xs text-muted-foreground">{copy.cellsHint}</p>
                  <ul aria-label={copy.cells} className="mt-1 flex flex-col">
                    {cells.map((row) => {
                      const current = row.id === cell?.id;
                      return (
                        <li key={row.id} aria-current={current ? "true" : undefined}>
                          <Button
                            type="button"
                            variant={current ? "secondary" : "ghost"}
                            size="sm"
                            aria-pressed={current}
                            className="h-auto w-full justify-between gap-3 py-1.5 text-left font-normal whitespace-normal aria-pressed:font-semibold"
                            onClick={() => chooseCell(row)}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              {/* The hatched row is the one on the map: a swatch as well as the weight. */}
                              <span aria-hidden="true" data-swatch={current ? "hatch" : "none"} className={current ? SWATCH.hatch : SWATCH.none} />
                              <span className="truncate tabular-nums">{row.name}</span>
                            </span>
                            <span className="sr-only">{copy.separator}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">{unitLabel(row.unit, lang)}</span>
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
              <TreatyContext
                mapId={LAND_MAP_ID}
                apiKey={apiKey}
                gateway={gateway}
                lang={lang}
                point={point}
                onSelect={onTreaties}
                onError={onTreatyError}
              />
              {granted ? <p className="pb-1 text-xs text-muted-foreground">{copy.surveyCredit}</p> : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
