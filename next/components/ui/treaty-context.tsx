"use client";

/**
 * <TreatyContext> - historic/modern treaty toggles and an accessible details panel.
 *
 * Pair with a map composed with `overlays={["treaties"]}`: the style draws the treaty shapes, and
 * this component shows or hides the two categories and answers "which treaty records are at this
 * point" from the geocoder's full-resolution lookup (`createTreatyOverlay` in `@unmap/geocoding`). A map
 * click, a `point` prop (wire a geocoder selection to it) or the coordinate form each make one
 * reverse geocode call; mounting and toggling make none.
 *
 * A match is a spatial match to a published representation, not a determination of rights, title
 * or territory. No match means "no record in this dataset", and the copy says exactly that.
 *
 * Built on your shadcn Field, Input, Button, Alert, Badge and Switch. Copied into your project by
 * `npx shadcn add`. Edit freely.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Geocoder as GeocoderClient,
  createTreatyOverlay,
  type TreatyContext as TreatyContextData,
  type TreatyLookupClient,
  type TreatyMatch,
  type TreatyOverlayController,
  type TreatySelection,
} from "@unmap/geocoding";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useMap } from "@/lib/map-context";
import { cn } from "@/lib/utils";

/* treaty-context:shared:start */
type Lang = "en" | "fr";
type Category = "historic" | "modern";

const CATEGORIES: readonly Category[] = ["historic", "modern"];

/**
 * Interface copy. Title, no match, unavailable, notice and point scope are the contract's strings,
 * verbatim (docs/indigenous-context/contract.md, "Interface copy"). None of it names a territory,
 * ownership or an acknowledgement; keep it that way when you edit.
 */
const COPY = {
  en: {
    title: "Treaty context",
    noMatch:
      "No treaty record found in this dataset. This does not determine Indigenous rights or whether land is unceded.",
    unavailable: "Treaty context is temporarily unavailable.",
    notice:
      "Source representations are approximate or illustrative. Coverage is incomplete; consult the linked sources.",
    pointScope: "Context applies to this coordinate.",
    attribution:
      "Source: Crown-Indigenous Relations and Northern Affairs Canada (Open Government Licence – Canada)",
    layers: "Show on map",
    historic: "Historic",
    modern: "Modern",
    coordinates: "Look up a coordinate",
    longitude: "Longitude",
    latitude: "Latitude",
    lookUp: "Look up",
    invalidPoint: "Enter a longitude from -180 to 180 and a latitude from -90 to 90.",
    reload: "Reload map",
    loading: "Looking up treaty context.",
    found: (count: number) => (count === 1 ? "1 treaty record found." : `${count} treaty records found.`),
    hiddenOnMap: "hidden on map",
    category: "Category",
    subtype: "Subtype",
    geography: "Geography",
    representation: "Representation",
    record: "Record",
    source: "Source",
    sourceLink: "Dataset page",
    version: "Dataset version",
    // English sets a colon tight; French (OQLF) puts a non-breaking space before it.
    labelSeparator: ":",
    point: (lat: string, lng: string) => `Latitude ${lat}, longitude ${lng}`,
    inLanguage: { en: "(English)", fr: "(French)" },
    categories: { historic: "Historic", modern: "Modern" },
    kinds: {
      treaty_area: "Treaty area",
      overall_treaty_area: "Overall treaty area",
      settlement_land: "Settlement land",
      rights_area: "Rights area",
      other: "Other",
      unspecified: "Unspecified",
    },
    representations: { approximate: "Approximate", illustrative: "Illustrative", unspecified: "Unspecified" },
  },
  fr: {
    title: "Contexte des traités",
    noMatch:
      "Aucun traité trouvé dans ce jeu de données. Ce résultat ne détermine ni les droits autochtones ni si le territoire est non cédé.",
    unavailable: "Le contexte des traités est temporairement indisponible.",
    notice:
      "Les représentations des sources sont approximatives ou illustratives. La couverture est incomplète; consultez les sources indiquées.",
    pointScope: "Le contexte s’applique à ces coordonnées.",
    attribution:
      "Source : Relations Couronne-Autochtones et Affaires du Nord Canada (Licence du gouvernement ouvert – Canada)",
    layers: "Afficher sur la carte",
    historic: "Historiques",
    modern: "Modernes",
    coordinates: "Rechercher des coordonnées",
    longitude: "Longitude",
    latitude: "Latitude",
    lookUp: "Rechercher",
    invalidPoint: "Entrez une longitude de -180 à 180 et une latitude de -90 à 90.",
    reload: "Recharger la carte",
    loading: "Recherche du contexte des traités.",
    found: (count: number) => (count === 1 ? "1 traité trouvé." : `${count} traités trouvés.`),
    hiddenOnMap: "masqué sur la carte",
    category: "Catégorie",
    subtype: "Sous-type",
    geography: "Géographie",
    representation: "Représentation",
    record: "Fiche",
    source: "Source",
    sourceLink: "Page du jeu de données",
    version: "Version du jeu de données",
    labelSeparator: "\u00a0:",
    point: (lat: string, lng: string) => `Latitude ${lat}, longitude ${lng}`,
    inLanguage: { en: "(anglais)", fr: "(français)" },
    categories: { historic: "Historique", modern: "Moderne" },
    kinds: {
      treaty_area: "Zone du traité",
      overall_treaty_area: "Zone globale du traité",
      settlement_land: "Terres visées par l’entente",
      rights_area: "Zone d’exercice des droits",
      other: "Autre",
      unspecified: "Non précisée",
    },
    representations: { approximate: "Approximative", illustrative: "Illustrative", unspecified: "Non précisée" },
  },
} as const;

/** An http(s) publisher link, or nothing: `javascript:`, `data:` and malformed URLs never render. */
function safeHref(url: unknown): string | undefined {
  if (typeof url !== "string") return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

/** A typed coordinate: a plain decimal (a comma decimal separator is accepted), finite, within `limit`. */
function parseDegrees(raw: string, limit: number): number | undefined {
  const text = raw.trim().replace(",", ".");
  if (!/^[-+]?(\d+(\.\d*)?|\.\d+)$/.test(text)) return undefined;
  const value = Number(text);
  return Number.isFinite(value) && Math.abs(value) <= limit ? value : undefined;
}

function degrees(value: number): string {
  return value.toFixed(5);
}

/** The language a subtype label is in. `subtype` follows the same rule as `name`. */
function subtypeLang(match: TreatyMatch, lang: Lang): Lang {
  const other: Lang = lang === "fr" ? "en" : "fr";
  return match.subtypes?.[lang]?.trim() ? lang : match.subtypes?.[other]?.trim() ? other : lang;
}

/** The drawn dataset version was retired: say unavailable and offer a reload, never newer details. */
function versionGone(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "treaties_version_not_found";
}
/* treaty-context:shared:end */

type View =
  | { kind: "idle" }
  | { kind: "loading"; point: [number, number] }
  | { kind: "result"; context: TreatyContextData }
  | { kind: "error"; point: [number, number] | null; versionGone: boolean };

export interface TreatyContextProps {
  /** unmap API key. A geocoder client is created from it unless you pass `geocoder`. */
  apiKey?: string;
  /** Gateway base URL. Defaults to the unmap production gateway. */
  gateway?: string;
  /** An existing client with `reverse`, such as `unmap.geocoder`. Wins over `apiKey`. */
  geocoder?: TreatyLookupClient;
  /** Map id when multiple maps share a page. Defaults to "default". */
  mapId?: string;
  /** Interface and lookup language. Defaults to "en". */
  lang?: Lang;
  /** Look up this [lng, lat]: wire a geocoder selection here. Each new value is one lookup. */
  point?: [number, number];
  /**
   * Called with every answer the lookup delivers (a map click, `point`, or typed coordinates):
   * the treaty context, the record ids drawn under the point, and the hidden categories. Highlight
   * the matched records with `context.matches[].id`. Makes no request of its own.
   */
  onSelect?: (selection: TreatySelection) => void;
  /**
   * Called when a lookup fails (a network error, a gateway error, a point outside coverage, a
   * retired dataset version) with the error and the point it was for, so a caller can say so
   * beside its own answer. The panel shows "unavailable" either way. Makes no request of its own.
   */
  onError?: (error: Error & { code?: string }, point: [number, number] | null) => void;
  /** Historic treaties start visible. Defaults to true. */
  historic?: boolean;
  /** Modern treaties start visible. Defaults to true. */
  modern?: boolean;
  /**
   * The drawn dataset version was retired. Reload the map (and with it the overlay) here; the
   * "Reload map" action only renders when this is set.
   */
  onReload?: () => void;
  className?: string;
}

export function TreatyContext({
  apiKey,
  gateway,
  geocoder,
  mapId,
  lang = "en",
  point,
  onSelect,
  onError,
  historic = true,
  modern = true,
  onReload,
  className,
}: TreatyContextProps) {
  const copy = COPY[lang];
  const map = useMap(mapId);
  const client = useMemo<TreatyLookupClient>(
    () => geocoder ?? new GeocoderClient({ key: apiKey ?? "", gateway }),
    [geocoder, apiKey, gateway],
  );
  const uid = useId();
  const headingId = `${uid}-heading`;
  const lngId = `${uid}-lng`;
  const latId = `${uid}-lat`;

  const [view, setView] = useState<View>({ kind: "idle" });
  const [visibility, setVisibility] = useState({ historic, modern });
  const [controller, setController] = useState<TreatyOverlayController | null>(null);
  const [lng, setLng] = useState("");
  const [lat, setLat] = useState("");
  const [invalid, setInvalid] = useState({ lng: false, lat: false });

  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusOnResult = useRef(false);
  const lastPoint = useRef<[number, number] | null>(null);
  // The `point` prop last asked for, so a re-render or a rebuilt controller never asks it again.
  const askedPoint = useRef<string | null>(null);
  const settings = useRef({ visibility, lang });
  settings.current = { visibility, lang };
  // Read when an answer lands, so a new handler never recreates the overlay.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // One overlay controller per map and client. It makes no request until a lookup is asked for.
  useEffect(() => {
    if (!map) return;
    const created = createTreatyOverlay(map, client, {
      ...settings.current.visibility,
      lang: settings.current.lang,
      onSelect: (selection) => {
        setView({ kind: "result", context: selection.context });
        onSelectRef.current?.(selection);
      },
      onError: (error) => {
        setView({ kind: "error", point: lastPoint.current, versionGone: versionGone(error) });
        onErrorRef.current?.(error, lastPoint.current);
      },
    });
    // The controller answers the click itself; this listener only shows that it started.
    const onClick = (event: { lngLat: { lng: number; lat: number } }) => {
      const at: [number, number] = [event.lngLat.lng, event.lngLat.lat];
      lastPoint.current = at;
      focusOnResult.current = false;
      setView({ kind: "loading", point: at });
    };
    map.on("click", onClick);
    setController(created);
    return () => {
      map.off("click", onClick);
      created.destroy();
      setController(null);
    };
  }, [map, client]);

  useEffect(() => {
    controller?.setLanguage(lang);
  }, [controller, lang]);

  function lookup(at: [number, number], fromKeyboard: boolean) {
    if (!controller) return;
    lastPoint.current = at;
    focusOnResult.current = fromKeyboard;
    setView({ kind: "loading", point: at });
    void controller.lookupAt(at);
  }

  // A new `point` is one lookup, once the controller exists. The same point is not asked twice in
  // a row, not even by a controller rebuilt after a click moved the panel on; once `point` is
  // cleared and set again, it is asked again.
  const pointKey = point ? `${point[0]},${point[1]}` : null;
  useEffect(() => {
    if (!point) askedPoint.current = null;
    if (!controller || !point || pointKey === askedPoint.current) return;
    askedPoint.current = pointKey;
    lookup(point, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, pointKey]);

  // After a keyboard lookup settles, move focus to the panel heading.
  useEffect(() => {
    if (!focusOnResult.current || view.kind === "loading" || view.kind === "idle") return;
    focusOnResult.current = false;
    headingRef.current?.focus();
  }, [view]);

  function toggle(category: Category, visible: boolean) {
    setVisibility((current) => ({ ...current, [category]: visible }));
    controller?.setVisibility({ [category]: visible });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const x = parseDegrees(lng, 180);
    const y = parseDegrees(lat, 90);
    setInvalid({ lng: x === undefined, lat: y === undefined });
    if (x === undefined || y === undefined) return;
    lookup([x, y], true);
  }

  const shown: [number, number] | null =
    view.kind === "result"
      ? [view.context.point.lng, view.context.point.lat]
      : view.kind === "idle"
        ? null
        : view.point;

  const announcement =
    view.kind === "loading"
      ? copy.loading
      : view.kind === "error"
        ? copy.unavailable
        : view.kind === "result"
          ? view.context.status === "unavailable"
            ? copy.unavailable
            : view.context.matches.length === 0
              ? copy.noMatch
              : copy.found(view.context.matches.length)
          : "";

  return (
    <section
      aria-labelledby={headingId}
      className={cn("flex w-full min-w-0 flex-col gap-4 text-sm", className)}
      data-unmap-treaty-context=""
      lang={lang}
    >
      <fieldset className="flex min-w-0 flex-col gap-2" data-unmap-treaty-layers="">
        <legend className="mb-2 font-medium">{copy.layers}</legend>
        {CATEGORIES.map((category) => (
          <Field key={category} orientation="horizontal">
            <Switch
              id={`${uid}-${category}`}
              checked={visibility[category]}
              onCheckedChange={(checked: boolean) => toggle(category, checked)}
            />
            <FieldLabel htmlFor={`${uid}-${category}`}>{copy[category]}</FieldLabel>
          </Field>
        ))}
      </fieldset>

      <form
        aria-label={copy.coordinates}
        className="flex min-w-0 flex-col gap-3"
        data-unmap-treaty-lookup=""
        noValidate
        onSubmit={submit}
      >
        <div className="grid min-w-0 grid-cols-2 gap-3">
          <Field data-invalid={invalid.lng || undefined}>
            <FieldLabel htmlFor={lngId}>{copy.longitude}</FieldLabel>
            <Input
              id={lngId}
              inputMode="decimal"
              autoComplete="off"
              aria-invalid={invalid.lng}
              aria-describedby={invalid.lng || invalid.lat ? `${uid}-invalid` : undefined}
              value={lng}
              onChange={(event) => {
                setLng(event.target.value);
                if (invalid.lng) setInvalid((current) => ({ ...current, lng: false }));
              }}
            />
          </Field>
          <Field data-invalid={invalid.lat || undefined}>
            <FieldLabel htmlFor={latId}>{copy.latitude}</FieldLabel>
            <Input
              id={latId}
              inputMode="decimal"
              autoComplete="off"
              aria-invalid={invalid.lat}
              aria-describedby={invalid.lng || invalid.lat ? `${uid}-invalid` : undefined}
              value={lat}
              onChange={(event) => {
                setLat(event.target.value);
                if (invalid.lat) setInvalid((current) => ({ ...current, lat: false }));
              }}
            />
          </Field>
        </div>
        {(invalid.lng || invalid.lat) && (
          <Alert variant="destructive" role="alert" id={`${uid}-invalid`}>
            <AlertDescription>{copy.invalidPoint}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" className="w-full" disabled={!controller}>
          {copy.lookUp}
        </Button>
      </form>

      <div aria-live="polite" className="sr-only" role="status" data-unmap-treaty-status="">
        {announcement}
      </div>

      <div className="flex min-w-0 flex-col gap-3" data-unmap-treaty-details="">
        <h3 className="font-medium" id={headingId} ref={headingRef} tabIndex={-1}>
          {copy.title}
        </h3>

        {view.kind === "result" && view.context.status === "ok" && view.context.matches.length === 0 && (
          <p data-unmap-treaty-empty="">{copy.noMatch}</p>
        )}

        {((view.kind === "result" && view.context.status === "unavailable") || view.kind === "error") && (
          <Alert data-unmap-treaty-unavailable="">
            <AlertDescription>
              <p>{copy.unavailable}</p>
              {view.kind === "error" && view.versionGone && onReload && (
                <Button type="button" variant="outline" size="sm" onClick={onReload}>
                  {copy.reload}
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {view.kind === "result" && view.context.status === "ok" && view.context.matches.length > 0 && (
          <ul className="flex min-w-0 flex-col gap-3" data-unmap-treaty-matches="">
            {view.context.matches.map((match) => {
              const href = safeHref(match.source_url);
              const typeLang = subtypeLang(match, lang);
              return (
                <li className="flex min-w-0 flex-col gap-1.5 border-t pt-3" data-unmap-treaty-match="" key={match.id}>
                  <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="min-w-0 break-words font-medium" lang={match.name_lang}>
                      {match.name}
                    </span>
                    {match.name_lang !== lang && (
                      <span className="text-muted-foreground text-xs" data-unmap-treaty-lang="">
                        {copy.inLanguage[match.name_lang]}
                      </span>
                    )}
                    {!visibility[match.category] && (
                      <Badge variant="outline" data-unmap-treaty-hidden="">
                        {copy.hiddenOnMap}
                      </Badge>
                    )}
                  </p>
                  <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
                    <dt className="text-muted-foreground">{copy.category}</dt>
                    <dd>{copy.categories[match.category]}</dd>
                    {match.subtype && (
                      <>
                        <dt className="text-muted-foreground">{copy.subtype}</dt>
                        <dd className="break-words">
                          <span lang={typeLang}>{match.subtype}</span>
                          {typeLang !== lang && (
                            <span className="text-muted-foreground text-xs"> {copy.inLanguage[typeLang]}</span>
                          )}
                        </dd>
                      </>
                    )}
                    <dt className="text-muted-foreground">{copy.geography}</dt>
                    <dd>{copy.kinds[match.geography_kind] ?? match.geography_kind}</dd>
                    <dt className="text-muted-foreground">{copy.representation}</dt>
                    <dd>{copy.representations[match.representation] ?? match.representation}</dd>
                    <dt className="text-muted-foreground">{copy.record}</dt>
                    <dd className="break-all">{match.id}</dd>
                    {href && (
                      <>
                        <dt className="text-muted-foreground">{copy.source}</dt>
                        <dd>
                          <a className="underline underline-offset-4" href={href} rel="noopener noreferrer" target="_blank">
                            {copy.sourceLink}
                          </a>
                        </dd>
                      </>
                    )}
                  </dl>
                </li>
              );
            })}
          </ul>
        )}

        {shown && (
          <div data-unmap-treaty-point="">
            <p>{copy.pointScope}</p>
            <p className="text-muted-foreground">{copy.point(degrees(shown[1]), degrees(shown[0]))}</p>
          </div>
        )}
        {view.kind === "result" && view.context.dataset_version && (
          <p className="text-muted-foreground break-all">
            {copy.version}{copy.labelSeparator} {view.context.dataset_version}
          </p>
        )}
        <p className="text-muted-foreground">{copy.notice}</p>
        <p className="text-muted-foreground text-xs">{copy.attribution}</p>
      </div>
    </section>
  );
}
