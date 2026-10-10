"use client";

/**
 * <EnergyExplorer> - Alberta wells, pipelines and facilities on an unmap map, as a console: UWI and
 * licence search, a layer legend and click-to-identify, with the picked feature's record under
 * them. A full-bleed map with a floating panel, a bottom sheet on a phone.
 *
 * The energy overlays, well search and identify need the Energy add-on. The block asks the gateway
 * once whether your key holds it. If it does not, the map still renders (a `profile="energy"`
 * style leaves out the layers a key cannot read) and the panel says why the energy layers are
 * missing and what unlocks them, instead of mounting a search box and a click handler that could
 * only be refused.
 *
 * Metering: every authenticated request is one call. The block makes the add-on probe (one
 * `GET /layers/energy.wells/22/0/0`), then the map's own style and tile requests. The search box
 * makes one `GET /geocode/autocomplete` per pause in typing, and each map click one `GET /identify`.
 *
 * Composes the energy-map, well-search, energy-popup and energy-layer-control items (the last is
 * a layer-legend preset) on your shadcn Card, Alert, Button and Spinner. Installed by
 * `npx shadcn add` with its page at app/energy-explorer/page.tsx. Edit freely.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { GeocodeResult, IdentifyResult } from "@unmap/geocoding";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EnergyLayerControl } from "@/components/ui/energy-layer-control";
import { EnergyMap } from "@/components/ui/energy-map";
import { EnergyPopup } from "@/components/ui/energy-popup";
import { Spinner } from "@/components/ui/spinner";
import { WellSearch } from "@/components/ui/well-search";
import { useMap, useMapGeneration, useMapReady } from "@/lib/map-context";
import { chartRamp } from "@/lib/map-layers";

// --- energy-explorer helpers (kept identical across both lanes) ---
export type EnergyLang = "en" | "fr";

/** The block's own map id, so a map elsewhere on the page never answers for it. */
export const ENERGY_MAP_ID = "energy-explorer";

/** Where a reader gets an unmap key: the no-key state's first action. */
export const KEY_URL = "https://unmap.dev/dashboard";

export const ENERGY_COPY = {
  en: {
    title: "Energy explorer",
    description: "Wells, pipelines and facilities in Alberta. Switch layers, click a feature for its record, or search a UWI or licence.",
    checking: "Checking this key's add-ons...",
    search: "Search UWI or well licence",
    searchHint: "A UWI like 100/06-12-048-07W5/00, or a licence number.",
    searchEmpty: "No well matches that UWI or licence.",
    hint: "Click a well, pipeline or facility on the map.",
    hintTouch: "Tap a well, pipeline or facility on the map.",
    hintMore: "Anything recorded there shows here.",
    selected: "Selected",
    loading: "Looking up this point...",
    miss: "Nothing recorded at this point.",
    fields: { uwi: "UWI", licence: "Licence", operator: "Operator", status: "Status" },
    kinds: {
      "energy.wells": "Well",
      "energy.pipelines": "Pipeline",
      "energy.facilities": "Facility",
      well: "Well",
      facility: "Facility",
    } as Record<string, string>,
    busy: "Too many requests. Try again in a moment.",
    keyRefused: "The API key was refused. Check it and try again.",
    unavailable: "The service didn't answer. Try again in a moment.",
    outside: "That point is outside Canada. The energy layers cover Alberta.",
    failed: "The lookup failed. Try again.",
    deniedTitle: {
      addon_required: "Energy layers need the Energy add-on",
      dev_only: "Energy layers are free for development only",
      usage_limit_reached: "This month's development allowance is used",
    },
    deniedBody: {
      addon_required:
        "This key does not hold the Energy add-on, so the map shows the basemap without wells, pipelines or facilities, and search and identify are off.",
      dev_only:
        "On the dev plan, energy layers work from localhost and preview origins. From this origin they need a paid plan with the Energy add-on.",
      usage_limit_reached:
        "The dev plan's premium calls for this month are used. Energy layers come back next month, or now with a paid plan.",
    },
    unknownTitle: "Could not check the Energy add-on",
    unknownBody: (status: number) =>
      status === 401
        ? "The gateway refused this key. Check the key and its allowed origins."
        : `The gateway answered ${status === 0 ? "nothing (a network error)" : `HTTP ${status}`}, so energy search and identify are off. The map shows what this key can read.`,
    pricing: "Plans and add-ons",
    pricingUrl: "https://unmap.dev/pricing",
    credit: "Energy layers: Alberta Energy Regulator open data (ST37, ST76, ST102), refreshed monthly.",
    fold: "Hide details",
    unfold: "Show details",
    noKeyTitle: "Add your unmap key to load the map.",
    getKey: "Get a key",
    noKey:
      'No unmap key. Pass apiKey. On Next.js, set NEXT_PUBLIC_UNMAP_KEY in .env.local. On Nuxt, set NUXT_PUBLIC_UNMAP_KEY in .env. If you installed with unmap add, nuxt.config already declares runtimeConfig: { public: { unmapKey: "" } }; otherwise add it there. Then restart the dev server.',
  },
  fr: {
    title: "Explorateur énergétique",
    description:
      "Puits, pipelines et installations en Alberta. Changez de couches, cliquez sur un élément pour sa fiche, ou cherchez un UWI ou un permis.",
    checking: "Vérification des modules complémentaires de cette clé...",
    search: "Chercher UWI ou permis",
    searchHint: "Un UWI comme 100/06-12-048-07W5/00, ou un numéro de permis.",
    searchEmpty: "Aucun puits ne correspond à cet UWI ni à ce permis.",
    hint: "Cliquez sur un puits, un pipeline ou une installation sur la carte.",
    hintTouch: "Touchez un puits, un pipeline ou une installation sur la carte.",
    hintMore: "Ce qui y est enregistré s'affiche ici.",
    selected: "Sélection",
    loading: "Recherche de ce point...",
    miss: "Rien n'est enregistré à cet endroit.",
    fields: { uwi: "UWI", licence: "Permis", operator: "Exploitant", status: "Statut" },
    kinds: {
      "energy.wells": "Puits",
      "energy.pipelines": "Pipeline",
      "energy.facilities": "Installation",
      well: "Puits",
      facility: "Installation",
    } as Record<string, string>,
    busy: "Trop de requêtes. Réessayez dans un instant.",
    keyRefused: "La clé API a été refusée. Vérifiez-la et réessayez.",
    unavailable: "Le service n'a pas répondu. Réessayez dans un instant.",
    outside: "Ce point est hors du Canada. Les couches énergétiques couvrent l'Alberta.",
    failed: "La recherche a échoué. Réessayez.",
    deniedTitle: {
      addon_required: "Les couches énergétiques nécessitent le module complémentaire Énergie",
      dev_only: "Les couches énergétiques sont gratuites en développement seulement",
      usage_limit_reached: "L'allocation de développement de ce mois est épuisée",
    },
    deniedBody: {
      addon_required:
        "Cette clé n'a pas le module complémentaire Énergie : la carte montre le fond sans puits, pipelines ni installations, et la recherche et l'identification sont désactivées.",
      dev_only:
        "Avec le forfait de développement, les couches énergétiques fonctionnent depuis localhost et les origines de prévisualisation. Depuis cette origine, il faut un forfait payant avec le module complémentaire Énergie.",
      usage_limit_reached:
        "Les appels premium du forfait de développement sont épuisés pour ce mois. Les couches énergétiques reviennent le mois prochain, ou dès maintenant avec un forfait payant.",
    },
    unknownTitle: "Impossible de vérifier le module complémentaire Énergie",
    unknownBody: (status: number) =>
      status === 401
        ? "La passerelle a refusé cette clé. Vérifiez la clé et ses origines autorisées."
        : `La passerelle a répondu ${status === 0 ? "rien (une erreur réseau)" : `HTTP ${status}`} : la recherche et l'identification énergétiques sont désactivées. La carte montre ce que cette clé peut lire.`,
    pricing: "Forfaits et modules complémentaires",
    pricingUrl: "https://unmap.dev/fr/pricing",
    credit:
      "Couches énergétiques : données ouvertes de l'Alberta Energy Regulator (ST37, ST76, ST102), mises à jour chaque mois.",
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

/** What the record shows, from a search result or an identify hit. */
export interface WellDetails {
  name: string;
  uwi?: string;
  licence?: string;
  operator?: string;
  status?: string;
}

/** The fields a search result and an identify hit share, without empty ones. */
export function wellDetails(hit: { name: string; uwi?: string; licence?: string; operator?: string; status?: string }): WellDetails {
  return {
    name: hit.name,
    ...(hit.uwi ? { uwi: hit.uwi } : {}),
    ...(hit.licence ? { licence: hit.licence } : {}),
    ...(hit.operator ? { operator: hit.operator } : {}),
    ...(hit.status ? { status: hit.status } : {}),
  };
}

/** The labelled fields a picked feature has, in a fixed order. */
export function detailRows(well: WellDetails, lang: EnergyLang): Array<[string, string]> {
  const labels = ENERGY_COPY[lang].fields;
  const rows: Array<[string, string | undefined]> = [
    [labels.uwi, well.uwi],
    [labels.licence, well.licence],
    [labels.operator, well.operator],
    [labels.status, well.status],
  ];
  return rows.filter((row): row is [string, string] => typeof row[1] === "string" && row[1] !== "");
}

/** What a picked feature is, from its identify layer or its search layer; "" for any other. */
export function kindLabel(layer: string | undefined, lang: EnergyLang): string {
  return ENERGY_COPY[lang].kinds[layer ?? ""] ?? "";
}

/** A [lng, lat] as people read it: degrees north and west, a decimal comma in French. */
export function formatPoint(at: [number, number], lang: EnergyLang): string {
  const [lng, lat] = at;
  const number = (value: number) => {
    const text = Math.abs(value).toFixed(4);
    return lang === "fr" ? text.replace(".", ",") : text;
  };
  const west = lang === "fr" ? "O" : "W";
  return `${number(lat)}° ${lat < 0 ? "S" : "N"}, ${number(lng)}° ${lng < 0 ? west : "E"}`;
}

/** What to tell the reader about a failed search or identify, by what the gateway said. */
export function requestError(caught: unknown, lang: EnergyLang): string {
  const copy = ENERGY_COPY[lang];
  const failure = typeof caught === "object" && caught !== null ? (caught as { code?: unknown; status?: unknown }) : {};
  const status = typeof failure.status === "number" ? failure.status : null;
  if (failure.code === "outside_coverage") return copy.outside;
  if (status === 429) return copy.busy;
  if (status === 401 || status === 403) return copy.keyRefused;
  if (status === null || status >= 500) return copy.unavailable;
  return copy.failed;
}

/** The click targets: the overlays identify answers for, painted from the customer's chart tokens. */
export const ENERGY_TARGETS = ["energy.wells", "energy.pipelines", "energy.facilities"] as const;
export type EnergyTarget = (typeof ENERGY_TARGETS)[number];

/** The area overlays: left in the style's own neutral colour, with no swatch in the legend. */
export const ENERGY_AREAS = ["energy.fields", "energy.petroleum-tenure", "energy.mineral-tenure", "energy.ccs", "energy.geothermal"] as const;

/** One colour per click target from a ramp (`--chart-1`, `--chart-2`, `--chart-3`), cycling a short one. */
export function targetColors(ramp: string[]): Record<EnergyTarget, string> {
  const at = (index: number) => ramp[index % ramp.length] ?? "";
  return { "energy.wells": at(0), "energy.pipelines": at(1), "energy.facilities": at(2) };
}

/** The click target a search or identify layer belongs to: a searched `well` is a well. */
export function targetOf(layer: string | undefined): EnergyTarget | undefined {
  if (layer === "well") return "energy.wells";
  if (layer === "facility") return "energy.facilities";
  return (ENERGY_TARGETS as readonly string[]).includes(layer ?? "") ? (layer as EnergyTarget) : undefined;
}

/** The legend's swatches: the painted colour for a click target (none until painted), none for an area. */
export function legendColors(colors: Record<EnergyTarget, string> | null): Record<string, string | false> {
  const swatches: Record<string, string | false> = {};
  for (const id of ENERGY_TARGETS) swatches[id] = colors?.[id] ?? false;
  for (const id of ENERGY_AREAS) swatches[id] = false;
  return swatches;
}

/** The part of a MapLibre map the paint uses. */
export interface EnergyPaintMap {
  getStyle(): { layers?: Array<{ id: string; type: string }> } | undefined;
  setPaintProperty(id: string, name: string, value: unknown): unknown;
}

const PAINT_COLOUR: Record<string, string> = { circle: "circle-color", line: "line-color", fill: "fill-color" };

/**
 * Paint every drawn layer of each click target (`overlay_energy.wells_circle`, the pipelines line)
 * in its colour. Labels keep the style's colour, which is solved for contrast. Call it again after
 * every style load: a new style brings the gateway's own paint back.
 */
export function paintTargets(map: EnergyPaintMap, colors: Record<EnergyTarget, string>): void {
  for (const layer of map.getStyle()?.layers ?? []) {
    const key = PAINT_COLOUR[layer.type];
    const target = ENERGY_TARGETS.find((id) => layer.id.startsWith(`overlay_${id}_`));
    if (key && target && colors[target]) map.setPaintProperty(layer.id, key, colors[target]);
  }
}

/** A box on screen, as getBoundingClientRect() gives it. */
export interface EnergyRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** Camera padding in pixels, as MapLibre takes it. */
export interface EnergyPadding {
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
 * Camera padding that keeps the centre of the view clear of the floating panel: its width on the
 * left when it floats beside the map, its height at the bottom when it is a sheet across it. An
 * even gutter when nothing is measured. When the full gutter would leave too little map (a tall
 * sheet on a small phone), the gutter tightens and the frame stays in the strip the panel leaves.
 */
export function panelPadding(map: EnergyRect, panel: EnergyRect | null, gutter = GUTTER): EnergyPadding {
  const even = { top: gutter, right: gutter, bottom: gutter, left: gutter };
  if (!panel || panel.width <= 0 || panel.height <= 0 || map.width <= 0 || map.height <= 0) return even;
  const sheet = panel.width >= map.width * 0.6;
  const cover = Math.round(sheet ? map.bottom - panel.top : panel.right - map.left);
  const size = sheet ? map.height : map.width;
  if (size - 2 * gutter - cover >= MIN_FRAME) return sheet ? { ...even, bottom: cover + gutter } : { ...even, left: cover + gutter };
  const near = Math.min(cover + TIGHT, size - TIGHT - MIN_STRIP);
  return sheet ? { ...even, top: TIGHT, bottom: near } : { ...even, left: near, right: TIGHT };
}

/** True on a touch screen, where the copy says tap. Read after mount. */
export function coarsePointer(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)")?.matches === true;
}

/** Below Tailwind's `sm` the panel is a bottom sheet. */
export const PHONE_QUERY = "not all and (min-width: 40rem)";

/** True on a phone-width screen, where the record leads the sheet. False on the server. */
export function phoneWidth(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.(PHONE_QUERY)?.matches === true;
}

/** Drayton Valley, in the Pembina field: at zoom 11 single wells, pipelines and facilities can be picked by eye. */
export const DRAYTON_VALLEY: [number, number] = [-114.977, 53.222];
// --- end energy-explorer helpers ---

export interface EnergyExplorerProps {
  /** unmap API key. The page passes NEXT_PUBLIC_UNMAP_KEY. With none, the block asks for one and loads nothing. */
  apiKey: string;
  /** Gateway base URL. Defaults to the unmap production gateway. */
  gateway?: string;
  /** Language of the copy, the search, the legend and the map labels. Defaults to "en". */
  lang?: EnergyLang;
  /** Where the map opens, [longitude, latitude]: the initial camera only, a later change does not move the map. Defaults to Drayton Valley. */
  center?: [number, number];
  /** The opening zoom: the initial camera only, like `center`. Defaults to 11. */
  zoom?: number;
  className?: string;
}

export function EnergyExplorer({ apiKey, gateway, lang = "en", center = DRAYTON_VALLEY, zoom = 11, className }: EnergyExplorerProps) {
  const copy = ENERGY_COPY[lang];
  const hasKey = apiKey.trim() !== "";
  const [gate, setGate] = useState<AddonGate>({ state: "checking" });
  // The opening camera, kept: after this the reader moves the map, not the props.
  const [opening] = useState(() => ({ center, zoom }));

  // One probe per key. Nothing gated is mounted until it answers.
  useEffect(() => {
    if (!hasKey) return;
    const controller = new AbortController();
    setGate({ state: "checking" });
    probeAddon(apiKey, "energy.wells", gateway, controller.signal).then(
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
        data-unmap-block="energy-explorer"
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
        data-unmap-block="energy-explorer"
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
    <div data-unmap-block="energy-explorer" className={["relative h-full min-h-[480px]", className].filter(Boolean).join(" ")}>
      <EnergyMap id={ENERGY_MAP_ID} apiKey={apiKey} gateway={gateway} lang={lang} center={opening.center} zoom={opening.zoom} className="h-full">
        <Console apiKey={apiKey} gateway={gateway} lang={lang} gate={gate} center={opening.center} zoom={opening.zoom} />
      </EnergyMap>
    </div>
  );
}

/** What the record slot holds: a hint, a lookup in flight, nothing there, a failure, or a record. */
type EnergyRecord =
  | { kind: "idle" }
  | { kind: "loading"; at: [number, number] }
  | { kind: "miss"; at: [number, number] }
  | { kind: "error"; at: [number, number]; message: string }
  | { kind: "picked"; details: WellDetails; layer?: string; at?: [number, number] };

/** Everything that needs the map. It renders inside <EnergyMap>, where useMap() can see it. */
function Console({
  apiKey,
  gateway,
  lang,
  gate,
  center,
  zoom,
}: {
  apiKey: string;
  gateway?: string;
  lang: EnergyLang;
  gate: AddonGate;
  center: [number, number];
  zoom: number;
}) {
  const copy = ENERGY_COPY[lang];
  const granted = gate.state === "granted";
  const map = useMap(ENERGY_MAP_ID);
  const ready = useMapReady(ENERGY_MAP_ID);
  const generation = useMapGeneration(ENERGY_MAP_ID);
  const [record, setRecord] = useState<EnergyRecord>({ kind: "idle" });
  // The click targets' colours, from the customer's chart tokens once the style has loaded.
  const [colors, setColors] = useState<Record<EnergyTarget, string> | null>(null);
  // On a phone the sheet can fold to the record, to give the map back.
  const [folded, setFolded] = useState(false);
  // Read after mount: the server cannot know the pointer, so the first pass says "click".
  const [touch, setTouch] = useState(false);
  // A phone-width screen, where the record leads the sheet in the DOM as well as on screen, so the
  // keyboard meets it first. The panel mounts only after the add-on probe, so on the client.
  const [phone, setPhone] = useState(phoneWidth);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const movedRef = useRef(false);
  const uid = useId();
  const gateId = `${uid}-gate`;
  const toolsId = `${uid}-tools`;

  useEffect(() => setTouch(coarsePointer()), []);

  useEffect(() => {
    const media = typeof window === "undefined" ? undefined : window.matchMedia?.(PHONE_QUERY);
    if (!media) return;
    const update = () => setPhone(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  // The gateway paints every overlay one colour. The click targets take the chart tokens instead,
  // read again and painted again on every style load (a mode swap brings new tokens and new paint).
  useEffect(() => {
    if (!map || !ready || !granted || !map.getStyle()) return;
    const next = targetColors(chartRamp(map));
    paintTargets(map as unknown as EnergyPaintMap, next);
    setColors((previous) => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next));
  }, [map, ready, generation, granted]);

  // The camera keeps the panel's padding, so the opening view, a searched well and every later
  // move centre in the map the panel leaves. The opening view is placed again (resize, the panel
  // sliding in, the sheet folding) until the reader looks somewhere; after that only the padding moves.
  const placeRef = useRef({ center, zoom });
  placeRef.current = { center, zoom };
  useEffect(() => {
    if (!map) return;
    const place = () => {
      const container = map.getContainer();
      const padding = panelPadding(container.getBoundingClientRect(), panelRef.current?.getBoundingClientRect() ?? null);
      map.easeTo(movedRef.current ? { padding, duration: 0 } : { ...placeRef.current, padding, duration: 0 });
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
  }, [map, folded]);

  // Stable, so the popup keeps its click handler across renders. On a phone the whole sheet
  // scrolls: bring the record, which leads it once there is one, back into view.
  const show = useCallback((next: EnergyRecord) => {
    movedRef.current = true;
    setRecord(next);
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, []);
  const onLookup = useCallback((at: [number, number]) => show({ kind: "loading", at }), [show]);
  const onIdentify = useCallback(
    (hit: IdentifyResult, at: [number, number]) => show({ kind: "picked", details: wellDetails(hit), layer: hit.layer, at }),
    [show],
  );
  const onMiss = useCallback((at: [number, number]) => show({ kind: "miss", at }), [show]);
  const onError = useCallback(
    (error: unknown, at: [number, number]) => show({ kind: "error", at, message: requestError(error, lang) }),
    [show, lang],
  );
  const searchError = useCallback((error: unknown) => requestError(error, lang), [lang]);

  function pickResult(result: GeocodeResult) {
    show({ kind: "picked", details: wellDetails(result), layer: result.layer, at: [result.lng, result.lat] });
  }

  const hideWhenFolded = "max-sm:data-[folded=true]:hidden";
  const kind = record.kind === "picked" ? kindLabel(record.layer, lang) : "";
  const target = record.kind === "picked" ? targetOf(record.layer) : undefined;
  const kindColor = target && colors ? colors[target] : undefined;
  // What the live region says once a lookup settles. A failure speaks through its own alert.
  const said =
    record.kind === "picked" ? `${kind ? `${kind}: ` : ""}${record.details.name}.` : record.kind === "miss" ? copy.miss : "";
  const where = record.kind !== "idle" && record.at ? formatPoint(record.at, lang) : "";

  // The record: always there and tall enough for its answer, so nothing jumps when it arrives. On
  // a phone it leads the sheet, so the first action shows without scrolling: it is placed first in
  // the DOM rather than reordered by CSS, so keyboard order matches what is seen.
  const recordSlot = (
    <section
      aria-label={copy.selected}
      data-testid="energy-record"
      className="flex min-h-20 shrink-0 flex-col justify-center gap-2 border-t pt-4 max-sm:border-t-0 max-sm:pt-0 sm:min-h-[7.5rem]"
    >
      {record.kind === "idle" ? (
        <div className="flex flex-col gap-0.5">
          <p className="text-base font-medium">{touch ? copy.hintTouch : copy.hint}</p>
          <p className="text-sm text-muted-foreground">{copy.hintMore}</p>
        </div>
      ) : (
        <div key={`${record.kind}:${where}`} className="flex min-w-0 flex-col gap-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
          {record.kind === "loading" ? (
            <p className="flex h-7 items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              {copy.loading}
            </p>
          ) : record.kind === "miss" ? (
            <p className="text-base font-medium">{copy.miss}</p>
          ) : record.kind === "error" ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{record.message}</AlertDescription>
            </Alert>
          ) : (
            <>
              {kind ? (
                <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {/* The colour this kind has on the map and in the legend. */}
                  {kindColor ? (
                    <span aria-hidden="true" data-energy-swatch="" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: kindColor }} />
                  ) : null}
                  {kind}
                </p>
              ) : null}
              <p className="truncate text-xl leading-7 font-semibold tracking-tight tabular-nums" title={record.details.name}>
                {record.details.name}
              </p>
              {detailRows(record.details, lang).length > 0 ? (
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
                  {detailRows(record.details, lang).map(([label, value]) => (
                    <div key={label} className="contents">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="truncate font-medium tabular-nums">{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </>
          )}
          {where ? <p className="text-xs text-muted-foreground tabular-nums">{where}</p> : null}
        </div>
      )}
    </section>
  );

  return (
    <>
      {granted ? <EnergyPopup mapId={ENERGY_MAP_ID} apiKey={apiKey} gateway={gateway} onLookup={onLookup} onIdentify={onIdentify} onMiss={onMiss} onError={onError} /> : null}
      <p data-testid="energy-announce" aria-live="polite" className="sr-only">
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
                aria-controls={granted ? toolsId : gateId}
                onClick={() => setFolded((current) => !current)}
              >
                <span aria-hidden="true">{folded ? "▴" : "▾"}</span>
              </Button>
            </div>
            <CardDescription className="max-sm:hidden">{copy.description}</CardDescription>
          </CardHeader>
          <CardContent ref={contentRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain">
            {gate.state === "denied" || gate.state === "unknown" ? (
              <Alert
                id={gateId}
                data-folded={folded}
                data-unmap-addon-gate={gate.state === "denied" ? gate.code : "unknown"}
                className={`shrink-0 ${hideWhenFolded}`}
              >
                <AlertTitle className="line-clamp-none">{gate.state === "denied" ? copy.deniedTitle[gate.code] : copy.unknownTitle}</AlertTitle>
                <AlertDescription className="flex flex-col items-start gap-2">
                  <p>{gate.state === "denied" ? copy.deniedBody[gate.code] : copy.unknownBody(gate.status)}</p>
                  <a className="font-medium text-primary underline underline-offset-4" href={copy.pricingUrl} target="_blank" rel="noreferrer">
                    {copy.pricing}
                  </a>
                </AlertDescription>
              </Alert>
            ) : null}
            {granted ? (
              <>
                {phone ? recordSlot : null}
                {/* The tools: search, then the legend. On a phone they fold away and the record stays. */}
                <div id={toolsId} data-unmap-energy-tools="" data-folded={folded} className={`flex shrink-0 flex-col gap-4 ${hideWhenFolded}`}>
                  <div className="flex flex-col gap-1">
                    {/* `[&>p]:hidden` hides the geocoder's own coverage line; the example below says more. */}
                    <WellSearch
                      mapId={ENERGY_MAP_ID}
                      apiKey={apiKey}
                      gateway={gateway}
                      lang={lang}
                      placeholder={copy.search}
                      flyToZoom={14}
                      emptyText={copy.searchEmpty}
                      errorText={searchError}
                      onSelect={pickResult}
                      className="[&>p]:hidden"
                    />
                    <p className="text-xs text-muted-foreground">{copy.searchHint}</p>
                  </div>
                  {/* Two columns of layers from `sm` up: eight rows read as a legend, not a list. */}
                  <EnergyLayerControl
                    mapId={ENERGY_MAP_ID}
                    lang={lang}
                    colors={legendColors(colors)}
                    className="sm:[&>[data-slot=field-group]]:grid sm:[&>[data-slot=field-group]]:grid-cols-2 sm:[&>[data-slot=field-group]]:gap-x-3"
                  />
                </div>
                {phone ? null : recordSlot}
                <p data-folded={folded} className={`shrink-0 pb-1 text-xs text-muted-foreground ${hideWhenFolded}`}>
                  {copy.credit}
                </p>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
